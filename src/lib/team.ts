import { supabase } from './supabase';

// ==========================================
// Team / Org-member helpers (client-side)
// ==========================================
// All writes go through /api/team (server-side, service-role key) so that
// admin Auth operations (invite, delete user) are never exposed to the
// anon key. Reads that only need the calling user's own session (listing
// members, fetching their own org) call Supabase directly via the anon
// key + RLS — the org_members table's SELECT policy already scopes to
// the calling user's own memberships.

export type OrgRole = 'owner' | 'admin' | 'operator' | 'viewer';

export type MemberStatus = 'active' | 'invited' | 'disabled';

export interface OrgMember {
  id: string;               // org_members.id
  user_id: string;
  email: string;
  full_name: string | null;
  role: OrgRole;
  status: MemberStatus;
  created_at: string;       // when they were added to the org
  invited_at: string | null;
  last_sign_in_at: string | null;
  mfa_enabled: boolean;
  is_self: boolean;
}

export type TeamResult = { ok: boolean; error?: string; existing?: boolean };

// Every write goes through here: attaches the caller's session and turns
// any failure into { ok: false, error } so the UI can always show it.
const teamRequest = async (path: string, method: string, body?: unknown): Promise<TeamResult> => {
  try {
    if (!supabase) return { ok: false, error: 'Supabase not configured.' };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: 'Not authenticated.' };

    const res = await fetch(`/api/team${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${session.access_token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error ?? `Request failed (${res.status}).` };
    return { ok: true, existing: json.existing };
  } catch (err: any) {
    return { ok: false, error: err.message ?? 'Network error.' };
  }
};

// ---------------------------------------------------------------------------
// getCurrentUserOrg
// ---------------------------------------------------------------------------
// Returns the first org the logged-in user belongs to, plus their role in it.
// For Nokael today (single org) this is always tenant zero.
// null  = signed in but not a member of any org (removed / never added).
// throws = the lookup itself failed (network etc.) — don't treat as "no access".
export const getCurrentUserOrg = async (): Promise<{
  orgId: string;
  orgName: string;
  role: OrgRole;
} | null> => {
  if (!supabase) return null;

  // RLS on org_members limits this to the calling user's own rows.
  const { data, error } = await supabase
    .from('org_members')
    .select('role, organization_id, organizations(name)')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const org = data as any;
  return {
    orgId: org.organization_id as string,
    orgName: org.organizations?.name ?? 'Nokael',
    role: org.role as OrgRole,
  };
};

// ---------------------------------------------------------------------------
// getTeamMembers
// ---------------------------------------------------------------------------
// GET /api/team/members — members of the caller's org, enriched from Supabase
// Auth (name, status, last sign-in, 2FA). Throws on failure so the panel can
// show the reason instead of an empty list.
export const getTeamMembers = async (): Promise<OrgMember[]> => {
  if (!supabase) throw new Error('Supabase not configured.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated.');

  const res = await fetch('/api/team/members', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Could not load team (${res.status}).`);
  return (json.members ?? []) as OrgMember[];
};

// ---------------------------------------------------------------------------
// Member management — all via /api/team (service role, server-side)
// ---------------------------------------------------------------------------
// New address: Supabase emails an invite link. Existing account: added to the
// org directly (result.existing = true) and signs in with their own password.
export const inviteTeamMember = (email: string, role: OrgRole = 'operator', fullName?: string) =>
  teamRequest('/invite', 'POST', { email, role, full_name: fullName?.trim() || undefined });

export const updateTeamMemberRole = (userId: string, role: OrgRole) =>
  teamRequest(`/members/${userId}`, 'PATCH', { role });

export const updateTeamMemberName = (userId: string, fullName: string) =>
  teamRequest(`/members/${userId}`, 'PATCH', { full_name: fullName });

/** Re-sends the invite email; only for members who haven't accepted yet. */
export const resendTeamInvite = (userId: string) =>
  teamRequest(`/members/${userId}/resend-invite`, 'POST');

/** Emails the member a password-reset link. The admin never sees the password. */
export const sendTeamPasswordReset = (userId: string) =>
  teamRequest(`/members/${userId}/reset-password`, 'POST');

/** Blocks / restores sign-in without removing the membership. */
export const setTeamMemberDisabled = (userId: string, disabled: boolean) =>
  teamRequest(`/members/${userId}/${disabled ? 'disable' : 'enable'}`, 'POST');

/** Removes the org membership (the login itself is kept). */
export const removeTeamMember = (userId: string) =>
  teamRequest(`/members/${userId}`, 'DELETE');
