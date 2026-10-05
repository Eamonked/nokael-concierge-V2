import { supabase } from './supabase';
import i18n from '../i18n/config';
import { findCountry } from './countries';
import { isPlatformHost, normalizeHost } from './hosts';
import {
  NOKAEL_ORG_ID, WHATSAPP_NUMBER, PHONE_NUMBER, PRICE_TIER_SAME_DAY, PRICE_TIER_DEDICATED, BUSINESS_ACCOUNT_WA_MESSAGE,
} from '../constants';

// ==========================================
// Active tenant (organization) for this page
// ==========================================
// One place that answers "which company is this page for?":
//   /c/<slug>/...   → the org with that slug (get_public_org RPC)
//   /dashboard      → the signed-in member's org (useDashboardData)
//   everything else → Nokael (tenant zero)
// Write paths (quotes, driver applications, jobs, contacts) stamp
// organization_id from getActiveOrgId(), and formatting (currency, time zone,
// region names, phone prefix) reads the same profile.

export interface TenantSettings {
  country: string;
  currency: string;
  timezone: string;
  locale: string;
  dial_code: string;
  region_label: string;
  regions: string[];
  tax_label: string;
  tax_rate: number;
  job_ref_prefix: string;
  map_center: [number, number];
  languages: string[];
  price_same_day?: number;
  price_dedicated?: number;
  geofence?: { pickup_m?: number; delivery_m?: number };
  onboarding?: { step?: number; completed_at?: string | null };
  /** Chain of Custody certificate template (see lib/cocRender.ts). */
  coc?: Partial<import('./cocRender').CocTemplate>;
}

export interface TenantBranding {
  display_name?: string;
  logo_url?: string;
  primary_color?: string;
  support_phone?: string;
  whatsapp?: string;
  support_email?: string;
  website?: string;
}

export interface TenantProfile {
  id: string;
  name: string;
  slug: string;
  /** The company's own domain, only once it's live (e.g. "book.acme.ug"). */
  custom_domain?: string | null;
  branding: TenantBranding;
  settings: TenantSettings;
}

export const NOKAEL_TENANT: TenantProfile = {
  id: NOKAEL_ORG_ID,
  name: 'Nokael',
  slug: 'nokael',
  branding: {
    display_name: 'Nokael',
    primary_color: '#00E08A',
    support_phone: PHONE_NUMBER,
    whatsapp: WHATSAPP_NUMBER,
  },
  settings: {
    country: 'AE',
    currency: 'AED',
    timezone: 'Asia/Dubai',
    locale: 'en-AE',
    dial_code: '+971',
    region_label: 'Emirate',
    regions: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'],
    tax_label: 'VAT',
    tax_rate: 5,
    job_ref_prefix: 'NOK',
    map_center: [55.0, 25.0],
    languages: ['en', 'ar'],
    price_same_day: PRICE_TIER_SAME_DAY,
    price_dedicated: PRICE_TIER_DEDICATED,
  },
};

/** Fill any missing setting from Nokael's, so a half-configured org still renders. */
export const normalizeTenant = (raw: any): TenantProfile => {
  const settings = { ...NOKAEL_TENANT.settings, ...(raw?.settings ?? {}) } as TenantSettings;
  if (!Array.isArray(settings.regions)) settings.regions = [];
  if (!Array.isArray(settings.map_center) || settings.map_center.length !== 2) settings.map_center = NOKAEL_TENANT.settings.map_center;
  const isNokael = raw?.id === NOKAEL_ORG_ID || raw?.slug === 'nokael';
  return {
    id: String(raw?.id ?? NOKAEL_TENANT.id),
    name: String(raw?.name ?? NOKAEL_TENANT.name),
    slug: String(raw?.slug ?? NOKAEL_TENANT.slug),
    custom_domain: raw?.custom_domain ?? null,
    // Only Nokael inherits Nokael's phone numbers — another company must never
    // show them, even if it hasn't entered its own yet.
    branding: { ...(isNokael ? NOKAEL_TENANT.branding : {}), ...(raw?.branding ?? {}) },
    settings,
  };
};

let active: TenantProfile = NOKAEL_TENANT;
const listeners = new Set<(t: TenantProfile) => void>();

export const getActiveTenant = (): TenantProfile => active;
export const getActiveOrgId = (): string => active.id;
export const isDefaultTenant = (t: TenantProfile = active): boolean => t.id === NOKAEL_ORG_ID;

export const setActiveTenant = (tenant: TenantProfile) => {
  if (tenant === active) return;
  active = tenant;
  applyI18nVariables(tenant);
  listeners.forEach(fn => fn(tenant));
};

