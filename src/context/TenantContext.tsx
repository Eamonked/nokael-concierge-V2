import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  NOKAEL_TENANT,
  getActiveTenant,
  setActiveTenant,
  subscribeTenant,
  fetchPublicTenant,
  fetchTenantByDomain,
  customDomainHost,
  type TenantProfile,
} from '../lib/tenant';

/** The active tenant; re-renders when it changes. */
export function useTenant(): TenantProfile {
  return React.useSyncExternalStore(subscribeTenant, getActiveTenant, getActiveTenant);
}

// Paths where the signed-in member's org is the tenant (set by
// useDashboardData / the onboarding page, not by the URL).
const MEMBER_PATHS = ['/dashboard', '/admin', '/onboarding'];

/**
 * Keeps the active tenant in step with the URL for public pages. Pages under
 * /c/<slug> get that org; member pages are left to the dashboard; every other
 * page is Nokael's own site.
 */
export function TenantUrlSync() {
  const { pathname } = useLocation();

  React.useEffect(() => {
    // On a company's own domain the whole app is that company (TenantPublic).
    if (customDomainHost()) return;
    if (MEMBER_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))) return;
    const match = pathname.match(/^\/c\/([a-z0-9-]+)/i);
    if (!match) {
      setActiveTenant(NOKAEL_TENANT);
      return;
    }
    // /c/<slug> pages resolve the org themselves (TenantPublicRoutes) so they
    // can show a not-found state; nothing to do here.
  }, [pathname]);

  return null;
}

export type TenantLoadState =
  | { status: 'loading' }
  | { status: 'ready'; tenant: TenantProfile }
  | { status: 'missing' }
  | { status: 'error'; message: string };

/** Resolve /c/<slug> — or a company domain — and make it the active tenant. */
export function usePublicTenant(slug: string | undefined, domain?: string | null): TenantLoadState {
  const [state, setState] = React.useState<TenantLoadState>({ status: 'loading' });

  React.useEffect(() => {
    let alive = true;
    if (!slug && !domain) {
      setState({ status: 'missing' });
      return;
    }
    setState({ status: 'loading' });
    (domain ? fetchTenantByDomain(domain) : fetchPublicTenant(slug!))
      .then(tenant => {
        if (!alive) return;
        if (!tenant) {
          setState({ status: 'missing' });
          return;
        }
        setActiveTenant(tenant);
        setState({ status: 'ready', tenant });
      })
      .catch(err => alive && setState({ status: 'error', message: err?.message ?? 'Could not load this company.' }));
    return () => { alive = false; };
  }, [slug, domain]);

  return state;
}
