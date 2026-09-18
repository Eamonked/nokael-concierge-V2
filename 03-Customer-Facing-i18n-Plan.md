# Nokael Website — Customer-Facing i18n Plan

**Companion to:** `01-Refactor-Plan-Files.md` / `02-Refactor-Steps-Exact.md`.

**Status check that motivated this doc (2026-09-18):** the structural split described in `01`/`02` for `Track.tsx`, `GetQuote.tsx`, `DriverApplication.tsx`, and `BusinessAccountInquiry.tsx` is **already done** — confirmed against the actual `src/pages/{track,get-quote,driver-application,business-inquiry}/` directories, which match the target file lists exactly. i18n for those four is also done through Phase 5 (`en`/`ar` populated for `getQuote`, `driverApplication`, `businessInquiry`, `tracking`). Two items from that plan remain open and are carried into this one:
- **Phase 5.4 (WhatsApp A/B decision)** — still unresolved in code; the `⚠ Pending WhatsApp-language decision (A/B)` comments are still present verbatim in `useQuoteForm.ts` and `useBusinessInquiryForm.ts`.
- **Phase 6 (delete `Dashboard.tsx.bak`)** — not done; the 183 KB stale file is still in `src/pages/`.

**Scope of this doc:** the remaining customer-facing, public (no-login) pages that are **not** part of `01`/`02` — confirmed to be pure view/markup with no Dashboard-style mixed data-model-and-logic shape, so none of them need a structural split. What they need is i18n, brought up to the same bilingual (en/ar) standard as the four wizard pages.

**Files covered:** `Home.tsx`, `LandingPages.tsx` (4 exports: `DubaiLanding`, `AbuDhabiLanding`, `DocumentLanding`, `SparePartsLanding`), `Services.tsx`, `About.tsx`, `Thankyou.tsx`, `NotFound.tsx`, `Legal.tsx` (2 exports: `TermsAndConditions`, `PrivacyPolicy`).

**Not covered:** internal/staff-only pages (`Dashboard.tsx`, `Login.tsx`, `AcceptInvite.tsx`, `ResetPassword.tsx`) and `DriverApplication.tsx`/`BusinessAccountInquiry.tsx`/`GetQuote.tsx`/`Track.tsx` (already handled by `01`/`02`).

---

## Phase 7 — Resolve the WhatsApp-language decision, apply everywhere it's flagged

This blocks Phase 9 onward, because `Home.tsx` turns out to be a major consumer of the same fixed-language WhatsApp constants the original plan flagged.