export const subscribeTenant = (fn: (t: TenantProfile) => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

export const tenantDisplayName = (t: TenantProfile = active) => t.branding.display_name?.trim() || t.name;

const plural = (word: string) => (/[^aeiou]y$/i.test(word) ? `${word.slice(0, -1)}ies` : /(s|x|ch|sh)$/i.test(word) ? `${word}es` : `${word}s`);
const COUNTRY_SHORT: Record<string, string> = { AE: 'UAE', GB: 'UK', US: 'US', SA: 'Saudi', NZ: 'NZ', UG: 'Ugandan' };
// Local name of the ID drivers upload.
const ID_DOC: Record<string, string> = { AE: 'Emirates ID', UG: 'National ID (NIN)' };

/**
 * Values every translation can use without the call site passing them:
 * {{currency}}, {{regionLabel}}, {{dialCode}}, {{brand}}, {{idDocLabel}}…
 * For a UAE company they reproduce the wording the site always had.
 */
export const tenantI18nVariables = (t: TenantProfile): Record<string, string> => {
  const s = t.settings;
  const uae = (s.country || 'AE').toUpperCase() === 'AE';
  const regionPluralLower = plural(s.region_label).toLowerCase();
  return {
    currency: s.currency,
    currencyAr: s.currency === 'AED' ? 'درهم' : s.currency,
    regionLabel: s.region_label,
    regionLabelAr: uae ? 'الإمارة' : 'المنطقة',
    regionLabelPlural: plural(s.region_label),
    regionLabelPluralLower: regionPluralLower,
    dialCode: s.dial_code,
    brand: tenantDisplayName(t),
    taxLabel: s.tax_label,
    countryShort: COUNTRY_SHORT[s.country] ?? findCountry(s.country)?.name ?? s.country,
    countryShortAr: uae ? 'في الإمارات' : '',
    idDocLabel: ID_DOC[s.country] ?? 'National ID / Passport',
    idDocLabelAr: uae ? 'الهوية الإماراتية' : 'الهوية الوطنية أو جواز السفر',
    idPlaceholder: uae ? '784-XXXX-XXXXXXX-X' : '',
    baseLocationExample: uae ? 'e.g. Al Barsha, Dubai' : s.regions[0] ? `e.g. ${s.regions[0]}` : 'Your usual base area',
    interRegionQuestion: uae
      ? 'Are you comfortable driving between Dubai, Abu Dhabi, and Northern Emirates?'
      : `Are you comfortable driving between ${regionPluralLower}?`,
    interRegionQuestionAr: uae
      ? 'هل أنت مرتاح للقيادة بين دبي وأبوظبي والإمارات الشمالية؟'
      : 'هل أنت مرتاح للقيادة بين المناطق المختلفة؟',
  };
};

function applyI18nVariables(t: TenantProfile) {
  const interpolation = (i18n.options.interpolation ??= {});
  interpolation.defaultVariables = {
    ...(interpolation.defaultVariables ?? {}),
    ...tenantI18nVariables(t),
  };
  // Re-render components bound to useTranslation().
  if (i18n.isInitialized) void i18n.changeLanguage(i18n.language);
}
applyI18nVariables(active);

// ------------------------------------------
// Lookups
// ------------------------------------------
const bySlug = new Map<string, Promise<TenantProfile | null>>();

export const fetchPublicTenant = (slug: string): Promise<TenantProfile | null> => {
  const key = slug.trim().toLowerCase();
  if (!bySlug.has(key)) {
    bySlug.set(key, (async () => {
      if (!supabase) return null;
      const { data, error } = await supabase.rpc('get_public_org', { p_slug: key });
      if (error) {
        bySlug.delete(key);
        throw error;
      }
      return data ? normalizeTenant(data) : null;
    })());
  }
  return bySlug.get(key)!;
};

/** Full profile for a member's own org (RLS: members can read their org row). */
export const fetchMemberTenant = async (orgId: string): Promise<TenantProfile | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug, branding, settings')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeTenant(data) : null;
};

