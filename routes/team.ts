import { Router, Request, Response, NextFunction } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
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

// ---------------------------------------------------------------------------
// Auth middleware — validates the caller's own Supabase JWT and resolves
// their org + role.  Unlike the pool routes (API-key auth) this is
// session-token auth: the dashboard user sends their access_token, we
// verify it against Supabase and look up their org_members row.
// ---------------------------------------------------------------------------
type OrgRole = "owner" | "admin" | "operator" | "viewer";

interface TeamRequest extends Request {
  callerId?: string;
  orgId?: string;
  callerRole?: OrgRole;
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
  // Lists all org_members rows for the caller's org joined with
  // auth.users for their email addresses.  Uses the service-role client
  // so it can read auth.users — the anon key cannot.
  router.get("/members", async (req: TeamRequest, res: Response) => {
    const client = getServiceClient()!;

    try {
      // Fetch org_members for this org
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

      // Fetch emails for each user from Auth Admin API
      const userIds = members.map((m: any) => m.user_id as string);
      const emailMap: Record<string, string> = {};

      // Supabase Admin API allows listing users but not bulk-by-id.
      // We call getUserById for each member — typical team is <20 people,
      // so N+1 is acceptable and avoids pagination complexity.
      await Promise.all(
        userIds.map(async (uid) => {
          const { data } = await client.auth.admin.getUserById(uid);
          if (data?.user?.email) emailMap[uid] = data.user.email;
        })
      );

      const enriched = members.map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        email: emailMap[m.user_id] ?? "(unknown)",
        role: m.role,
        created_at: m.created_at,
      }));

      return res.json({ members: enriched });
    } catch (err) {
      console.error("[team] Unexpected error in GET /members:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ------------------------------------------------------------------
  // POST /api/team/invite  { email, role }
  // ------------------------------------------------------------------
  // Invites a new user by email (Supabase sends the magic-link email
  // pointing to /accept-invite), then inserts an org_members row so
  // they land in the right org with the right role the moment they
  // accept.  If the user already exists in Auth, inviteUserByEmail
  // still sends a recovery-style link — they just set/reset their
  // password via /accept-invite rather than setting it for the first
  // time.
  router.post(
    "/invite",
    requireAdminRole,
    async (req: TeamRequest, res: Response) => {
      const client = getServiceClient()!;
      const { email, role = "operator" } = req.body ?? {};

      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "email is required" });
      }

      const validRoles: OrgRole[] = ["owner", "admin", "operator", "viewer"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: `role must be one of: ${validRoles.join(", ")}` });
      }

      // Callers cannot grant a role higher than their own
      const callerRoleRank = ["viewer", "operator", "admin", "owner"].indexOf(req.callerRole!);
      const targetRoleRank = ["viewer", "operator", "admin", "owner"].indexOf(role);
      if (targetRoleRank > callerRoleRank) {
        return res.status(403).json({ error: "Cannot grant a role higher than your own" });
      }

      try {
        const redirectTo = `${process.env.SITE_URL ?? "https://www.nokael.com"}/accept-invite`;

        const { data: inviteData, error: inviteError } =
          await client.auth.admin.inviteUserByEmail(email, { redirectTo });

        if (inviteError) {
          console.error("[team] inviteUserByEmail error:", inviteError);
          return res.status(400).json({ error: inviteError.message });
        }

        const newUserId = inviteData?.user?.id;
        if (!newUserId) {
          return res.status(500).json({ error: "Invite succeeded but no user ID returned" });
        }

        // Upsert org_members row so the invited user belongs to the
        // right org when they first log in.  ON CONFLICT handles the
        // case where the email was already a member (reinvite).
        const { error: memberError } = await client
          .from("org_members")
          .upsert(
            {
              organization_id: req.orgId,
              user_id: newUserId,
              role,
            },
            { onConflict: "organization_id,user_id" }
          );

        if (memberError) {
          console.error("[team] org_members upsert error:", memberError);
          // Don't 500 here — the Auth invite succeeded; warn and carry on.
          return res.status(207).json({
            ok: true,
            warning: "Invite sent but failed to set org role: " + memberError.message,
          });
        }

        return res.status(201).json({ ok: true, user_id: newUserId });
      } catch (err) {
        console.error("[team] Unexpected error in POST /invite:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ------------------------------------------------------------------
  // PATCH /api/team/members/:userId  { role }
  // ------------------------------------------------------------------
  router.patch(
    "/members/:userId",
    requireAdminRole,
    async (req: TeamRequest, res: Response) => {
      const client = getServiceClient()!;
      const { userId } = req.params;
      const { role } = req.body ?? {};

      const validRoles: OrgRole[] = ["owner", "admin", "operator", "viewer"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: `role must be one of: ${validRoles.join(", ")}` });
      }

      // Prevent privilege escalation
      const callerRoleRank = ["viewer", "operator", "admin", "owner"].indexOf(req.callerRole!);
      const targetRoleRank = ["viewer", "operator", "admin", "owner"].indexOf(role);
      if (targetRoleRank > callerRoleRank) {
        return res.status(403).json({ error: "Cannot assign a role higher than your own" });
      }

      // Prevent the last owner from demoting themselves
      if (role !== "owner" && userId === req.callerId) {
        const { count } = await client
          .from("org_members")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", req.orgId!)
          .eq("role", "owner");
        if ((count ?? 0) <= 1) {
          return res.status(403).json({ error: "Cannot demote the last owner" });
        }
      }

      try {
        const { error } = await client
          .from("org_members")
          .update({ role })
          .eq("organization_id", req.orgId!)
          .eq("user_id", userId);

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ ok: true });
      } catch (err) {
        console.error("[team] Unexpected error in PATCH /members:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ------------------------------------------------------------------
  // DELETE /api/team/members/:userId
  // ------------------------------------------------------------------
  router.delete(
    "/members/:userId",
    requireAdminRole,
    async (req: TeamRequest, res: Response) => {
      const client = getServiceClient()!;
      const { userId } = req.params;

      // Prevent self-removal
      if (userId === req.callerId) {
        return res.status(403).json({ error: "Cannot remove yourself from the team" });
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
