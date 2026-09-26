import { Router, Request, Response, NextFunction } from "express";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { rateLimit } from "../middleware/security.js";

// ---------------------------------------------------------------------------
// Service-role client (server-side only — never bundled into the frontend)
// ---------------------------------------------------------------------------
let serviceClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient | null {
  if (serviceClient) return serviceClient;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

// Where invite and password-reset emails land (AcceptInvite.tsx handles both).
const acceptInviteUrl = () => `${process.env.SITE_URL ?? "https://www.nokael.com"}/accept-invite`;

// ---------------------------------------------------------------------------
// Auth middleware — validates the caller's own Supabase JWT and resolves
// their org + role.  Unlike the pool routes (API-key auth) this is
// session-token auth: the dashboard user sends their access_token, we
// verify it against Supabase and look up their org_members row.
// ---------------------------------------------------------------------------
type OrgRole = "owner" | "admin" | "operator" | "viewer";
const ROLES: OrgRole[] = ["viewer", "operator", "admin", "owner"]; // ascending rank
const rankOf = (role: string | undefined) => ROLES.indexOf(role as OrgRole);

type MemberStatus = "active" | "invited" | "disabled";

interface TeamRequest extends Request {
  callerId?: string;
  orgId?: string;
  callerRole?: OrgRole;
  targetRole?: OrgRole;
}

async function requireOrgSession(
  req: TeamRequest,
  res: Response,
  next: NextFunction
) {
  const client = getServiceClient();
  if (!client) {
    return res.status(503).json({ error: "Team API not configured — missing service role key" });
  }

  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing Authorization header" });

  // Validate the JWT using Supabase Admin Auth API
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: "Invalid or expired session token" });
  }

  const userId = userData.user.id;

  // Look up their org membership
  const { data: membership, error: memberError } = await client
    .from("org_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (memberError || !membership) {
    return res.status(403).json({ error: "User is not a member of any organisation" });
  }

  req.callerId = userId;
  req.orgId = membership.organization_id as string;
  req.callerRole = membership.role as OrgRole;
  next();
}

// Only owners and admins may write to team membership.
function requireAdminRole(req: TeamRequest, res: Response, next: NextFunction) {
  if (req.callerRole !== "owner" && req.callerRole !== "admin") {
    return res.status(403).json({ error: "Only owners and admins can manage team members" });
  }
  next();
}

// For /members/:userId routes: the target must belong to the caller's org,
// and the caller may only act on members whose role is not above their own
// (an admin cannot reset, disable or remove an owner).
async function requireManageableTarget(req: TeamRequest, res: Response, next: NextFunction) {
  const client = getServiceClient()!;
  const { data: target } = await client
    .from("org_members")
    .select("role")
    .eq("organization_id", req.orgId!)
    .eq("user_id", req.params.userId)
    .maybeSingle();

  if (!target) return res.status(404).json({ error: "Member not found in this organisation" });
  if (rankOf(target.role) > rankOf(req.callerRole)) {
    return res.status(403).json({ error: "You cannot manage a member with a higher role than your own" });
  }
  req.targetRole = target.role as OrgRole;
  next();
}

async function countOwners(client: SupabaseClient, orgId: string): Promise<number> {
  const { count } = await client
    .from("org_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("role", "owner");
  return count ?? 0;
}

function statusOf(user: User | null | undefined): MemberStatus {
  if (!user) return "invited";
  const bannedUntil = (user as User & { banned_until?: string | null }).banned_until;
  if (bannedUntil && new Date(bannedUntil).getTime() > Date.now()) return "disabled";
  if (!user.email_confirmed_at || (user.invited_at && !user.last_sign_in_at)) return "invited";
  return "active";
}

const cleanName = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, 100);
  return trimmed || null;
};

