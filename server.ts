import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

import { SEO_METADATA, DEFAULT_METADATA, KNOWN_APP_ROUTES } from "./seo/metadata.js";
import { injectMetadata } from "./seo/inject.js";
import { securityHeaders, rateLimit, requireApiKey } from "./middleware/security.js";
import { createUploadRouter } from "./routes/upload.js";
import { createNotifyRouter } from "./routes/notify.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_URL = process.env.SITE_URL || "https://www.nokael.com";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();

  // ---------------------------------------------------------------------------
  // Global middleware
  // ---------------------------------------------------------------------------
  app.use(express.json({ limit: "1mb" }));
  app.use(securityHeaders);

  // ---------------------------------------------------------------------------
  // API routes
  // ---------------------------------------------------------------------------
  // Apply rate limiting and API key auth to all /api routes
  app.use("/api", rateLimit(60, 60 * 1000)); // 60 requests per minute
  app.use("/api", requireApiKey);
  
  app.use("/api", createUploadRouter());
  app.use("/api", createNotifyRouter());

  // ---------------------------------------------------------------------------
  // SPA + SSR rendering
  // ---------------------------------------------------------------------------

  if (!IS_PRODUCTION) {
    // ── Development: Vite middleware ──────────────────────────────────────────
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);

    app.get("*", async (req, res, next) => {
      try {
        let template = fs.readFileSync(
          path.resolve(__dirname, "index.html"),
          "utf-8"
        );
        template = await vite.transformIndexHtml(req.originalUrl, template);

        const urlPath = req.path;
        const metadata = SEO_METADATA[urlPath] ?? DEFAULT_METADATA;
        const html = injectMetadata(template, urlPath, metadata, SITE_URL, false);

        res.status(200).set("Content-Type", "text/html").end(html);
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

    app.use(express.static(distPath, { index: false }));

    app.get("*", (req, res) => {
      const urlPath = req.path;

      // Determine metadata and status code
      const isSeoRoute = urlPath in SEO_METADATA;
      const isAppRoute = KNOWN_APP_ROUTES.includes(urlPath);

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

      const html = injectMetadata(INDEX_HTML, urlPath, metadata, SITE_URL, true);
      res.status(statusCode).set("Content-Type", "text/html").end(html);
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
