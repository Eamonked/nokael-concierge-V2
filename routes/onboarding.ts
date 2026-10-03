import { Router, Response, NextFunction } from "express";
import { rateLimit } from "../middleware/security.js";
import {
  getServiceClient,
  requireOrgSession,
  findUserByEmail,
  cleanName,
  type TeamRequest,
} from "./team.js";
import { COUNTRY_PRESETS, findCountry, settingsForCountry, slugify } from "../src/lib/countries.js";
import { cleanDomain, customDomainProblem } from "../src/lib/hosts.js";
import { cloudflareConfigured, cnameTarget, hostnameState, registerHostname, removeHostname } from "./cloudflare.js";

// ---------------------------------------------------------------------------
// Company onboarding
// ---------------------------------------------------------------------------
// Two audiences, one router (mounted at /api/onboarding, session-token auth):
//
//  • Platform admins — owners/admins of an org on the 'internal' plan (Nokael)
//    — create a company, which in one step: creates the organizations row with
//    its country profile, invites the owner by email, makes them 'owner', and
//    returns a setup link that can also be sent by WhatsApp.
//  • Any member — GET /me tells the dashboard whether their company still
//    has onboarding steps left.
//
// Everything the new owner does afterwards (company profile, branding, team,
// API key) goes through RLS-checked RPCs / the existing /api/team routes, so
// nothing here needs to run on their behalf.

const PLANS = ["trial", "standard", "enterprise"] as const;
const RESERVED_SLUGS = new Set([
  "nokael", "admin", "api", "app", "c", "dashboard", "driver", "driver-app", "portal", "track", "www", "login", "onboarding",
]);

const siteUrl = () => process.env.SITE_URL ?? "https://www.nokael.com";
const acceptInviteUrl = () => `${siteUrl()}/accept-invite`;
const isEmail = (v: unknown): v is string => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

interface PlatformRequest extends TeamRequest {
  isPlatformAdmin?: boolean;
}

async function resolvePlatformAdmin(req: PlatformRequest, _res: Response, next: NextFunction) {
  const client = getServiceClient()!;
  const { data } = await client
    .from("org_members")
    .select("role, organizations!inner(plan)")
    .eq("user_id", req.callerId!)
    .in("role", ["owner", "admin"])
    .eq("organizations.plan", "internal")
    .limit(1);
  req.isPlatformAdmin = !!data?.length;
  next();
}

function requireOrgAdmin(req: PlatformRequest, res: Response, next: NextFunction) {
  if (req.callerRole !== "owner" && req.callerRole !== "admin") {
    return res.status(403).json({ error: "Only owners and admins can change the company's domain" });
  }
  next();
}

/** Public URL for a company: its own domain once live, else /c/<slug>. */
const publicUrlFor = (org: { slug: string; custom_domain?: string | null; custom_domain_status?: string | null }) =>
  org.custom_domain && org.custom_domain_status === "active" ? `https://${org.custom_domain}` : `${siteUrl()}/c/${org.slug}`;

function requirePlatformAdmin(req: PlatformRequest, res: Response, next: NextFunction) {
  if (!req.isPlatformAdmin) return res.status(403).json({ error: "Only Nokael platform admins can manage companies" });
  next();
}

/**
 * A one-time link that signs the owner in and lands on /accept-invite to set
 * a password (a recovery link, so it stays valid alongside the invite email).
 * null when Supabase can't make one — the email invite still stands.
 */
async function setupLinkFor(email: string): Promise<string | null> {
  const client = getServiceClient()!;
  const { data, error } = await client.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: acceptInviteUrl() },
  });
  if (error) {
    console.warn("[onboarding] generateLink failed:", error.message);
    return null;
  }
  return data?.properties?.action_link ?? null;
}