async function findUserByEmail(client: SupabaseClient, email: string): Promise<User | null> {
  const wanted = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    const users = (data?.users ?? []) as User[];
    if (error || users.length === 0) return null;
    const hit = users.find((u) => u.email?.toLowerCase() === wanted);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
// Mounted at /api/team in server.ts BEFORE the shared requireApiKey chain
// so it uses its own JWT-based auth rather than the site-wide shared secret.

export function createTeamRouter() {
  const router = Router();

  router.use(rateLimit(30, 60_000)); // 30 req/min per IP
  router.use(requireOrgSession);

  // ------------------------------------------------------------------
  // GET /api/team/members
  // ------------------------------------------------------------------
  // org_members for the caller's org, enriched from Supabase Auth (which the
  // anon key cannot read): email, full name, status, last sign-in, 2FA.
  router.get("/members", async (req: TeamRequest, res: Response) => {
    const client = getServiceClient()!;

    try {
      const { data: members, error: membersError } = await client
        .from("org_members")
        .select("id, user_id, role, created_at")
        .eq("organization_id", req.orgId!)
        .order("created_at", { ascending: true });

      if (membersError) {
        console.error("[team] list members error:", membersError);
        return res.status(500).json({ error: membersError.message });
      }

      if (!members || members.length === 0) {
        return res.json({ members: [] });
      }

      // Supabase Admin API allows listing users but not bulk-by-id.
      // We call getUserById for each member — typical team is <20 people,
      // so N+1 is acceptable and avoids pagination complexity.
      const users: Record<string, User | null> = {};
      await Promise.all(
        members.map(async (m: any) => {
          const { data } = await client.auth.admin.getUserById(m.user_id);
          users[m.user_id] = data?.user ?? null;
        })
      );

      const enriched = members.map((m: any) => {
        const u = users[m.user_id];
        return {
          id: m.id,
          user_id: m.user_id,
          email: u?.email ?? "(unknown)",
          full_name: (u?.user_metadata?.full_name as string | undefined)?.trim() || null,
          role: m.role,
          status: statusOf(u),
          created_at: m.created_at,
          invited_at: u?.invited_at ?? null,
          last_sign_in_at: u?.last_sign_in_at ?? null,
          mfa_enabled: !!u?.factors?.some((f) => f.status === "verified"),
          is_self: m.user_id === req.callerId,
        };
      });

      return res.json({ members: enriched });
    } catch (err) {
      console.error("[team] Unexpected error in GET /members:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ------------------------------------------------------------------
  // POST /api/team/invite  { email, role, full_name? }
  // ------------------------------------------------------------------
  // New address: Supabase emails an invite link to /accept-invite, where they
  // set a password. Existing account: no email can be "re-invited", so they
  // are simply added to the org and sign in with their current password.
  router.post(
    "/invite",
    requireAdminRole,
    async (req: TeamRequest, res: Response) => {
      const client = getServiceClient()!;
      const { email, role = "operator" } = req.body ?? {};
      const fullName = cleanName(req.body?.full_name);

      if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ error: "A valid email is required" });
      }
      if (!ROLES.includes(role)) {
        return res.status(400).json({ error: `role must be one of: ${ROLES.join(", ")}` });
      }
      if (rankOf(role) > rankOf(req.callerRole)) {
        return res.status(403).json({ error: "Cannot grant a role higher than your own" });
      }

      try {
        let userId: string | undefined;
        let existing = false;

        const { data: inviteData, error: inviteError } = await client.auth.admin.inviteUserByEmail(
          email.trim(),
          { redirectTo: acceptInviteUrl(), data: fullName ? { full_name: fullName } : undefined }
        );

        if (inviteError) {
          if (!/already (been )?registered|already exists/i.test(inviteError.message)) {
            console.error("[team] inviteUserByEmail error:", inviteError);
            return res.status(400).json({ error: inviteError.message });
          }
          const user = await findUserByEmail(client, email);
          if (!user) return res.status(400).json({ error: inviteError.message });
          userId = user.id;
          existing = true;
          if (fullName && !user.user_metadata?.full_name) {
            await client.auth.admin.updateUserById(user.id, {
              user_metadata: { ...user.user_metadata, full_name: fullName },
            });
          }
        } else {
          userId = inviteData?.user?.id;
        }

        if (!userId) {
          return res.status(500).json({ error: "Invite succeeded but no user ID returned" });
        }

        // Never lower an existing member's role through a re-invite.
        const { data: current } = await client
          .from("org_members")
          .select("role")
          .eq("organization_id", req.orgId!)
          .eq("user_id", userId)
          .maybeSingle();
        if (current && rankOf(current.role) > rankOf(req.callerRole)) {
          return res.status(403).json({ error: "This person is already a member with a higher role than yours" });
        }

        const { error: memberError } = await client
          .from("org_members")
          .upsert(
            { organization_id: req.orgId, user_id: userId, role },
            { onConflict: "organization_id,user_id" }
          );

        if (memberError) {
          console.error("[team] org_members upsert error:", memberError);
          return res.status(500).json({
            error: "Invite sent but failed to set org role: " + memberError.message,
          });
        }

        return res.status(201).json({ ok: true, user_id: userId, existing });
      } catch (err) {
        console.error("[team] Unexpected error in POST /invite:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ------------------------------------------------------------------
  // PATCH /api/team/members/:userId  { role?, full_name? }
  // ------------------------------------------------------------------
  router.patch(
    "/members/:userId",
    requireAdminRole,
    requireManageableTarget,
    async (req: TeamRequest, res: Response) => {
      const client = getServiceClient()!;
      const { userId } = req.params;
      const { role } = req.body ?? {};
      const fullName = cleanName(req.body?.full_name);

      if (role === undefined && fullName === undefined) {
        return res.status(400).json({ error: "Nothing to update" });
      }

      try {
        if (role !== undefined) {
          if (!ROLES.includes(role)) {
            return res.status(400).json({ error: `role must be one of: ${ROLES.join(", ")}` });
          }
          if (rankOf(role) > rankOf(req.callerRole)) {
            return res.status(403).json({ error: "Cannot assign a role higher than your own" });
          }
          if (req.targetRole === "owner" && role !== "owner" && (await countOwners(client, req.orgId!)) <= 1) {
            return res.status(403).json({ error: "Cannot demote the last owner" });
          }
          const { error } = await client
            .from("org_members")
            .update({ role })
            .eq("organization_id", req.orgId!)
            .eq("user_id", userId);
          if (error) return res.status(400).json({ error: error.message });
        }

        if (fullName !== undefined) {
          const { data } = await client.auth.admin.getUserById(userId);
          const { error } = await client.auth.admin.updateUserById(userId, {
            user_metadata: { ...(data?.user?.user_metadata ?? {}), full_name: fullName },
          });
          if (error) return res.status(400).json({ error: error.message });
        }

        return res.json({ ok: true });
      } catch (err) {
        console.error("[team] Unexpected error in PATCH /members:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ------------------------------------------------------------------
  // POST /api/team/members/:userId/resend-invite
  // ------------------------------------------------------------------
  // Only for people who have not accepted yet; an active member gets a
  // password-reset email instead.
  router.post(
    "/members/:userId/resend-invite",
    requireAdminRole,
    requireManageableTarget,
    async (req: TeamRequest, res: Response) => {
      const client = getServiceClient()!;
      try {
        const { data } = await client.auth.admin.getUserById(req.params.userId);
        const user = data?.user;
        if (!user?.email) return res.status(404).json({ error: "User not found" });
        if (statusOf(user) !== "invited") {
          return res.status(400).json({ error: "This member has already accepted. Use Reset password instead." });
        }
        const { error } = await client.auth.admin.inviteUserByEmail(user.email, { redirectTo: acceptInviteUrl() });
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ ok: true });
      } catch (err) {
        console.error("[team] Unexpected error in resend-invite:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ------------------------------------------------------------------
  // POST /api/team/members/:userId/reset-password
  // ------------------------------------------------------------------
  // Emails the member a password-reset link (same flow as "Forgot password?").
  // The admin never sees or sets the password.
  router.post(
    "/members/:userId/reset-password",
    requireAdminRole,
    requireManageableTarget,
    async (req: TeamRequest, res: Response) => {
      const client = getServiceClient()!;
      try {
        const { data } = await client.auth.admin.getUserById(req.params.userId);
        const email = data?.user?.email;
        if (!email) return res.status(404).json({ error: "User not found" });
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: acceptInviteUrl() });
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ ok: true });
      } catch (err) {
        console.error("[team] Unexpected error in reset-password:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ------------------------------------------------------------------
  // POST /api/team/members/:userId/disable   and   /enable
  // ------------------------------------------------------------------
  // Blocks sign-in (and token refresh) without removing the membership, so
  // access can be restored later with the same role.
  const setDisabled = (disabled: boolean) =>
    async (req: TeamRequest, res: Response) => {
      const client = getServiceClient()!;
      const { userId } = req.params;
      if (userId === req.callerId) {
        return res.status(403).json({ error: "You cannot disable your own account" });
      }
      if (disabled && req.targetRole === "owner" && (await countOwners(client, req.orgId!)) <= 1) {
        return res.status(403).json({ error: "Cannot disable the last owner" });
      }
      try {
        const { error } = await client.auth.admin.updateUserById(userId, {
          ban_duration: disabled ? "876000h" : "none",
        });
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ ok: true });
      } catch (err) {
        console.error("[team] Unexpected error in disable/enable:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
    };
  router.post("/members/:userId/disable", requireAdminRole, requireManageableTarget, setDisabled(true));
  router.post("/members/:userId/enable", requireAdminRole, requireManageableTarget, setDisabled(false));

  // ------------------------------------------------------------------
  // DELETE /api/team/members/:userId
  // ------------------------------------------------------------------
  router.delete(
    "/members/:userId",
    requireAdminRole,
    requireManageableTarget,
    async (req: TeamRequest, res: Response) => {
      const client = getServiceClient()!;
      const { userId } = req.params;

      if (userId === req.callerId) {
        return res.status(403).json({ error: "Cannot remove yourself from the team" });
      }
      if (req.targetRole === "owner" && (await countOwners(client, req.orgId!)) <= 1) {
        return res.status(403).json({ error: "Cannot remove the last owner" });
      }

      try {
        // Remove from org_members; the auth.users row stays — they can
        // still log in to other orgs if they have memberships elsewhere.
        const { error } = await client
          .from("org_members")
          .delete()
          .eq("organization_id", req.orgId!)
          .eq("user_id", userId);

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ ok: true });
      } catch (err) {
        console.error("[team] Unexpected error in DELETE /members:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  return router;
}
