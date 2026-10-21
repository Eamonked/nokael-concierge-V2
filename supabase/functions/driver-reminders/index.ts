// driver-reminders: "leave now" / "be there by" pushes for pickup and delivery
// windows, plus a staff alert when a driver's ETA is past the window start.
//
// Woken every 2 min by pg_cron (_reminders_kick) with the same x-push-secret as
// push-dispatch; JWT checking is off because that caller has no user JWT.
// Rules and message text live in SQL (reminder_candidates / reminder_send, see
// supabase-driver-window-reminders.sql); this function only adds the
// traffic-aware drive time, which Postgres can't fetch synchronously.
//
// MAPBOX_SERVER_TOKEN: a Mapbox token without URL restrictions (the apps' pk.
// token only works from our sites). Without it, every leg gets the time-based
// reminder and no late alerts.
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
const MAPBOX = Deno.env.get("MAPBOX_SERVER_TOKEN") ?? "";

type Candidate = {
  job_id: string;
  leg: "pickup" | "delivery";
  target: string;
  dest_lat: number | null;
  dest_lng: number | null;
  driver_lat: number | null;
  driver_lng: number | null;
  buffer_min: number;
  leave_sent: boolean;
  late_sent: boolean;
  eta_seconds: number | null;
};

const FALLBACK_LEAD_S = 30 * 60; // time-based reminder: buffer + 30 min before the window

let secret: string | null = null;
async function pushSecret(): Promise<string> {
  if (secret) return secret;
  const { data, error } = await supabase.rpc("push_config");
  if (error || !data) throw new Error(`push_config: ${error?.message ?? "empty"}`);
  secret = (data as { push_dispatch_secret: string }).push_dispatch_secret;
  return secret;
}

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(a));
}

// Generous drive-time guess (winding roads, 40 km/h, +5 min) — only used to
// skip the Mapbox call while there's clearly plenty of time.
const roughSeconds = (m: number) => (m * 1.4) / (40_000 / 3600) + 300;

async function trafficSeconds(c: Candidate): Promise<number | null> {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${c.driver_lng},${c.driver_lat};${c.dest_lng},${c.dest_lat}?overview=false&access_token=${MAPBOX}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("mapbox", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const json = await res.json();
    const s = json.routes?.[0]?.duration;
    return typeof s === "number" ? Math.round(s) : null;
  } catch (e) {
    console.error("mapbox", e);
    return null;
  }
}

async function send(c: Candidate, kind: "leave" | "fallback" | "late", eta: number | null) {
  const { data, error } = await supabase.rpc("reminder_send", {
    p_job: c.job_id, p_leg: c.leg, p_kind: kind, p_target: c.target, p_eta_seconds: eta,
  });
  if (error) console.error("reminder_send", c.job_id, kind, error.message);
  return data === true;
}

async function handle(c: Candidate) {
  const now = Date.now();
  const slack = (new Date(c.target).getTime() - now) / 1000;
  const buffer = c.buffer_min * 60;
  const located = c.driver_lat != null && c.driver_lng != null && c.dest_lat != null && c.dest_lng != null;

  // Traffic-aware ETA is usable when we know where the driver is and can ask Mapbox.
  let routable = located && !!MAPBOX;
  let eta = c.eta_seconds;
  if (routable && eta == null && !(c.leave_sent && c.late_sent)) {
    const rough = roughSeconds(distanceM(c.driver_lat!, c.driver_lng!, c.dest_lat!, c.dest_lng!));
    if (slack - buffer <= rough + 15 * 60) {
      eta = await trafficSeconds(c);
      if (eta != null) await supabase.rpc("reminder_cache_eta", { p_job: c.job_id, p_leg: c.leg, p_seconds: eta });
      else routable = false;
    }
  }

  const sent: string[] = [];
  if (!c.leave_sent) {
    if (eta != null) {
      if (eta + buffer >= slack && await send(c, "leave", eta)) sent.push("leave");
    } else if (!routable && slack <= buffer + FALLBACK_LEAD_S) {
      // No GPS, no Mapbox, or Mapbox failed: remind on the clock instead.
      if (await send(c, "fallback", null)) sent.push("fallback");
    }
  }
  if (!c.late_sent && eta != null && eta > slack) {
    if (await send(c, "late", eta)) sent.push("late");
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  try {
    if (req.headers.get("x-push-secret") !== await pushSecret()) {
      return new Response("unauthorized", { status: 401 });
    }
  } catch (e) {
    console.error(e);
    return new Response("config unavailable", { status: 500 });
  }

  const { data, error } = await supabase.rpc("reminder_candidates");
  if (error) {
    console.error("reminder_candidates", error);
    return new Response("candidates failed", { status: 500 });
  }
  const results = await Promise.all((data as Candidate[]).map(async (c) => ({ job: c.job_id, leg: c.leg, sent: await handle(c) })));
  return new Response(JSON.stringify({ ok: true, checked: results.length, mapbox: !!MAPBOX, sent: results.filter((r) => r.sent.length) }), {
    headers: { "Content-Type": "application/json" },
  });
});
