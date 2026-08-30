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

export interface OrgMember {
  id: string;               // org_members.id
  user_id: string;
  email: string;
  role: OrgRole;
  created_at: string;
}

// ---------------------------------------------------------------------------
// getCurrentUserOrg
// ---------------------------------------------------------------------------
// Returns the first org the logged-in user belongs to, plus their role in it.
// For Nokael today (single org) this is always tenant zero.
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
    .single();

  if (error || !data) return null;

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
// Calls GET /api/team/members which uses the service-role key to call
// the list_org_members RPC and join auth.users for emails.
// Falls back gracefully to an empty array so the UI can still render.
export const getTeamMembers = async (): Promise<OrgMember[]> => {
  try {
    if (!supabase) return [];
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const res = await fetch('/api/team/members', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!res.ok) {
      console.warn('[team] getTeamMembers:', res.status, await res.text());
      return [];
    }

    const json = await res.json();
    return (json.members ?? []) as OrgMember[];
  } catch (err) {
    console.warn('[team] getTeamMembers error:', err);
    return [];
  }
};

// ---------------------------------------------------------------------------
// inviteTeamMember
// ---------------------------------------------------------------------------
// POST /api/team/invite  { email, role }
// Server calls supabase.auth.admin.inviteUserByEmail then inserts an
// org_members row (role = 'operator' if not specified).
export const inviteTeamMember = async (
  email: string,
  role: OrgRole = 'operator'
): Promise<{ ok: boolean; error?: string }> => {
  try {
    if (!supabase) return { ok: false, error: 'Supabase not configured.' };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: 'Not authenticated.' };

    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email, role }),
    });

    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error ?? 'Invite failed.' };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message ?? 'Network error.' };
  }
};

// ---------------------------------------------------------------------------
// updateTeamMemberRole
// ---------------------------------------------------------------------------
// PATCH /api/team/members/:userId  { role }
export const updateTeamMemberRole = async (
  userId: string,
  role: OrgRole
): Promise<{ ok: boolean; error?: string }> => {
  try {
    if (!supabase) return { ok: false, error: 'Supabase not configured.' };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: 'Not authenticated.' };

    const res = await fetch(`/api/team/members/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ role }),
    });

    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error ?? 'Update failed.' };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message ?? 'Network error.' };
  }
};

// ---------------------------------------------------------------------------
// removeTeamMember
// ---------------------------------------------------------------------------
// DELETE /api/team/members/:userId
// Server removes the org_members row; optionally disables the auth user.
export const removeTeamMember = async (
  userId: string
): Promise<{ ok: boolean; error?: string }> => {
  try {
    if (!supabase) return { ok: false, error: 'Supabase not configured.' };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: 'Not authenticated.' };

    const res = await fetch(`/api/team/members/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error ?? 'Remove failed.' };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message ?? 'Network error.' };
  }
};