1. Pick **(A)** fixed language (presumably English, since that's what dispatch reads) or **(B)** localized to site language.
2. Apply to the three spots already flagged in `01`/`02` but not yet resolved:
   - `useQuoteForm.ts` — inline quote-request WA message template.
   - `useBusinessInquiryForm.ts` + `InquirySidebar.tsx` — both usages of `BUSINESS_ACCOUNT_WA_MESSAGE`.
   - `Track.tsx`'s three spots: `waSupportText`, `contextualWaMsg` (4 variants), quote-followup message in `TrackQuoteResult`.
3. Apply to the **newly found** spots in `Home.tsx` — not previously flagged anywhere:
   - `Hero` — `DEFAULT_WA_MESSAGE`.
   - `ServiceCards` — `DEFAULT_WA_MESSAGE` (used per-card, `same-day` and `dedicated`).
   - `FinalAction` — `DEFAULT_WA_MESSAGE`.
4. While in `Home.tsx`'s `BusinessAccounts` component: it currently builds `waUrl` from `BUSINESS_ACCOUNT_WA_MESSAGE` but never uses it — the actual CTA is `<Link to="/business-account">`. Either wire `waUrl` into an actual WhatsApp CTA or delete the dead variable. This is a cleanup, not an i18n step, but do it in this phase since you're already touching this exact area of the file.
5. Grep the whole `src/` tree for `DEFAULT_WA_MESSAGE` and `BUSINESS_ACCOUNT_WA_MESSAGE` once more after this phase, to confirm no other call site exists beyond the ones listed above (in particular, confirm `LandingPages.tsx` genuinely has none, rather than relying on an earlier read).

---

## Phase 8 — Quick wins: `NotFound.tsx`, and confirm/retire `ResetPassword.tsx`

Do this first — smallest file, no forms, no risk, a fast proof-point that the `t()`-wiring pattern still works the same way on a plain page.

1. `NotFound.tsx` (1.7 KB): four hardcoded strings ("404", "Page Not Found", the explanation paragraph, "Go Home", "Request Delivery"). Add `useTranslation('notFound')`, wire all four, create `notFound.json` (en/ar).
2. Separately (not i18n): `ResetPassword.tsx` has **no route** pointing to it in `App.tsx` — `AcceptInvite.tsx`'s own comments confirm it now handles both invite and recovery links. Confirm this is genuinely dead code, then delete it alongside `Dashboard.tsx.bak` (Phase 6 of the original plan) in one housekeeping commit.

---

## Phase 9 — `Home.tsx`

Highest-traffic page (site root), and the most complex file left — 9 sub-components: `Hero`, `TrustBar`, `Differentiators`, `SupportingSection`, `ServiceCards`, `BusinessAccounts`, `CorridorStatus`, `TrustGrounded`, `FinalAction`. Do this immediately after Phase 7 so the WA decision is already settled when you reach the three CTA spots.

1. Create `home.json` (en/ar) organized by component: `hero.*`, `trustBar.*`, `differentiators.*`, `supportingSection.*`, `serviceCards.*`, `businessAccounts.*`, `corridorStatus.*`, `trustGrounded.*`, `finalAction.*`.
2. `TrustBar` and `CorridorStatus` render from local data arrays (`stats`, `corridors`) — same pattern Phase 5.1 used on `statusConfig.ts`: convert `label`/`context` fields to key names (e.g. `labelKey: 'trustBar.dispatch.label'`) rather than leaving literal strings in the array, so the array itself can stay a plain data structure outside the translated render.
3. `Differentiators` and `SupportingSection` also map over local arrays (`title`/`desc` per item) — same key-conversion treatment.
4. `ServiceCards`' two pricing tiers (`SAME-DAY`, `DEDICATED`) have a `features[]` array each — becomes `serviceCards.sameDay.features.0..5` / `serviceCards.dedicated.features.0..4`, or a nested array key if the i18n setup handles arrays cleanly (check how `tracking.json`'s milestone steps were structured in Phase 5 and stay consistent).
5. `TrustGrounded`'s italic quote block and three labeled sub-sections ("Personal emergencies", "Tenders and filings", "Machinery and parts") are copy, not data — straightforward `t()` calls.
6. Wire the three WA-message CTAs per the Phase 7 decision.
7. Populate `common.json` (en/ar) — currently `{}` on both sides — with shared chrome strings if `Home.tsx` is the first page to need them (nav-adjacent labels, generic button text). Doing this now avoids retrofitting `common.json` later once several pages already have ad-hoc duplicate keys for the same shared strings.

---

## Phase 10 — `LandingPages.tsx`

The four routes here (`/urgent-delivery-dubai`, `/urgent-delivery-abu-dhabi`, `/document-delivery-uae`, `/spare-parts-delivery-uae`) are paid-traffic/SEO landing destinations — likely the highest-value pages to have in Arabic, since ad clicks land directly here rather than via the homepage. Sequenced right after `Home.tsx` for that reason, ahead of the lower-traffic static pages in Phase 11.

