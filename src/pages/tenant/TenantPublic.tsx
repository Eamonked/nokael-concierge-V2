import React, { Suspense, lazy } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';
import { MessageSquare, Phone, Package, Navigation, Truck, Building2, Loader2 } from 'lucide-react';
import { usePublicTenant } from '../../context/TenantContext';
import { tenantDisplayName, tenantBasePath, waHref, telHref, type TenantProfile } from '../../lib/tenant';
import { ThemeToggle } from '../../components/ThemeToggle';
import { LanguageToggle } from '../../components/LanguageToggle';

// Same page components as Nokael's own site; they read the active tenant
// (set by usePublicTenant below) for org id, regions, currency and contacts.
const GetQuote = lazy(() => import('../GetQuote'));
const Track = lazy(() => import('../Track'));
const DriverApplication = lazy(() => import('../DriverApplication'));
const BusinessAccountInquiry = lazy(() => import('../BusinessAccountInquiry'));
const Thankyou = lazy(() => import('../Thankyou'));

const Loader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-brand-neon" />
  </div>
);

/**
 * /c/:slug/* — a company's public booking site on the platform:
 *   /c/acme                   landing (book, track, drive, business account)
 *   /c/acme/get-quote         booking form
 *   /c/acme/track[/:id]       tracking
 *   /c/acme/apply-driver      driver sign-up
 *   /c/acme/business-account  business-account inquiry
 *
 * With `domain` (the company's own domain, e.g. book.acme.ug) the same pages
 * are served at the root: /, /get-quote, /track…
 */
export default function TenantPublic({ domain }: { domain?: string | null }) {
  const { slug } = useParams();
  const state = usePublicTenant(domain ? undefined : slug, domain);

  if (state.status === 'loading') return <Loader />;
  if (state.status !== 'ready') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center bg-brand-bg">
        <div className="max-w-sm space-y-3">
          <h1 className="text-2xl font-display font-medium">
            {state.status === 'missing' ? 'Company not found' : 'Something went wrong'}
          </h1>
          <p className="text-sm text-brand-muted">
            {state.status === 'missing'
              ? domain
                ? 'This domain isn’t connected to a delivery company yet. If it’s yours, finish connecting it in your dashboard.'
                : 'This booking link is not active. Check the link with the company that sent it.'
              : state.message}
          </p>
        </div>
      </div>
    );
  }

  const tenant = state.tenant;
  return (
    <TenantLayout tenant={tenant}>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route index element={<TenantHome tenant={tenant} />} />
          <Route path="get-quote" element={<GetQuote />} />
          <Route path="track" element={<Track />} />
          <Route path="track/:trackingId" element={<Track />} />
          <Route path="apply-driver" element={<DriverApplication />} />
          <Route path="business-account" element={<BusinessAccountInquiry />} />
          <Route path="thank-you" element={<Thankyou />} />
          <Route path="*" element={<TenantHome tenant={tenant} />} />
        </Routes>
      </Suspense>
    </TenantLayout>
  );
}

function TenantLayout({ tenant, children }: { tenant: TenantProfile; children: React.ReactNode }) {
  const name = tenantDisplayName(tenant);
  React.useEffect(() => {
    document.title = `${name} · Book & track deliveries`;
  }, [name]);
  const base = tenantBasePath(tenant);
  const accent = tenant.branding.primary_color;
  const wa = waHref(undefined, tenant);
  const tel = telHref(tenant);

  return (
    <div
      className="min-h-screen flex flex-col bg-brand-bg"
      // The company's colour replaces Nokael's green on buttons and accents.
      style={accent ? ({ '--nk-neon': accent, '--color-brand-neon': accent } as React.CSSProperties) : undefined}
    >
      <header className="sticky top-0 z-50 bg-brand-bg/85 backdrop-blur-md border-b border-brand-border">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to={base || '/'} className="flex items-center gap-3 min-w-0">
            {tenant.branding.logo_url ? (
              <img src={tenant.branding.logo_url} alt="" className="h-9 w-9 rounded object-contain" referrerPolicy="no-referrer" />
            ) : (
              <span className="h-9 w-9 rounded bg-brand-neon text-brand-bg font-bold flex items-center justify-center">
                {name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="font-display text-lg font-medium truncate">{name}</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4 text-sm font-semibold">
            <Link to={`${base}/track`} className="hidden sm:inline text-brand-muted hover:text-brand-neon">Track</Link>
            <Link to={`${base}/get-quote`} className="btn-primary px-4 py-2 text-xs">Book</Link>
            <LanguageToggle />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="flex-grow">{children}</main>

      <footer className="border-t border-brand-border py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-4 justify-between text-xs text-brand-muted">
          <div className="flex flex-wrap gap-4">
            {tel && <a href={tel} className="inline-flex items-center gap-1.5 hover:text-brand-neon"><Phone className="w-3.5 h-3.5" />{tenant.branding.support_phone}</a>}
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-brand-neon"><MessageSquare className="w-3.5 h-3.5" />WhatsApp</a>}
            {tenant.branding.support_email && <a href={`mailto:${tenant.branding.support_email}`} className="hover:text-brand-neon">{tenant.branding.support_email}</a>}
          </div>
          <p>© {new Date().getFullYear()} {name} · Powered by Nokael</p>
        </div>
      </footer>
    </div>
  );
}

function TenantHome({ tenant }: { tenant: TenantProfile }) {
  const name = tenantDisplayName(tenant);
  const base = tenantBasePath(tenant);
  const cards = [
    { to: `${base}/get-quote`, icon: Package, title: 'Book a delivery', body: 'Tell us the pickup, drop-off and item. We confirm the price and assign a driver.' },
    { to: `${base}/track`, icon: Navigation, title: 'Track a delivery', body: 'Enter your tracking number to see live status and proof of delivery.' },
    { to: `${base}/business-account`, icon: Building2, title: 'Business account', body: 'Regular deliveries, monthly invoicing and a client portal for your team.' },
    { to: `${base}/apply-driver`, icon: Truck, title: `Drive with ${name}`, body: 'Apply to join our driver team. We review every application personally.' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-16 sm:py-24">
      <h1 className="text-4xl sm:text-5xl font-display font-medium tracking-tight max-w-2xl">
        {name} deliveries, booked in minutes.
      </h1>
      <p className="mt-4 text-brand-muted max-w-xl">
        Book, track and confirm every hand-over with a secure chain of custody.
      </p>
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {cards.map(({ to, icon: Icon, title, body }) => (
          <Link key={to} to={to} className="dispatch-card p-6 hover:border-brand-neon transition-colors">
            <Icon className="w-6 h-6 text-brand-neon" />
            <h2 className="mt-4 text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-brand-muted">{body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
