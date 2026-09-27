import { Router, Response, NextFunction } from "express";
import type { User } from "@supabase/supabase-js";
import { rateLimit } from "../middleware/security.js";
import {
  getServiceClient,
  requireOrgSession,
  statusOf,
  cleanName,
  findUserByEmail,
  type TeamRequest,
} from "./team.js";

// ---------------------------------------------------------------------------
// Client portal access (coc.nokael.com/portal)
// ---------------------------------------------------------------------------
// A client login is an ordinary Supabase Auth user plus a client_members row
// linking it to one business account. Client logins have no org_members row,
// so they can never open this dashboard — only the portal.
//
// Invite and reset emails land on the portal, which must be listed under
// Supabase → Authentication → URL Configuration → Redirect URLs
// (https://coc.nokael.com/portal/**), or Supabase falls back to the Site URL.

const portalUrl = () => `${(process.env.COC_URL || "https://coc.nokael.com").replace(/\/$/, "")}/portal/`;

type ClientRole = "admin" | "viewer";
const CLIENT_ROLES: ClientRole[] = ["admin", "viewer"];

interface ClientRequest extends TeamRequest {
  businessId?: string;
}

// Anyone who can write in the dashboard (operator and up) may manage portal
// access; viewers are read-only everywhere.
function requireWriter(req: ClientRequest, res: Response, next: NextFunction) {
  if (req.callerRole === "viewer") {
    return res.status(403).json({ error: "You have view-only access. Ask an admin to give portal access." });
  }
  next();
}

// The business must belong to the caller's organisation.
async function requireOwnBusiness(req: ClientRequest, res: Response, next: NextFunction) {
  const client = getServiceClient()!;
  const { data: business } = await client
    .from("business_inquiries")
    .select("id")
    .eq("id", req.params.businessId)
    .eq("organization_id", req.orgId!)
    .maybeSingle();
  if (!business) return res.status(404).json({ error: "Business account not found" });
  req.businessId = business.id as string;
  next();
}

export function createClientsRouter() {
  const router = Router();

  router.use(rateLimit(30, 60_000));
  router.use(requireOrgSession);

  // ------------------------------------------------------------------
  // GET /api/clients/:businessId/members
  // ------------------------------------------------------------------
  router.get("/:businessId/members", requireOwnBusiness, async (req: ClientRequest, res: Response) => {
    const client = getServiceClient()!;
    try {
      const { data: rows, error } = await client
        .from("client_members")
        .select("user_id, role, created_at, last_seen_at")
        .eq("business_id", req.businessId!)
        .order("created_at", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });

      const members = await Promise.all(
        (rows ?? []).map(async (m: any) => {
          const { data } = await client.auth.admin.getUserById(m.user_id);
          const u = data?.user;
          return {
            user_id: m.user_id,
            email: u?.email ?? "(unknown)",
            full_name: (u?.user_metadata?.full_name as string | undefined)?.trim() || null,
            role: m.role,
            status: statusOf(u),
            created_at: m.created_at,
            last_seen_at: m.last_seen_at,
          };
        })
      );
      return res.json({ members, portal_url: portalUrl() });
    } catch (err) {
      console.error("[clients] Unexpected error in GET /members:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ------------------------------------------------------------------
  // POST /api/clients/:businessId/invite  { email, role?, full_name? }
  // ------------------------------------------------------------------
  // New address: Supabase emails an invite that opens the portal on "Set up
  // your account". Existing login: linked straight away; they sign in at the
  // portal with the password they already have.
  router.post("/:businessId/invite", requireWriter, requireOwnBusiness, async (req: ClientRequest, res: Response) => {
    const client = getServiceClient()!;
    const { email, role = "viewer" } = req.body ?? {};
    const fullName = cleanName(req.body?.full_name);

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }
    if (!CLIENT_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${CLIENT_ROLES.join(", ")}` });
    }

    try {
      let user: User | null = null;
      let existing = false;

      const { data: inviteData, error: inviteError } = await client.auth.admin.inviteUserByEmail(email.trim(), {
        redirectTo: portalUrl(),
        data: fullName ? { full_name: fullName } : undefined,
      });

      if (inviteError) {
        if (!/already (been )?registered|already exists/i.test(inviteError.message)) {
          console.error("[clients] inviteUserByEmail error:", inviteError);
          return res.status(400).json({ error: inviteError.message });
        }
        user = await findUserByEmail(client, email);
        if (!user) return res.status(400).json({ error: inviteError.message });
        existing = true;
        if (fullName && !user.user_metadata?.full_name) {
          await client.auth.admin.updateUserById(user.id, {
            user_metadata: { ...user.user_metadata, full_name: fullName },
          });
        }
      } else {
        user = inviteData?.user ?? null;
      }

      if (!user) return res.status(500).json({ error: "Invite succeeded but no user ID returned" });

      const { error: memberError } = await client
        .from("client_members")
        .upsert(
          { organization_id: req.orgId, business_id: req.businessId, user_id: user.id, role },
          { onConflict: "business_id,user_id" }
        );
      if (memberError) {
        console.error("[clients] client_members upsert error:", memberError);
        return res.status(500).json({ error: "Invite sent but could not link it to this business: " + memberError.message });
      }

      // An existing login that never finished setting a password gets a fresh invite link.
      const needsSetup = existing && statusOf(user) === "invited";
      if (needsSetup) {
        await client.auth.admin.inviteUserByEmail(user.email!, { redirectTo: portalUrl() });
      }

      return res.status(201).json({ ok: true, existing: existing && !needsSetup, portal_url: portalUrl() });
    } catch (err) {
      console.error("[clients] Unexpected error in POST /invite:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ------------------------------------------------------------------
  // POST /api/clients/:businessId/members/:userId/send-link
  // ------------------------------------------------------------------
  // Not set up yet → re-sends the invite. Already active → sends a
  // password-reset email. Either way the link opens the portal.
  router.post(
    "/:businessId/members/:userId/send-link",
    requireWriter,
    requireOwnBusiness,
    async (req: ClientRequest, res: Response) => {
      const client = getServiceClient()!;
      try {
        const { data: link } = await client
          .from("client_members")
          .select("user_id")
          .eq("business_id", req.businessId!)
          .eq("user_id", req.params.userId)
          .maybeSingle();
        if (!link) return res.status(404).json({ error: "This person doesn't have portal access" });

        const { data } = await client.auth.admin.getUserById(req.params.userId);
        const user = data?.user;
        if (!user?.email) return res.status(404).json({ error: "User not found" });

        const invited = statusOf(user) === "invited";
        const { error } = invited
          ? await client.auth.admin.inviteUserByEmail(user.email, { redirectTo: portalUrl() })
          : await client.auth.resetPasswordForEmail(user.email, { redirectTo: portalUrl() });
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ ok: true, kind: invited ? "invite" : "reset" });
      } catch (err) {
        console.error("[clients] Unexpected error in send-link:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // ------------------------------------------------------------------
  // DELETE /api/clients/:businessId/members/:userId
  // ------------------------------------------------------------------
  // Removes access to this business only; the login itself is kept.
  router.delete(
    "/:businessId/members/:userId",
    requireWriter,
    requireOwnBusiness,
    async (req: ClientRequest, res: Response) => {
      const { error } = await getServiceClient()!
        .from("client_members")
        .delete()
        .eq("business_id", req.businessId!)
        .eq("user_id", req.params.userId);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    }
  );

  return router;
}
