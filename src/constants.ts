/**
 * GLOBAL BUSINESS CONTACT DATA
 * Use these constants to update the phone/WhatsApp numbers sitewide.
 * This ensures consistency for B2B branding and lead attribution.
 */
export const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '971509710446';
export const PHONE_NUMBER = import.meta.env.VITE_PHONE_NUMBER || '+971509710446';
export const DISPLAY_PHONE = import.meta.env.VITE_DISPLAY_PHONE || '+971 50 971 0446';

export const DEFAULT_WA_MESSAGE = `Hi Nokael, I need an urgent delivery.
Pickup:
Dropoff:
Item:
Delivery deadline:
Business or personal:`;

export const BUSINESS_ACCOUNT_WA_MESSAGE = `Hi, I’d like to open a business account with Nokael.
Company name:
Typical delivery type:
Typical route:
Estimated monthly delivery volume:
Best contact person:`;

// PRICING CONSTANTS
export const PRICE_TIER_NEXT_MORNING = Number(import.meta.env.VITE_PRICE_TIER_NEXT_MORNING) || 280;
export const PRICE_TIER_SAME_DAY = Number(import.meta.env.VITE_PRICE_TIER_SAME_DAY) || 280;
export const PRICE_TIER_DEDICATED = Number(import.meta.env.VITE_PRICE_TIER_DEDICATED) || 380;

