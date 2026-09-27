import { supabase } from './supabase';

// ==========================================
// Client portal access (coc.nokael.com/portal)
// ==========================================
// Everything goes through /api/clients (server-side, service-role key):
// inviting a login is an admin Auth operation the anon key can't do.

export type ClientRole = 'admin' | 'viewer';
export type ClientStatus = 'active' | 'invited' | 'disabled';

export interface ClientMember {
  user_id: string;
  email: string;
  full_name: string | null;
  role: ClientRole;
  status: ClientStatus;
  created_at: string;
  last_seen_at: string | null;
}

const clientsRequest = async <T = Record<string, unknown>>(path: string, method = 'GET', body?: unknown): Promise<T> => {
  if (!supabase) throw new Error('Supabase not configured.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated.');

  const res = await fetch(`/api/clients${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${session.access_token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status}).`);
  return json as T;
};

export const getClientMembers = (businessId: string) =>
  clientsRequest<{ members: ClientMember[]; portal_url: string }>(`/${businessId}/members`);

/** existing = true: they already had a login and can sign in with their current password. */
export const inviteClient = (businessId: string, email: string, role: ClientRole = 'viewer', fullName?: string) =>
  clientsRequest<{ existing: boolean; portal_url: string }>(`/${businessId}/invite`, 'POST', {
    email,
    role,
    full_name: fullName?.trim() || undefined,
  });

/** Re-sends the invite if they haven't set up yet, otherwise a password-reset link. */
export const sendClientLink = (businessId: string, userId: string) =>
  clientsRequest<{ kind: 'invite' | 'reset' }>(`/${businessId}/members/${userId}/send-link`, 'POST');

export const removeClientAccess = (businessId: string, userId: string) =>
  clientsRequest(`/${businessId}/members/${userId}`, 'DELETE');