/** Invite (or find) the owner and make them 'owner' of the org. */
async function attachOwner(orgId: string, email: string, fullName: string | null | undefined) {
  const client = getServiceClient()!;
  let userId: string | undefined;
  let existing = false;

  const { data: invited, error: inviteError } = await client.auth.admin.inviteUserByEmail(email, {
    redirectTo: acceptInviteUrl(),
    data: fullName ? { full_name: fullName } : undefined,
  });

  if (inviteError) {
    if (!/already (been )?registered|already exists/i.test(inviteError.message)) throw new Error(inviteError.message);
    const user = await findUserByEmail(client, email);
    if (!user) throw new Error(inviteError.message);
    userId = user.id;
    existing = true;
  } else {
    userId = invited?.user?.id;
  }
  if (!userId) throw new Error("Invite succeeded but no user ID returned");

  // One company per login keeps the dashboard unambiguous (it opens the
  // member's only org). Refuse rather than silently adding a second.
  const { data: otherOrgs } = await client
    .from("org_members")
    .select("organization_id")
    .eq("user_id", userId)
    .neq("organization_id", orgId);
  if (otherOrgs?.length) {
    throw Object.assign(new Error("This email already belongs to another company on the platform. Use a different email for the owner."), { status: 409 });
  }

  const { error: memberError } = await client
    .from("org_members")
    .upsert({ organization_id: orgId, user_id: userId, role: "owner" }, { onConflict: "organization_id,user_id" });
  if (memberError) throw new Error(memberError.message);

  return { userId, existing, setupLink: existing ? null : await setupLinkFor(email) };
}