// ------------------------------------------
// Formatting in the tenant's currency / zone
// ------------------------------------------
export const formatMoney = (
  amount: number | string | null | undefined,
  opts: { currency?: string | null; tenant?: TenantProfile; decimals?: number } = {},
): string => {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  const t = opts.tenant ?? active;
  const currency = (opts.currency || t.settings.currency || 'AED').toUpperCase();
  // Currencies without cents (UGX, JPY…) never show decimals.
  let maxDigits = 2;
  try {
    maxDigits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch { /* unknown code — keep 2 */ }
  const decimals = Math.min(opts.decimals ?? (Number.isInteger(n) ? 0 : 2), maxDigits);
  try {
    // currencyDisplay 'code' → "AED 280" / "GBP 45", which reads the same in
    // every locale and matches how the dashboard has always shown prices.
    return new Intl.NumberFormat(t.settings.locale || 'en', {
      style: 'currency', currency, currencyDisplay: 'code',
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(n).replace(/ /g, ' ');
  } catch {
    return `${currency} ${n.toFixed(decimals)}`;
  }
};

export const formatDateTime = (
  value: string | number | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
  tenant: TenantProfile = active,
): string => {
  if (value === null || value === undefined || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(tenant.settings.locale || 'en', { timeZone: tenant.settings.timezone, ...opts }).format(d);
  } catch {
    return d.toLocaleString();
  }
};

/** Region choices for a picker; keeps a legacy/unknown current value selectable. */
export const regionOptions = (current?: string | null, tenant: TenantProfile = active): string[] => {
  const list = tenant.settings.regions ?? [];
  return current && !list.includes(current) ? [current, ...list] : list;
};

/** International form of a number typed in the tenant's country ("07700…" → "+447700…"). */
export const toInternationalPhone = (raw: string, tenant: TenantProfile = active): string => {
  const cc = tenant.settings.dial_code.replace(/\D/g, '');
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.startsWith(cc) && digits.length >= cc.length + 7) return `+${digits}`;
  if (digits.startsWith('0')) return `+${cc}${digits.slice(1)}`;
  return `+${cc}${digits}`;
};

/** wa.me number for the tenant, or null if they haven't given one. */
export const tenantWhatsApp = (tenant: TenantProfile = active): string | null => {
  const n = (tenant.branding.whatsapp || tenant.branding.support_phone || '').replace(/\D/g, '');
  return n.length >= 7 ? n : null;
};

// ------------------------------------------
// Companies' own domains
// ------------------------------------------
/** This page's hostname when it's a company's own domain, else null. */
export const customDomainHost = (): string | null => {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  return isPlatformHost(host, import.meta.env.VITE_PLATFORM_HOSTS ?? '') ? null : normalizeHost(host);
};

/** Where staff pages live when someone opens them on a company domain. */
export const platformUrl = (): string => import.meta.env.VITE_PLATFORM_URL || 'https://www.nokael.com';

const byDomain = new Map<string, Promise<TenantProfile | null>>();
export const fetchTenantByDomain = (host: string): Promise<TenantProfile | null> => {
  const key = normalizeHost(host);
  if (!byDomain.has(key)) {
    byDomain.set(key, (async () => {
      if (!supabase) return null;
      const { data, error } = await supabase.rpc('get_public_org_by_domain', { p_host: key });
      if (error) {
        byDomain.delete(key);
        throw error;
      }
      return data ? normalizeTenant(data) : null;
    })());
  }
  return byDomain.get(key)!;
};

/**
 * Base path for a tenant's public pages: '' for Nokael and on the company's
 * own domain (pages sit at the root there), '/c/<slug>' otherwise.
 */
export const tenantBasePath = (tenant: TenantProfile = active): string =>
  isDefaultTenant(tenant) || customDomainHost() ? '' : `/c/${tenant.slug}`;

/** Absolute link to a company's public site — its own domain once live. */
export const tenantPublicUrl = (tenant: TenantProfile = active): string =>
  tenant.custom_domain
    ? `https://${tenant.custom_domain}`
    : `${typeof window !== 'undefined' && !customDomainHost() ? window.location.origin : platformUrl()}/c/${tenant.slug}`;

/** wa.me link to the tenant's dispatch, or undefined when they have no number. */
export const waHref = (text?: string, tenant: TenantProfile = active): string | undefined => {
  const n = tenantWhatsApp(tenant);
  if (!n) return undefined;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};

export const telHref = (tenant: TenantProfile = active): string | undefined => {
  const n = (tenant.branding.support_phone || '').replace(/[^\d+]/g, '');
  return n ? `tel:${n}` : undefined;
};

/** Starting prices shown on the booking form, or null when the company hasn't set any. */
export const tenantPriceTiers = (tenant: TenantProfile = active): { sameDay: number; dedicated: number } | null => {
  const sameDay = Number(tenant.settings.price_same_day);
  const dedicated = Number(tenant.settings.price_dedicated);
  if (Number.isFinite(sameDay) && sameDay > 0) {
    return { sameDay, dedicated: Number.isFinite(dedicated) && dedicated > 0 ? dedicated : sameDay };
  }
  return null;
};

/** Pre-filled WhatsApp text for "open a business account", in the company's name. */
export const businessAccountWaMessage = (tenant: TenantProfile = active): string =>
  BUSINESS_ACCOUNT_WA_MESSAGE.replace(/Nokael/g, tenantDisplayName(tenant));

// ------------------------------------------
// <input type="datetime-local"> in the company's time zone
// ------------------------------------------
// Operators type wall-clock times for the company's own city, whatever zone
// their browser is in. DST-safe: the offset is looked up for the instant.
const zoneOffsetMs = (instant: number, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60000) * 60000;
};

/** ISO instant → "YYYY-MM-DDTHH:mm" in the company's zone. */
export const isoToZonedInput = (iso?: string | null, tenant: TenantProfile = active): string => {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  return new Date(t + zoneOffsetMs(t, tenant.settings.timezone)).toISOString().slice(0, 16);
};

/** "YYYY-MM-DDTHH:mm" typed in the company's zone → ISO instant. */
export const zonedInputToIso = (value: string, tenant: TenantProfile = active): string | null => {
  if (!value) return null;
  const wall = Date.parse(`${value}:00Z`);
  if (Number.isNaN(wall)) return null;
  const tz = tenant.settings.timezone;
  let t = wall - zoneOffsetMs(wall, tz);
  const second = zoneOffsetMs(t, tz);
  if (second !== wall - t) t = wall - second;
  return new Date(t).toISOString();
};
