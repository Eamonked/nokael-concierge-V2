import { getServiceClient } from "../routes/team.js";
import { isPlatformHost, normalizeHost } from "../src/lib/hosts.js";

// ---------------------------------------------------------------------------
// Requests arriving on a company's own domain (book.theircompany.com)
// ---------------------------------------------------------------------------
// Cloudflare for SaaS forwards those to this server. The original hostname is
// read from X-Tenant-Host (set by a Cloudflare Transform Rule, needed when the
// origin Host header is overridden), else X-Forwarded-Host, else Host.

export interface TenantHost {
  host: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  color: string | null;
}

export const requestHost = (headers: Record<string, string | string[] | undefined>): string => {
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return normalizeHost(pick(headers["x-tenant-host"]) || pick(headers["x-forwarded-host"]) || pick(headers.host));
};

export const isTenantHost = (host: string) => !isPlatformHost(host, process.env.PLATFORM_HOSTS ?? "");

// Small in-memory cache: company domains change rarely, page loads are frequent.
const cache = new Map<string, { at: number; value: TenantHost | null }>();
const TTL_HIT = 5 * 60_000;
const TTL_MISS = 60_000;

export async function resolveTenantHost(host: string): Promise<TenantHost | null> {
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < (hit.value ? TTL_HIT : TTL_MISS)) return hit.value;

  const client = getServiceClient();
  if (!client) return null;
  const { data, error } = await client.rpc("get_public_org_by_domain", { p_host: host });
  if (error) {
    console.warn("[tenant-host] lookup failed:", error.message);
    return hit?.value ?? null;
  }
  const value: TenantHost | null = data
    ? {
        host,
        name: (data as any).branding?.display_name?.trim() || (data as any).name,
        slug: (data as any).slug,
        logoUrl: (data as any).branding?.logo_url || null,
        color: (data as any).branding?.primary_color || null,
      }
    : null;
  cache.set(host, { at: Date.now(), value });
  return value;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The SPA shell for a company's domain: their name in title / previews /
 * splash, canonical on their domain, and none of Nokael's analytics (GTM,
 * Google Analytics / Ads) or
 * Nokael's LocalBusiness structured data.
 */
export function tenantHtml(template: string, tenant: TenantHost | null, urlPath: string): string {
  const name = tenant?.name ?? "Delivery booking";
  const title = esc(`${name} · Book & track deliveries`);
  const description = esc(`Book a delivery with ${name}, track it live and get proof of delivery.`);
  const origin = tenant ? `https://${tenant.host}` : "";
  const canonical = `${origin}${urlPath === "/" ? "" : urlPath}`;
  const structured = tenant
    ? JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", name, url: origin, ...(tenant.logoUrl ? { logo: tenant.logoUrl } : {}) })
    : "{}";

  return template
    // Nokael's Google Tag Manager (head loader + noscript iframe)
    .replace(/<script>\s*\(function\(\) \{\s*var gtmLoaded[\s\S]*?<\/script>/, "")
    .replace(/<noscript><iframe src="https:\/\/www\.googletagmanager\.com[\s\S]*?<\/noscript>/, "")
    .replace(/<link rel="dns-prefetch" href="https:\/\/www\.googletagmanager\.com" \/>/, "")
    // Nokael's Google Analytics / Ads conversion tags (body-end marketing block)
    .replace(/<!-- Marketing Scripts at Body End[\s\S]*?<\/script>/, "")
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${description}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${esc(canonical)}" />`)
    .replace(/<meta property="og:image" content="[^"]*" \/>/, tenant?.logoUrl ? `<meta property="og:image" content="${esc(tenant.logoUrl)}" />` : "")
    .replace(/<link rel="canonical" href="[^"]*" \/>/, tenant ? `<link rel="canonical" href="${esc(canonical)}" />` : "")
    .replace(/<link rel="(icon|apple-touch-icon)"[^>]*href="\/logo\.svg" \/>/g, tenant?.logoUrl ? `<link rel="$1" href="${esc(tenant.logoUrl)}" />` : "")
    .replace("{{STRUCTURED_DATA}}", structured)
    // Loading splash: their logo / name instead of Nokael's
    .replace(/<img src="\/logo\.svg" alt="Nokael"[^>]*\/>/, tenant?.logoUrl ? `<img src="${esc(tenant.logoUrl)}" alt="" width="60" height="60" style="width:75%;height:75%;object-fit:contain;" />` : "")
    .replace("Initialising Dispatch...", esc(name))
    .replace(/Nokael Logistics Dispat[^<]*/, "Loading…");
}
