/**
 * SINGLE-TENANT ORG ID
 * Nokael is currently the only tenant in the multi-tenant schema (see
 * public.organizations). Every INSERT into an org-scoped table
 * (quote_requests, business_inquiries, jobs, drivers, driver_documents)
 * MUST set organization_id, or the org_members_manage_* RLS policies
 * (which check is_org_member(organization_id)) will reject the row for
 * everyone — including the org owner — because organization_id = NULL
 * never satisfies an equality check.
 *
 * When Nokael's driver-pool becomes multi-tenant for real, replace this
 * with a per-request lookup (getCurrentUserOrg() for authenticated writes,
 * a resolved-by-domain/API-key value for public writes) instead of a
 * hardcoded constant.
 */
export const NOKAEL_ORG_ID =
  import.meta.env.VITE_NOKAEL_ORG_ID || '89412cf2-dd3a-447c-906a-e59aaa64926d';

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

