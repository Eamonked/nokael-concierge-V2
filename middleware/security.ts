import { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter
// ---------------------------------------------------------------------------
// For production with multiple processes, swap this for redis-based rate
// limiting (e.g. rate-limiter-flexible + ioredis).

interface RateLimitStore {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitStore>();

function cleanStore() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}

// Purge expired entries every 5 minutes
setInterval(cleanStore, 5 * 60 * 1000);

/**
 * Creates a rate-limit middleware.
 * @param maxRequests  Max requests per window
 * @param windowMs     Window duration in milliseconds
 */
export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? "unknown";
    const now = Date.now();

    let entry = store.get(ip);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(ip, entry);
    }

    entry.count += 1;

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - entry.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > maxRequests) {
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
      });
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// API key authentication
// ---------------------------------------------------------------------------

/**
 * Middleware that requires a valid `x-nokael-key` header.
 * Set NOKAEL_API_KEY in your environment variables.
 *
 * In dev mode (no key configured) this middleware is bypassed so local
 * development works without configuration.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const expectedKey = process.env.NOKAEL_API_KEY;

  // Bypass in development if no key is set
  if (!expectedKey) {
    console.warn("[auth] NOKAEL_API_KEY not set — API auth is DISABLED");
    return next();
  }

  const providedKey = req.headers["x-nokael-key"];

  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

/**
 * Adds basic security headers to every response.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  next();
}
