# Onboarding a company onto the platform

## One-time: go live with multi-country support
1. Apply `supabase-tenant-onboarding.sql` to the live project (hhgzxpuzsbqirmbsiltn). It's additive only: Nokael keeps its UAE profile, AED, Asia/Dubai time and NOK- job refs.
2. Deploy the concierge site (nokael.com) and the confirmation portal (coc.nokael.com: portal, driver app, client portal).
3. Optional: set `VITE_DRIVER_APP_URL` if the Android APK link isn't `https://coc.nokael.com/android`.

## Each new company (about 2 minutes on our side)
1. Dashboard → **Settings → Companies → Add a company**. Enter the name, country, owner email and booking link (e.g. `acme-couriers`).
2. This creates the company with its country's currency, time zone, phone format, tax and regions. It also emails the owner an invite and shows a **setup link**. Send that link on WhatsApp too.
3. The owner sets a password and lands in **/onboarding**, which has six steps:
   - Company (required)
   - Brand
   - Starting prices
   - Team invites
   - Driver links
   - Go live: booking link, website button and API key

   Progress is saved at every step. If the owner stops partway, they're sent back to setup the next time they log in, until they finish.
4. The company's customers book at `nokael.com/c/<slug>`. Drivers sign up at `nokael.com/c/<slug>/apply-driver` and use the same driver app. Tracking links, custody PDFs and the client portal show the company's name, time zone and dispatch number.

## What each company gets
| | Where it's set |
|---|---|
| Currency, time zone, phone code, tax, regions, job-ref prefix | `organizations.settings` (country preset, then editable) |
| Name, logo, colour, support phone / WhatsApp / email | `organizations.branding` |
| Staff access | `org_members` (owner / admin / operator / viewer) |
| API access | `issue_api_key` RPC; header `x-nokael-pool-key` on `/api/pool/*` |

`settings` and `branding` are shown publicly, so never put secrets in them.

## Known limits (today)
- One company per login. Use a different email for each company's owner.
- Driver document uploads go to Nokael's Google Drive folder.
- The Telegram lead alerts are Nokael-only. Other companies get staff push notifications.
- The UI is in English and Arabic only.
- Supabase invite and reset emails use the shared (Nokael) email template.
- All companies share one database region.

## Uganda preset
- Currency UGX (whole shillings, shown as "UGX 25,000"), time zone Africa/Kampala (UTC+3), phone code +256. A local number like "0772 123456" is stored as +256772123456.
- VAT 18%. Areas start with Kampala, Wakiso, Entebbe and Mukono, then other major towns. The owner can edit the list during setup.
- Drivers upload their "National ID (NIN)". The licence text reads "Valid Ugandan driving license".
- Address search is limited to Uganda. Street addresses there are often informal, so ask customers and drivers to use "Use my current location" or drop a pin.
- Not built: mobile-money payment (MTN MoMo / Airtel Money). Prices are recorded per job, and collecting payment happens outside the system.

## Companies' own domains (e.g. book.theircompany.ug)
They serve the company's booking, tracking, driver sign-up and business-account pages at the root of their own domain, with only their branding and none of Nokael's Google tags. Staff pages (`/dashboard`, `/login`, `/onboarding`) always redirect to nokael.com.

### One-time Cloudflare setup (nokael.com zone)
1. **SSL/TLS → Custom Hostnames**: enable Cloudflare for SaaS. The first 100 hostnames are free, but a payment method must be on file.
2. **DNS**: add `customers.nokael.com`, proxied (orange cloud), pointing at the same origin as `www.nokael.com`. Set it as the **fallback origin** on the Custom Hostnames page.
3. **Rules** (only if the origin needs its own Host header, e.g. Cloud Run or Render):
   - **Origin Rule**: for custom hostnames, override the Host header to the origin's own hostname.
   - **Transform Rule** (modify request header): set `X-Tenant-Host` to `http.host`. The server reads it to find the company.
4. **API token**: Zone → *SSL and Certificates: Edit* for nokael.com. Then set these on the server:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ZONE_ID`
   - `CLOUDFLARE_SAAS_CNAME_TARGET=customers.nokael.com`
5. Optional:
   - `PLATFORM_HOSTS`: more hostnames that are Nokael's own, e.g. a staging domain. Comma-separated.
   - `VITE_PLATFORM_URL`: where staff pages redirect to. Defaults to https://www.nokael.com.
6. Apply `supabase-custom-domains.sql`.

Without the API token, domains still work, but you add each hostname by hand in Cloudflare and click **Mark live** in Settings → Companies.

### Per company
1. The owner enters `book.theircompany.ug` in setup (Go live) or in Settings → Your own domain.
2. They add one DNS record: `CNAME book → customers.nokael.com`. If their DNS is on Cloudflare, it must be "DNS only" (grey cloud).
3. Cloudflare verifies it and issues HTTPS, usually within 30 minutes. The dashboard re-checks every 20 seconds and shows "Live".

### Test locally
Open `http://book-test.localhost:3000`: any `*.localhost` name is treated as a company domain.

### Still on Nokael's domains
- The chain-of-custody confirmation and tracking links sent to customers use `coc.nokael.com`.
- Supabase invite and reset emails use Nokael's template.
- Dashboard login is on nokael.com.

Only bare subdomains are supported (not `theircompany.ug` itself). The bare domain usually hosts their own website and email, and Cloudflare for SaaS needs a CNAME.
