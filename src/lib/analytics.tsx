/**
 * analytics.ts
 *
 * Handles:
 *  1. UTM parameter capture from the URL into sessionStorage
 *  2. Retrieving stored UTMs to append to Supabase leads
 *  3. Firing Google Ads conversion events via gtag
 *  4. Tracking WhatsApp link clicks as conversions
 *
 * Setup required in index.html:
 *  - GTM snippet (see index.html)
 *  - Set VITE_GADS_CONVERSION_ID and VITE_GADS_CONVERSION_LABEL in .env
 */

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

// ─── gtag Helper ─────────────────────────────────────────────────────────────

/**
 * Ensures gtag is available. Useful if the script hasn't fully loaded or is
 * loaded asynchronously.
 */
function getGtagId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  // If it already has a prefix (GT-, G-, AW-, GTM-), return as is
  if (/^[A-Z0-9]+-/.test(id)) return id;
  // Default to AW- for numeric IDs
  return `AW-${id}`;
}

/**
 * Safe wrapper around gtag and dataLayer — no-ops if they haven't loaded yet.
 * Standardizes event firing for both gtag.js and GTM.
 */
function pushEvent(eventName: string, params: Record<string, any> = {}): void {
  if (typeof window === 'undefined') return;

  // 1. Fire via gtag (if available)
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }

  // 2. Fire via dataLayer for GTM
  if (window.dataLayer) {
    window.dataLayer.push({
      event: eventName,
      ...params
    });
  }
}

// ─── Conversion Events ───────────────────────────────────────────────────────

/**
 * Fire when the GetQuote form is successfully submitted to Supabase.
 * This is your primary Google Ads conversion action.
 */
export function trackFormSubmission(userData?: UserData): void {
  const rawId = import.meta.env.VITE_GADS_CONVERSION_ID;
  const conversionId = getGtagId(rawId);
  const conversionLabel = import.meta.env.VITE_GADS_CONVERSION_LABEL;

  if (conversionId && conversionLabel) {
    if (typeof window.gtag === 'function') {
      console.log(`[Analytics] Firing Google Ads Conversion: ${conversionId}/${conversionLabel}`);
      window.gtag('event', 'conversion', {
        send_to: `${conversionId}/${conversionLabel}`,
        user_data: userData,
      });
    } else {
      console.warn('[Analytics] gtag.js not found. Conversion event queued in dataLayer only.');
    }
  }

  // Fire generic lead event for GTM/GA4
  pushEvent('generate_lead', {
    event_category: 'quote_form',
    event_label: 'form_submitted',
    user_email: userData?.email,
    user_phone: userData?.phone_number,
    user_data: userData, // For GTM Enhanced Conversions
  });
}

/**
 * Fire when any WhatsApp CTA is clicked.
 */
export function trackWhatsAppClick(source: string = 'unknown', userData?: UserData): void {
  const rawId = import.meta.env.VITE_GADS_CONVERSION_ID;
  const conversionId = getGtagId(rawId);
  const waLabel = import.meta.env.VITE_GADS_WA_CONVERSION_LABEL;

  if (conversionId && waLabel) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', {
        send_to: `${conversionId}/${waLabel}`,
        user_data: userData,
      });
    }
  }

  // Fire generic whatsapp click event for GTM/GA4
  pushEvent('whatsapp_click', {
    event_category: 'engagement',
    event_label: source,
  });
}

/**
 * Fires a virtual page view event for the SPA.
 * Useful for GTM triggers and GA4 tracking.
 */
export function trackPageView(path: string): void {
  const gtmId = 'GTM-T27LXT6W';
  
  // Update dataLayer for GTM to detect route change
  if (window.dataLayer) {
    window.dataLayer.push({
      event: 'page_view',
      page_path: path,
      page_title: document.title,
    });
  }

  // Also fire via gtag if configured
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: document.title,
      send_to: gtmId,
    });
  }
}

/**
 * Fire when the phone number is clicked.
 */
export function trackPhoneClick(source: string = 'header'): void {
  pushEvent('phone_call_click', {
    event_category: 'engagement',
    event_label: source,
  });
}
