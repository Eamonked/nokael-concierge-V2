import "dotenv/config";
import express from "express";
import compression from "compression";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

import { SEO_METADATA, DEFAULT_METADATA, KNOWN_APP_ROUTES, APP_ROUTE_PREFIXES } from "./seo/metadata.js";
import { injectMetadata } from "./seo/inject.js";
import { requestHost, isTenantHost, resolveTenantHost, tenantHtml } from "./seo/tenantHost.js";
import { securityHeaders, rateLimit, requireApiKey } from "./middleware/security.js";
import { createUploadRouter } from "./routes/upload.js";
import { createNotifyRouter } from "./routes/notify.js";
import { createPoolRouter } from "./routes/pool.js";
import { createTeamRouter } from "./routes/team.js";
import { createClientsRouter } from "./routes/clients.js";
import { createOnboardingRouter } from "./routes/onboarding.js";

const _filename = typeof __filename !== "undefined" ? __filename : fileURLToPath(import.meta.url);
const _dirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(_filename);

const SITE_URL = process.env.SITE_URL || "https://www.nokael.com" || "https://nokael.com";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();

  // ---------------------------------------------------------------------------
  // Global middleware
  // ---------------------------------------------------------------------------
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(securityHeaders);

  // ---------------------------------------------------------------------------
  // API routes
  // ---------------------------------------------------------------------------
  // Multi-tenant pool API — mounted BEFORE the site-wide requireApiKey
  // chain below, and deliberately not under it. It has its own per-tenant
  // auth (requirePoolApiKey, checked against api_keys via the
  // verify_api_key RPC) — stacking the shared NOKAEL_API_KEY secret on
  // top would conflate two unrelated auth models for no reason.
  app.use("/api/pool", createPoolRouter());

  // Team management API — same reasoning as /api/pool above: it has its
  // own per-user auth (the caller's real Supabase session token, checked
  // against org_members role), so it's mounted before the shared
  // requireApiKey chain rather than under it.
  app.use("/api/team", createTeamRouter());

  // Client portal access — same per-user session auth as /api/team.
  app.use("/api/clients", createClientsRouter());

  // Company onboarding (platform admins create companies; owners finish
  // setup) — same per-user session auth as /api/team.
  app.use("/api/onboarding", createOnboardingRouter());

  // Apply rate limiting and API key auth to all other /api routes
  app.use("/api", rateLimit(60, 60 * 1000)); // 60 requests per minute
  app.use("/api", requireApiKey);
  
  app.use("/api", createUploadRouter());
  app.use("/api", createNotifyRouter());

  // ---------------------------------------------------------------------------
  // Companies' own domains (book.theircompany.com via Cloudflare for SaaS)
  // ---------------------------------------------------------------------------
  // Staff pages always live on the platform domain (one Supabase Auth redirect
  // URL, one login), so those paths bounce there. Everything else is served
  // as the company's public site; the SPA resolves the company from the host.
  const STAFF_PATHS = ["/dashboard", "/admin", "/login", "/accept-invite", "/onboarding"];
  app.use((req, res, next) => {
    const host = requestHost(req.headers);
    if (!isTenantHost(host)) return next();
    res.locals.tenantHost = host;
    if (req.method === "GET" && STAFF_PATHS.some(p => req.path === p || req.path.startsWith(`${p}/`))) {
      return res.redirect(302, `${SITE_URL}${req.originalUrl}`);
    }
    next();
  });

  // The HTML shell for a company-domain request, or null for the platform.
  const tenantShell = async (res: express.Response, template: string, urlPath: string): Promise<string | null> => {
    const host = res.locals.tenantHost as string | undefined;
    if (!host) return null;
    return tenantHtml(template, await resolveTenantHost(host), urlPath);
  };

  // ---------------------------------------------------------------------------
  // SPA + SSR rendering
  // ---------------------------------------------------------------------------

  if (!IS_PRODUCTION) {
    // ── Development: Vite middleware ──────────────────────────────────────────
    const vite = await createViteServer({
      // *.localhost lets a company domain be tried locally (book-test.localhost:3000).
      server: { middlewareMode: true, allowedHosts: [".localhost"] },
      appType: "spa",
    });

    // Company-domain pages: Vite's SPA fallback would otherwise answer with the
    // plain Nokael index.html before the handler below runs.
    app.use(async (req, res, next) => {
      if (!res.locals.tenantHost || req.method !== "GET" || !(req.headers.accept ?? "").includes("text/html")) return next();
      try {
        const raw = fs.readFileSync(path.resolve(_dirname, "index.html"), "utf-8");
        const template = await vite.transformIndexHtml(req.originalUrl, raw);
        const page = await tenantShell(res, template, req.path);
        if (page) return res.status(200).set("Content-Type", "text/html").end(page);
        next();
      } catch (e) {
        next(e);
      }
    });

    app.use(vite.middlewares);

    app.get("*", async (req, res, next) => {
      try {
        let template = fs.readFileSync(
          path.resolve(_dirname, "index.html"),
          "utf-8"
        );
        template = await vite.transformIndexHtml(req.originalUrl, template);

        const tenantPage = await tenantShell(res, template, req.path);
        if (tenantPage) return res.status(200).set("Content-Type", "text/html").end(tenantPage);

        // Normalize path: remove trailing slash for comparison
        let urlPath = req.path === "/" ? "/" : req.path.replace(/\/$/, "");
        if (urlPath === "") urlPath = "/";

        const metadata = SEO_METADATA[urlPath] ?? DEFAULT_METADATA;
        const skipContent = KNOWN_APP_ROUTES.includes(urlPath) || APP_ROUTE_PREFIXES.some(p => urlPath.startsWith(p));
        const html = injectMetadata(template, urlPath, metadata, SITE_URL, false, skipContent);
        
        // Customize the "Initialising" placeholder with the page's H1 for better LCP/FCP
        const placeholderHtml = html.replace(
          'Initialising Dispatch...',
          metadata.h1 || 'Initialising Dispatch...'
        );

        res.status(200).set("Content-Type", "text/html").end(placeholderHtml);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // ── Production: serve pre-built dist ─────────────────────────────────────
    const distPath = path.join(process.cwd(), "dist");
    const indexPath = path.join(distPath, "index.html");

    if (!fs.existsSync(indexPath)) {
      console.error("[server] dist/index.html not found. Run `npm run build` first.");
      process.exit(1);
    }

    // Cache the HTML template in memory — read once, reuse on every request
    const INDEX_HTML = fs.readFileSync(indexPath, "utf-8");

    app.use(express.static(distPath, {
      index: false,
      maxAge: '1y',
      immutable: true,
      // The push service worker keeps its name across releases, so it must never be cached long.
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('push-sw.js')) res.setHeader('Cache-Control', 'no-cache');
      },
    }));

    app.get("*", async (req, res) => {
      const tenantPage = await tenantShell(res, INDEX_HTML, req.path);
      if (tenantPage) return res.status(200).set("Content-Type", "text/html").end(tenantPage);

      // Normalize path: remove trailing slash for comparison
      let urlPath = req.path === "/" ? "/" : req.path.replace(/\/$/, "");
      if (urlPath === "") urlPath = "/";

      // Determine metadata and status code
      const isSeoRoute = urlPath in SEO_METADATA;
      const isAppRoute = KNOWN_APP_ROUTES.includes(urlPath) || APP_ROUTE_PREFIXES.some(p => urlPath.startsWith(p));

      let metadata = SEO_METADATA[urlPath];
      let statusCode: number;

      if (isSeoRoute || isAppRoute) {
        statusCode = 200;
        metadata = metadata ?? DEFAULT_METADATA;
      } else {
        // Unknown route → 404 with dedicated metadata
        statusCode = 404;
        metadata = SEO_METADATA["/404"];
      }

      const html = injectMetadata(INDEX_HTML, urlPath, metadata, SITE_URL, true, isAppRoute && !isSeoRoute);
      
      // Customize the "Initialising" placeholder with the page's H1 for better LCP/FCP
      const placeholderHtml = html.replace(
        'Initialising Dispatch...',
        metadata.h1 || 'Initialising Dispatch...'
      );
      
      res.status(statusCode).set("Content-Type", "text/html").end(placeholderHtml);
    });
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] Running on http://0.0.0.0:${PORT} (${IS_PRODUCTION ? "production" : "development"})`);
  });
}

startServer().catch((err) => {
  console.error("[server] Fatal startup error:", err);
  process.exit(1);
});
