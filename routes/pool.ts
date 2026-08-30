import { Router, Request, Response, NextFunction } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { rateLimit } from "../middleware/security.js";

// ---------------------------------------------------------------------------
// Service-role Supabase client
// ---------------------------------------------------------------------------
// Deliberately separate from src/lib/supabase.ts, which uses the anon key
// and is safe to bundle into the frontend. This client uses the service
// role key and must NEVER be imported from anything that ends up in the
// Vite/client bundle -- routes/ only runs on the server.

let serviceClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient | null {
  if (serviceClient) return serviceClient;

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

// ---------------------------------------------------------------------------
// Pool API key authentication
// ---------------------------------------------------------------------------
// Separate from requireApiKey (the single shared secret guarding /notify
// and /upload). This is a per-tenant key: the value in `x-nokael-pool-key`
// is hash-looked-up against public.api_keys via the verify_api_key RPC
// (bcrypt comparison happens inside Postgres, mirroring the driver PIN
// auth pattern already used elsewhere). A valid key resolves to exactly
// one organization_id, which is then trusted for the rest of the request --
// this is the application-layer gate that create_job_for_org /
// match_driver_for_org rely on, now that PUBLIC execute has been revoked
// on those functions.

interface PoolRequest extends Request {
  orgId?: string;
}

async function requirePoolApiKey(req: PoolRequest, res: Response, next: NextFunction) {
  const client = getServiceClient();
  if (!client) {
    console.error("[pool] SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_URL not configured — refusing request");
    return res.status(503).json({ error: "Pool API not configured" });
  }

  const providedKey = req.headers["x-nokael-pool-key"];
  if (!providedKey || typeof providedKey !== "string") {
    return res.status(401).json({ error: "Missing x-nokael-pool-key header" });
  }

  try {
    const { data: orgId, error } = await client.rpc("verify_api_key", { p_key: providedKey });

    if (error) {
      console.error("[pool] verify_api_key RPC error:", error);
      return res.status(500).json({ error: "Key verification failed" });
    }

    if (!orgId) {
      return res.status(401).json({ error: "Invalid or revoked API key" });
    }

    req.orgId = orgId as string;
    next();
  } catch (err) {
    console.error("[pool] Unexpected error verifying pool API key:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
// Mounted at /api/pool in server.ts, registered BEFORE the global
// app.use("/api", requireApiKey) chain used by /notify and /upload, so
// this router's own auth is what actually gates these routes rather than
// stacking on top of the unrelated site-wide shared secret.

export function createPoolRouter() {
  const router = Router();

  // 30 requests/min per IP — a tenant backend calling this in a normal
  // dispatch flow will be well under this; generous enough for testing.
  router.use(rateLimit(30, 60_000));
  router.use(requirePoolApiKey);

  // POST /api/pool/jobs
  // Creates a job on behalf of the calling org via create_job_for_org.
  // Mirrors exactly how an external tenant's backend would call it.
  router.post("/jobs", async (req: PoolRequest, res: Response) => {
    const client = getServiceClient()!;
    const {
      sender_name,
      sender_phone,
      recipient_name,
      recipient_phone,
      pickup_emirate,
      pickup_location,
      delivery_emirate,
      delivery_location,
      item_type,
      urgency,
      notes,
    } = req.body ?? {};

    const required = {
      sender_name,
      sender_phone,
      recipient_name,
      recipient_phone,
      pickup_emirate,
      pickup_location,
      delivery_emirate,
      delivery_location,
      item_type,
      urgency,
    };
    const missing = Object.entries(required)
      .filter(([, v]) => typeof v !== "string" || v.trim() === "")
      .map(([k]) => k);

    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
    }

    try {
      const { data, error } = await client.rpc("create_job_for_org", {
        org_id: req.orgId,
        p_sender_name: sender_name,
        p_sender_phone: sender_phone,
        p_recipient_name: recipient_name,
        p_recipient_phone: recipient_phone,
        p_pickup_emirate: pickup_emirate,
        p_pickup_location: pickup_location,
        p_delivery_emirate: delivery_emirate,
        p_delivery_location: delivery_location,
        p_item_type: item_type,
        p_urgency: urgency,
        p_notes: notes ?? null,
      });

      if (error) {
        console.error("[pool] create_job_for_org error:", error);
        return res.status(400).json({ error: error.message });
      }

      return res.status(201).json(data);
    } catch (err) {
      console.error("[pool] Unexpected error in POST /jobs:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/pool/drivers/match?emirate=Dubai
  // Returns the single best available driver from the calling org's own
  // pool, or null if none. Does not assign the driver to any job.
  router.get("/drivers/match", async (req: PoolRequest, res: Response) => {
    const client = getServiceClient()!;
    const emirate = typeof req.query.emirate === "string" ? req.query.emirate : null;

    try {
      const { data, error } = await client.rpc("match_driver_for_org", {
        org_id: req.orgId,
        p_emirate: emirate,
      });

      if (error) {
        console.error("[pool] match_driver_for_org error:", error);
        return res.status(400).json({ error: error.message });
      }

      const match = Array.isArray(data) ? data[0] ?? null : data;
      return res.json({ driver: match });
    } catch (err) {
      console.error("[pool] Unexpected error in GET /drivers/match:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
