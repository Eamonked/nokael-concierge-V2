/** Attribution and non-personal GTM events. Configure generate_lead once in GTM. */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserData {
  email?: string;
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  address?: {
    first_name?: string;
    last_name?: string;
    street?: string;
    city?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
}

export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string; // Google Click ID — critical for Google Ads attribution
}

// Extend Window so TypeScript knows gtag exists
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

// ─── UTM Capture ─────────────────────────────────────────────────────────────

const UTM_STORAGE_KEY = 'nokael_utms';

/**
 * Call this once on app load (e.g. in main.tsx or App.tsx useEffect).
 * Reads UTM params + gclid from the URL and saves them to sessionStorage.
 * Only overwrites if new UTM params are present in the current URL so that
 * navigating between pages doesn't erase the original ad attribution.
 */
export function captureUTMs(): void {
  const params = new URLSearchParams(window.location.search);
  const keys: (keyof UTMParams)[] = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid'
  ];

  const fresh: UTMParams = {};
  keys.forEach(key => {
    const val = params.get(key);
    if (val) fresh[key] = val;
  });

  // Only write if this URL actually has UTM data
  if (Object.keys(fresh).length > 0) {
    try {
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // sessionStorage unavailable (e.g. private browsing restrictions) — silently ignore
    }
  }
}

/**
 * Returns the UTM params captured earlier in the session.
 * Returns an empty object if none were captured.
 */
export function getStoredUTMs(): UTMParams {
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// One event path: GTM consumes queued data-layer events.
function pushEvent(eventName: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...params });
}
export function trackSavedQuote(leadId: string): void {
  const key = 'nokael_conversion_' + leadId;
  try {
    if (sessionStorage.getItem(key)) return;
    pushEvent('generate_lead', { event_category: 'quote_form', lead_id: leadId, transaction_id: leadId });
    sessionStorage.setItem(key, '1');
  } catch { /* No duplicate-prone fallback if browser storage is unavailable. */ }
}
// Certificate downloads are engagement, not quote conversions. Never forward PII.
export function trackFormSubmission(_userData?: UserData): void {
  pushEvent('sample_certificate_requested', { event_category: 'engagement' });
}
export function trackWhatsAppClick(source: string = 'unknown', _userData?: UserData): void {
  pushEvent('whatsapp_click', { event_category: 'engagement', event_label: source });
}
export function trackPageView(path: string): void {
  pushEvent('page_view', { page_path: path, page_title: document.title });
}
export function trackPhoneClick(source: string = 'header'): void {
  pushEvent('phone_call_click', { event_category: 'engagement', event_label: source });
}