export function createOnboardingRouter() {
  const router = Router();
  router.use(rateLimit(30, 60_000));
  router.use(requireOrgSession);
  router.use(resolvePlatformAdmin);

  // ------------------------------------------------------------------
  // GET /api/onboarding/me — the caller's company + what's left to do
  // ------------------------------------------------------------------
  router.get("/me", async (req: PlatformRequest, res: Response) => {
    const client = getServiceClient()!;
    const [{ data: org }, { count: members }, { count: drivers }, { count: keys }] = await Promise.all([
      client.from("organizations").select("id, name, slug, plan, is_active, settings, branding, custom_domain, custom_domain_status").eq("id", req.orgId!).single(),
      client.from("org_members").select("id", { count: "exact", head: true }).eq("organization_id", req.orgId!),
      client.from("drivers").select("id", { count: "exact", head: true }).eq("organization_id", req.orgId!),
      client.from("api_keys").select("id", { count: "exact", head: true }).eq("organization_id", req.orgId!).is("revoked_at", null),
    ]);
    if (!org) return res.status(404).json({ error: "Organisation not found" });

    const s = (org.settings ?? {}) as Record<string, any>;
    const b = (org.branding ?? {}) as Record<string, any>;
    return res.json({
      org,
      role: req.callerRole,
      isPlatformAdmin: !!req.isPlatformAdmin,
      publicUrl: publicUrlFor(org),
      checklist: {
        company: !!(s.country && s.currency && s.timezone),
        contact: !!(b.support_phone || b.whatsapp),
        branding: !!(b.logo_url || b.primary_color),
        team: (members ?? 0) > 1,
        drivers: (drivers ?? 0) > 0,
        api: (keys ?? 0) > 0,
        completed: !!s.onboarding?.completed_at,
      },
    });
  });

  // ------------------------------------------------------------------
  // Platform admin: companies
  // ------------------------------------------------------------------
  router.get("/countries", (_req, res) => res.json({ countries: COUNTRY_PRESETS }));

  router.get("/companies", requirePlatformAdmin, async (_req: PlatformRequest, res: Response) => {
    const client = getServiceClient()!;
    const { data: orgs, error } = await client
      .from("organizations")
      .select("id, name, slug, plan, is_active, created_at, settings, custom_domain, custom_domain_status")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const { data: counts } = await client.from("org_members").select("organization_id");
    const memberCount = new Map<string, number>();
    (counts ?? []).forEach((m: any) => memberCount.set(m.organization_id, (memberCount.get(m.organization_id) ?? 0) + 1));

    return res.json({
      companies: (orgs ?? []).map((o: any) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        plan: o.plan,
        is_active: o.is_active,
        created_at: o.created_at,
        country: o.settings?.country ?? null,
        currency: o.settings?.currency ?? null,
        onboarding_completed_at: o.settings?.onboarding?.completed_at ?? null,
        members: memberCount.get(o.id) ?? 0,
        custom_domain: o.custom_domain ?? null,
        custom_domain_status: o.custom_domain_status ?? null,
        public_url: publicUrlFor(o),
      })),
    });
  });

  // POST /api/onboarding/companies
  //   { name, country, owner_email, owner_name?, slug?, plan? }
  router.post("/companies", requirePlatformAdmin, async (req: PlatformRequest, res: Response) => {
    const client = getServiceClient()!;
    const body = req.body ?? {};
    const name = cleanName(body.name);
    const preset = findCountry(body.country);
    const ownerEmail = typeof body.owner_email === "string" ? body.owner_email.trim().toLowerCase() : "";
    const ownerName = cleanName(body.owner_name);
    const plan = PLANS.includes(body.plan) ? body.plan : "trial";
    const slug = slugify(typeof body.slug === "string" && body.slug.trim() ? body.slug : name ?? "");

    if (!name) return res.status(400).json({ error: "Company name is required" });
    if (!preset) return res.status(400).json({ error: "Choose the company's country" });
    if (!isEmail(ownerEmail)) return res.status(400).json({ error: "A valid owner email is required" });
    if (slug.length < 2 || RESERVED_SLUGS.has(slug)) return res.status(400).json({ error: "Choose a different link name (slug)" });

    const { data: taken } = await client.from("organizations").select("id").eq("slug", slug).maybeSingle();
    if (taken) return res.status(409).json({ error: `The link /c/${slug} is already taken — pick another` });

    const { data: org, error: orgError } = await client
      .from("organizations")
      .insert({
        name,
        slug,
        plan,
        is_active: true,
        settings: { ...settingsForCountry(preset, name), onboarding: { step: 1, created_by: req.callerId } },
        branding: { display_name: name },
      })
      .select("id, name, slug, plan, settings")
      .single();
    if (orgError || !org) return res.status(500).json({ error: orgError?.message ?? "Could not create the company" });

    try {
      const owner = await attachOwner(org.id, ownerEmail, ownerName);
      return res.status(201).json({
        company: org,
        owner: { email: ownerEmail, existing: owner.existing },
        setup_link: owner.setupLink,
        public_url: `${siteUrl()}/c/${org.slug}`,
      });
    } catch (err: any) {
      // Don't leave an owner-less company behind.
      await client.from("organizations").delete().eq("id", org.id);
      return res.status(err?.status ?? 400).json({ error: err?.message ?? "Could not invite the owner" });
    }
  });

  // POST /api/onboarding/companies/:id/resend  { owner_email? }
  // Re-sends the setup email and returns a fresh shareable link.
  router.post("/companies/:id/resend", requirePlatformAdmin, async (req: PlatformRequest, res: Response) => {
    const client = getServiceClient()!;
    const { data: owners } = await client
      .from("org_members")
      .select("user_id")
      .eq("organization_id", req.params.id)
      .eq("role", "owner")
      .limit(1);
    const ownerId = owners?.[0]?.user_id;
    if (!ownerId) return res.status(404).json({ error: "This company has no owner yet" });

    const { data } = await client.auth.admin.getUserById(ownerId);
    const email = data?.user?.email;
    if (!email) return res.status(404).json({ error: "Owner account not found" });

    if (!data.user.last_sign_in_at) {
      await client.auth.admin.inviteUserByEmail(email, { redirectTo: acceptInviteUrl() }).catch(() => undefined);
    }
    return res.json({ ok: true, email, setup_link: await setupLinkFor(email) });
  });

  // PATCH /api/onboarding/companies/:id  { is_active?, plan?, custom_domain_status? }
  router.patch("/companies/:id", requirePlatformAdmin, async (req: PlatformRequest, res: Response) => {
    const client = getServiceClient()!;
    const patch: Record<string, unknown> = {};
    if (typeof req.body?.is_active === "boolean") patch.is_active = req.body.is_active;
    if (PLANS.includes(req.body?.plan)) patch.plan = req.body.plan;
    // For domains connected by hand in the Cloudflare dashboard (no API token set).
    if (["pending", "active"].includes(req.body?.custom_domain_status)) {
      patch.custom_domain_status = req.body.custom_domain_status;
      patch.custom_domain_error = null;
      patch.custom_domain_checked_at = new Date().toISOString();
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: "Nothing to update" });

    const { data: target } = await client.from("organizations").select("plan").eq("id", req.params.id).maybeSingle();
    if (!target) return res.status(404).json({ error: "Company not found" });
    if (target.plan === "internal") return res.status(403).json({ error: "The platform's own organisation can't be changed here" });

    const { error } = await client.from("organizations").update(patch).eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  });

  // ------------------------------------------------------------------
  // The caller's company domain (book.theircompany.com)
  // ------------------------------------------------------------------
  const domainPayload = (org: any) => ({
    domain: org.custom_domain ?? null,
    status: org.custom_domain_status ?? null,
    detail: org.custom_domain_error ?? null,
    checked_at: org.custom_domain_checked_at ?? null,
    cname_target: cnameTarget(),
    automatic: cloudflareConfigured(),
  });
  const DOMAIN_COLUMNS = "id, custom_domain, custom_domain_status, custom_domain_cf_id, custom_domain_error, custom_domain_checked_at";

  // GET /api/onboarding/domain — also re-checks Cloudflare while pending.
  router.get("/domain", async (req: PlatformRequest, res: Response) => {
    const client = getServiceClient()!;
    const { data: org, error } = await client.from("organizations").select(DOMAIN_COLUMNS).eq("id", req.orgId!).single();
    if (error || !org) return res.status(500).json({ error: error?.message ?? "Organisation not found" });

    if (org.custom_domain && org.custom_domain_status !== "active" && org.custom_domain_cf_id && cloudflareConfigured()) {
      try {
        const state = await hostnameState(org.custom_domain_cf_id);
        const patch = { custom_domain_status: state.status, custom_domain_error: state.detail, custom_domain_checked_at: new Date().toISOString() };
        await client.from("organizations").update(patch).eq("id", org.id);
        Object.assign(org, patch);
      } catch (err: any) {
        console.warn("[onboarding] Cloudflare status check failed:", err?.message);
      }
    }
    return res.json(domainPayload(org));
  });

  // PUT /api/onboarding/domain  { domain }
  router.put("/domain", requireOrgAdmin, async (req: PlatformRequest, res: Response) => {
    const client = getServiceClient()!;
    const raw = typeof req.body?.domain === "string" ? req.body.domain : "";
    const problem = customDomainProblem(raw);
    if (problem) return res.status(400).json({ error: problem });
    const domain = cleanDomain(raw);

    const { data: taken } = await client.from("organizations").select("id").eq("custom_domain", domain).neq("id", req.orgId!).maybeSingle();
    if (taken) return res.status(409).json({ error: "That domain is already connected to another company" });

    const { data: current } = await client.from("organizations").select(DOMAIN_COLUMNS).eq("id", req.orgId!).single();
    if (current?.custom_domain === domain && current.custom_domain_status) return res.json(domainPayload(current));

    // Switching domains: drop the old Cloudflare registration first.
    if (current?.custom_domain_cf_id && cloudflareConfigured()) {
      await removeHostname(current.custom_domain_cf_id).catch((err) => console.warn("[onboarding] remove old hostname:", err?.message));
    }

    let patch: Record<string, unknown> = {
      custom_domain: domain,
      custom_domain_status: "pending",
      custom_domain_cf_id: null,
      custom_domain_error: cloudflareConfigured() ? null : "Nokael will connect this domain for you shortly",
      custom_domain_checked_at: new Date().toISOString(),
    };
    if (cloudflareConfigured()) {
      try {
        const state = await registerHostname(domain);
        patch = { ...patch, custom_domain_cf_id: state.id, custom_domain_status: state.status, custom_domain_error: state.detail };
      } catch (err: any) {
        return res.status(502).json({ error: `Cloudflare: ${err?.message ?? "could not register the domain"}` });
      }
    }

    const { data: saved, error } = await client.from("organizations").update(patch).eq("id", req.orgId!).select(DOMAIN_COLUMNS).single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(domainPayload(saved));
  });

  // DELETE /api/onboarding/domain — back to nokael.com/c/<slug> only.
  router.delete("/domain", requireOrgAdmin, async (req: PlatformRequest, res: Response) => {
    const client = getServiceClient()!;
    const { data: current } = await client.from("organizations").select(DOMAIN_COLUMNS).eq("id", req.orgId!).single();
    if (current?.custom_domain_cf_id && cloudflareConfigured()) {
      try {
        await removeHostname(current.custom_domain_cf_id);
      } catch (err: any) {
        return res.status(502).json({ error: `Cloudflare: ${err?.message ?? "could not remove the domain"}` });
      }
    }
    const { error } = await client.from("organizations").update({
      custom_domain: null, custom_domain_status: null, custom_domain_cf_id: null, custom_domain_error: null, custom_domain_checked_at: null,
    }).eq("id", req.orgId!);
    if (error) return res.status(500).json({ error: error.message });
    return res.json(domainPayload({}));
  });

  return router;
}
