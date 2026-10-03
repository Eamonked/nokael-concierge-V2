// ==========================================
// Platform hostnames vs. companies' own domains
// ==========================================
// Shared by the browser and the server (keep it free of browser/Node-only
// imports). Any hostname that isn't the platform's own is treated as a
// company's custom domain and looked up with get_public_org_by_domain.

const BUILT_IN = ['nokael.com', 'www.nokael.com', 'coc.nokael.com', 'localhost', '127.0.0.1', '[::1]'];

// Hosting / preview hostnames that always serve the platform itself.
const PLATFORM_SUFFIXES = ['.run.app', '.pages.dev', '.workers.dev'];

/** Normalises "Book.Acme.ug:443." → "book.acme.ug". */
export const normalizeHost = (host: string | null | undefined): string =>
  (host ?? '').trim().toLowerCase().split(',')[0].trim().replace(/:\d+$/, '').replace(/\.$/, '');

/**
 * `extra` is a comma list of more platform hosts (PLATFORM_HOSTS on the
 * server, VITE_PLATFORM_HOSTS in the browser) for staging and similar.
 */
export const isPlatformHost = (host: string | null | undefined, extra = ''): boolean => {
  const h = normalizeHost(host);
  if (!h) return true;
  const list = [...BUILT_IN, ...extra.split(',').map(normalizeHost).filter(Boolean)];
  if (list.includes(h)) return true;
  if (PLATFORM_SUFFIXES.some(s => h.endsWith(s))) return true;
  // test-kampala.localhost etc. deliberately fall through: Chrome resolves
  // *.localhost to this machine, which makes custom domains testable locally.
  return false;
};

const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Why a company can't use this domain, or null when it's fine. */
export const customDomainProblem = (domain: string): string | null => {
  const d = normalizeHost(domain).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!DOMAIN_RE.test(d)) return 'Enter a domain like book.yourcompany.com';
  if (d === 'nokael.com' || d.endsWith('.nokael.com')) return 'That domain belongs to the platform';
  if (d.split('.').length < 3) {
    return 'Use a subdomain such as book.yourcompany.com — the bare domain usually still hosts your own website and email';
  }
  return null;
};

export const cleanDomain = (domain: string): string =>
  normalizeHost(domain).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
