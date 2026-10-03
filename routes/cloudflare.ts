// ---------------------------------------------------------------------------
// Cloudflare for SaaS — custom hostnames for companies' own domains
// ---------------------------------------------------------------------------
// A company points book.theirdomain.com (CNAME) at CLOUDFLARE_SAAS_CNAME_TARGET;
// registering the hostname here makes Cloudflare issue and renew its HTTPS
// certificate and route the traffic to our origin. Server-only (API token).
//
// Env:
//   CLOUDFLARE_API_TOKEN          token with Zone → SSL and Certificates: Edit
//   CLOUDFLARE_ZONE_ID            zone id of nokael.com
//   CLOUDFLARE_SAAS_CNAME_TARGET  what companies CNAME to, e.g. customers.nokael.com
//
// Without the token/zone the rest of the flow still works: the domain is saved
// as pending and a platform admin adds it in the Cloudflare dashboard by hand.

const API = "https://api.cloudflare.com/client/v4";

export const cnameTarget = () => process.env.CLOUDFLARE_SAAS_CNAME_TARGET || "customers.nokael.com";

export const cloudflareConfigured = () => !!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID);

export interface HostnameState {
  id: string;
  status: "pending" | "active" | "error";
  /** Human-readable reason when not active yet. */
  detail: string | null;
}

async function cf(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}/zones/${process.env.CLOUDFLARE_ZONE_ID}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const msg = json.errors?.map((e: any) => e.message).join("; ") || `Cloudflare request failed (${res.status})`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return json.result;
}

function toState(result: any): HostnameState {
  const host = result?.status;               // pending | active | moved | deleted | blocked…
  const ssl = result?.ssl?.status;           // initializing | pending_validation | active …
  const errors: string[] = [
    ...(result?.verification_errors ?? []),
    ...((result?.ssl?.validation_errors ?? []).map((e: any) => e.message)),
  ].filter(Boolean);

  if (host === "active" && ssl === "active") return { id: result.id, status: "active", detail: null };
  if (host === "blocked" || host === "moved" || host === "deleted") {
    return { id: result.id, status: "error", detail: errors[0] ?? `Cloudflare status: ${host}` };
  }
  return {
    id: result.id,
    status: "pending",
    detail: errors[0] ?? (ssl && ssl !== "active" ? "Waiting for the DNS record and certificate" : "Waiting for the DNS record"),
  };
}

/** Register a hostname (or return the existing registration for it). */
export async function registerHostname(hostname: string): Promise<HostnameState> {
  const existing = await cf(`/custom_hostnames?hostname=${encodeURIComponent(hostname)}`);
  if (Array.isArray(existing) && existing[0]) return toState(existing[0]);
  const created = await cf("/custom_hostnames", {
    method: "POST",
    body: JSON.stringify({
      hostname,
      // HTTP validation completes by itself once the CNAME points at us.
      ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } },
    }),
  });
  return toState(created);
}

export async function hostnameState(id: string): Promise<HostnameState> {
  return toState(await cf(`/custom_hostnames/${id}`));
}

export async function removeHostname(id: string): Promise<void> {
  await cf(`/custom_hostnames/${id}`, { method: "DELETE" }).catch((err) => {
    if (err?.status !== 404) throw err;
  });
}
