import { supabase } from './supabase';
import type { OrgRole } from './team';

// ==========================================
// Company onboarding API (client side of routes/onboarding.ts)
// ==========================================

export interface OnboardingMe {
  org: { id: string; name: string; slug: string; plan: string; is_active: boolean; settings: any; branding: any };
  role: OrgRole;
  isPlatformAdmin: boolean;
  publicUrl: string;
  checklist: Record<'company' | 'contact' | 'branding' | 'team' | 'drivers' | 'api' | 'completed', boolean>;
}

export interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  created_at: string;
  country: string | null;
  currency: string | null;
  onboarding_completed_at: string | null;
  members: number;
  custom_domain: string | null;
  custom_domain_status: 'pending' | 'active' | 'error' | null;
  public_url: string;
}

export interface CreateCompanyInput {
  name: string;
  country: string;
  owner_email: string;
  owner_name?: string;
  slug?: string;
  plan?: 'trial' | 'standard' | 'enterprise';
}

export interface CreateCompanyResult {
  company: { id: string; name: string; slug: string };
  owner: { email: string; existing: boolean };
  setup_link: string | null;
  public_url: string;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!supabase) throw new Error('Supabase not configured.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated.');
  const res = await fetch(`/api/onboarding${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status}).`);
  return json as T;
}

export const getOnboardingMe = () => call<OnboardingMe>('/me');

export const listCompanies = () => call<{ companies: CompanyRow[] }>('/companies').then(r => r.companies);

export const createCompany = (input: CreateCompanyInput) =>
  call<CreateCompanyResult>('/companies', { method: 'POST', body: JSON.stringify(input) });

export const resendCompanyLink = (id: string) =>
  call<{ ok: true; email: string; setup_link: string | null }>(`/companies/${id}/resend`, { method: 'POST' });

export const updateCompany = (id: string, patch: { is_active?: boolean; plan?: string; custom_domain_status?: 'pending' | 'active' }) =>
  call<{ ok: true }>(`/companies/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });

// ------------------------------------------
// The company's own domain
// ------------------------------------------
export interface DomainState {
  domain: string | null;
  status: 'pending' | 'active' | 'error' | null;
  detail: string | null;
  checked_at: string | null;
  /** What the company's CNAME must point at. */
  cname_target: string;
  /** true when Cloudflare is connected via API (certificate issued automatically). */
  automatic: boolean;
}

export const getDomain = () => call<DomainState>('/domain');
export const setDomain = (domain: string) => call<DomainState>('/domain', { method: 'PUT', body: JSON.stringify({ domain }) });
export const removeDomain = () => call<DomainState>('/domain', { method: 'DELETE' });