1. One shared `LandingTemplate` renders all four — localize its static chrome once into `landingPages.json`: breadcrumb labels ("Home", "Services"), "Instant Dispatch" / "WhatsApp Dispatch", the trust-bar strip ("Trusted for:", "Legal & Finance", etc.), "Operational Overview", the SLA card's four headings + descriptions, "What Clients Use This For" + its paragraph, "Corridor Performance" + "Live Corridor Data • Subject to Traffic", "Need it Now?" + its paragraph, "Other Services".
2. The four thin exports each pass `title` / `subtitle` / `content: string[]` as props to `LandingTemplate` — these become per-page key groups, e.g. `dubai.title`, `dubai.subtitle`, `dubai.content.0`, `dubai.content.1`, `dubai.content.2` (repeat for `abuDhabi`, `document`, `spareParts`).
3. The corridor-performance list (`from`/`to`/`time` per route) and the "Other Services" cross-link list (`name`/`path`) are local data arrays inside `LandingTemplate` — same key-conversion treatment as Phase 9 step 2.
4. Note for whoever implements this: the "Other Services" list filters `s.path !== window.location.pathname` to avoid linking a page to itself — that logic is untouched by i18n; don't mistake it for something needing a translation key.
5. No WA-message dependency in this file (confirmed in Phase 7 step 5's grep) — CTAs link to plain `https://wa.me/${WHATSAPP_NUMBER}` with no pre-filled text.

---

## Phase 11 — `Services.tsx` + `About.tsx`

Bundled together: both are static marketing content, each with one small local sub-component (`ServiceCard`, `StatCard`), no forms, no state machines, lower traffic than Home/landing pages.

### 11.1 — `Services.tsx`
- `services.json`: hero copy ("What We Do", "When It Can't Wait.", intro paragraph), the 3-service array (`title`/`desc`/`features[]` for Urgent Inter-Emirate, Document & Legal, Spare Parts Logistics), the "UAE Express Logistics Expertise" section (2 sub-blocks + pull-quote), final CTA ("Send it today.", "Get Instant Quote", "WhatsApp Dispatch").

### 11.2 — `About.tsx`
- `about.json`: hero copy ("The Nokael Mission", "Logistics at the Speed of Trust.", intro), 3 `StatCard`s (Efficiency/Response/Velocity), "The Anti-Courier Operational Model" section (3 bullets: No Waiting Around / One Driver, One Job / Ironclad Accountability), the "Basics, Covered" checklist (4 items) + its closing pull-quote, "Who We Work With" + 4 industry cards, final CTA.

---

## Phase 12 — `Thankyou.tsx`

Small (3.6 KB, one `useEffect`), but it's the last thing a customer sees before being redirected to WhatsApp — worth translating even though it's low-effort.

1. `thankyou.json`: "Request Logged.", the confirmation paragraph, "Connect with Dispatcher", the footer note ("Open WhatsApp to complete the booking.").
2. No WA-decision dependency here — this page only relays the `?wa=` param already built by whichever upstream wizard sent the customer here; nothing to wire per Phase 7.

---

## Phase 13 — `Legal.tsx` (Terms & Privacy)

Deliberately last, and flagged as a judgment call rather than a mechanical `t()` pass — a mistranslated liability or cancellation clause carries more risk than a mistranslated CTA. Decide one of:
- **(A)** Keep Terms/Privacy English-only regardless of site language (a common pattern on bilingual UAE sites — link the same English doc from both language versions), or
- **(B)** Get both documents professionally translated (not machine-translated inline) before wiring them the same way as everything else.

Do not fold this into Phase 11's pass — it needs its own sign-off given the legal content.

---

## Phase 14 — Housekeeping / cross-cutting check

1. `grep -rn "left-\|right-\|ml-\|mr-\|pl-\|pr-" src/pages/Home.tsx src/pages/LandingPages.tsx src/pages/Services.tsx src/pages/About.tsx src/pages/Thankyou.tsx src/pages/NotFound.tsx` — same logical-property (RTL-safety) check the original plan ran on the wizard files after their phases.
2. `App.tsx`'s `TitleManager` sets the browser tab title from `SEO_METADATA` keyed by pathname — decide whether tab titles need per-language variants too, or whether an English tab title is acceptable while page content is Arabic. Not part of any phase above; flagging now so it isn't discovered late.
3. Confirm `common.json` (en/ar) is filled in by this point (seeded in Phase 9, likely added to by later phases) rather than left as `{}`.
4. Run the full site end-to-end in Arabic once Phases 7–13 are complete — not just per-phase — the same caveat the original plan's Phase 5.5 gave for `Track.tsx`: some layout issues (e.g. `Home.tsx`'s asymmetric grids, `LandingPages.tsx`'s two-column layout with the sticky sidebar card) only surface once everything is switched to RTL simultaneously.
5. Once Phase 8's `ResetPassword.tsx` check is confirmed and Phase 6 of the original plan is done, this is a good point to also delete `Dashboard.tsx.bak` and `ResetPassword.tsx` together in one commit, since both are now confirmed-dead files sitting in `src/pages/`.
