import { Router } from "express";
import { rateLimit } from "../middleware/security.js";
import { requireOrgSession } from "./team.js";
import { parseGoogleMapsUrl } from "../src/lib/mapLink.js";

// ---------------------------------------------------------------------------
// Google Maps short links (maps.app.goo.gl/…) → a point
// ---------------------------------------------------------------------------
// The Pick-on-map dialog reads full Google Maps links itself, but a short link
// is just a redirect, which the browser can't follow across origins. We follow
// it here — only ever to Google hosts, never an arbitrary URL — and read the
// coordinates out of the link it lands on.

const ALLOWED_HOST = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|consent\.google\.com|(www\.|maps\.)?google\.[a-z.]+)$/i;
const MAX_HOPS = 6;

async function expand(start: string): Promise<string | null> {
  let current = start;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const url = new URL(current);
    if (url.protocol !== "https:" || !ALLOWED_HOST.test(url.hostname)) return null;
    // A Google Maps link we can already read — stop following.
    const parsed = parseGoogleMapsUrl(current);
    if (parsed && parsed.kind !== "short") return current;

    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    return current;
  }
  return null;
}

export function createMapsRouter() {
  const router = Router();
  router.use(rateLimit(30, 60_000));
  router.use(requireOrgSession);

  router.post("/resolve", async (req, res) => {
    const raw = typeof req.body?.url === "string" ? req.body.url.trim() : "";
    if (!raw || raw.length > 2000) return res.status(400).json({ error: "Paste a Google Maps link." });
    try {
      const final = await expand(raw);
      const parsed = final ? parseGoogleMapsUrl(final) : null;
      if (!parsed || parsed.kind === "short") {
        return res.status(422).json({ error: "Couldn't read a location from that link." });
      }
      res.json({ ...parsed, url: final });
    } catch {
      res.status(502).json({ error: "Couldn't reach Google Maps to open that link." });
    }
  });

  return router;
}
