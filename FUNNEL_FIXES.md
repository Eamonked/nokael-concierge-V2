# Local funnel fixes

Based on commit 3197182a8b98bd8d165923dbb0fc880afb6087cd. Nothing deployed.

## Changes

- Eleven distinct generated photographs now serve About, Services, Business Accounts, Dubai, Abu Dhabi, Documents, Spare Parts, Legal, Medical, HR and Finance. Each required photo variant has its own scene, localized illustrative alt text, and 768/1280-pixel local assets. Every page-to-photo mapping was verified in the browser. Other tenants do not inherit Nokael's business-account photo.

- Quote-page redesign: one sans-serif typeface, sentence-case labels, plain progress navigation, restrained buttons and a live route summary. Price guidance and next steps replace the decorative dispatch sidebar. Desktop and phone-width layouts were inspected; existing quote validation and saved-lead tracking remain in place.

- Public quote submissions are validated and saved by `/api/public/quotes` before returning success. Database errors fail visibly. A stable UUID prevents duplicate saves/notifications when retrying an uncertain response; altered retries receive a conflict rather than silently losing edits.
- Dispatcher quote notifications are generated from saved data on the server, with three bounded attempts and a timeout. The raw `/api/notify` route now requires a verified organization-member session and is restricted to Nokael's own organization. Browser-shipped shared keys cannot authorize it.
- Anonymous corporate/driver intake alerts reference recent saved records; callers cannot supply arbitrary notification text. Existing signed-in operational messages use session tokens.
- Explicit region selection, conservative address/region conflict checks on browser and server, address reset when region changes, and contact number validation.
- Scheduled pickup requires a future time. Optional delivery deadline must be future and after scheduled pickup. Inputs use the tenant time zone; saved instructions contain UTC instants.
- Thank-you page no longer fires conversions or redirects automatically. It honours phone/WhatsApp preference and contains no personal details in its URL.
- One data-layer event path, with session deduplication by saved lead ID. Phone/WhatsApp clicks and certificate requests remain engagement events. Personal contact details are excluded from analytics events.
- Coverage badges describe coverage, not real-time driver availability. Timing copy distinguishes transit after collection. Pricing-card WhatsApp links retain the selected service. Existing-account code is collapsed by default. Form checkboxes remain keyboard accessible.
- Geolocation is permitted for the same origin. Forwarded IPs are trusted only when the deployment explicitly configures proxy trust.
- Fixed the error-boundary prop type and phone-link event handler exposed by the type check.

## Before deployment

1. Apply `supabase-funnel-fixes.sql` to add `quote_requests.notes` if missing. Existing tenant/onboarding and quote-attribution migrations must already be installed, as required by the original application.
2. Ensure server-only `SUPABASE_SERVICE_ROLE_KEY` and `VITE_SUPABASE_URL` are configured. The service key must never use a `VITE_` prefix. Telegram needs server-only `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Configure `VITE_NOKAEL_ORG_ID` when overriding the default organization ID.
3. Update the published GTM container: fire one Google Ads lead conversion from `generate_lead`, use `transaction_id` for deduplication, disable `/thank-you` page-load conversions and redundant direct-tag rules. Keep `whatsapp_click`, `phone_call_click` and `sample_certificate_requested` secondary. Review automatic GA4 page-view settings to avoid duplicate SPA views.
4. Set `TRUST_PROXY_HOPS` only to the verified proxy hop count for the hosting topology. Without it, IP limits use the direct peer; behind a proxy this can group visitors together. Do not trust arbitrary forwarded headers.
5. Test an approved enquiry in a staging database, confirm dashboard receipt, verify a dispatcher notification and inspect the single conversion in Tag Assistant before enabling ads.

## Validation

- `npm run lint`
- `npm run test:funnel` (mock database; no production enquiry or Telegram message)
- `npm run build`
- Local browser: conflicting Dubai/Abu Dhabi address blocked; corrected route advances; scheduled pickup and deadline fields present; direct thank-you visit has no confirmed enquiry.

## Boundaries

The live database and published GTM container were not changed or verified. Notifications use bounded in-process retries, not a durable queue; the saved dashboard enquiry remains authoritative if a process exits or delivery fails. Generic intake-alert deduplication is per server process.

Legacy driver-document uploads still use the existing browser API-key mechanism. This work removes that key's authority over notifications; it does not redesign driver onboarding/upload authorization. Rotate the existing shared upload key as part of that separate migration, not before updating its callers.

Address matching catches explicit supported city/district contradictions; it does not prove a free-text address's administrative boundary. Unknown addresses remain usable and require dispatch confirmation. Starting prices remain published minimums, not route-based quotes.

## Dubai sales page
Route-specific offer now shows Dubai to Abu Dhabi, starting AED 350, availability caveats and prefilled WhatsApp enquiry. Added booking steps, clearly labelled illustrative delivery record and buyer FAQs. Removed simulated live status and instant-dispatch claims on this page. English and Arabic included. Mobile price and enquiry button verified within first viewport. Typecheck and production build passed; existing bundle warnings remain. Local changes only.

## Homepage sales update
Homepage now shares the focused sales layout with the Dubai page, with general two-way route copy and a generic delivery-details WhatsApp prefill. Preserved the branded home photo. Added both route links and a business-account enquiry link. Replaced long repeated feature/pricing sections and unsupported dispatch-speed claims with the starting price, booking steps, illustrative record and buyer FAQs. English and Arabic included.

Document delivery page now uses the focused sales layout with document-specific copy, FAQs and WhatsApp prefill in English and Arabic. Retains its distinct document photo. Removes simulated live status and instant-dispatch claims.
