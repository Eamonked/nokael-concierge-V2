import { supabase } from './supabase';
import { validCoord, type LatLng } from './geo';
import { formatDateTime, tenantDisplayName, getActiveTenant, isDefaultTenant, tenantWhatsApp, type TenantProfile } from './tenant';
import {
  renderCocPdf, normalizeCocTemplate, loadLogo, cocFileName, cocPromo,
  type CocJobData, type CocTemplate, type DriverContact, type PodFix,
} from './cocRender';

export type { CocJobData, DriverContact, PodFix } from './cocRender';

// ==========================================
// Chain of Custody certificate (staff copy)
// ==========================================
// Same certificate the client downloads from coc.nokael.com/<token>/track;
// both draw it with lib/cocRender.ts from the company's template
// (organizations.settings.coc). Client links close 24 h after delivery; after
// that dispatch issues the certificate from here, reading the job, driver and
// handover log directly (staff RLS) instead of through the client token.

/** Builds the certificate. `template` overrides the saved one (Settings preview). */
export async function buildCocPdf(
  job: CocJobData, driver: DriverContact | null, pod: PodFix[] = [],
  opts: { template?: CocTemplate; tenant?: TenantProfile } = {},
) {
  const tenant = opts.tenant ?? getActiveTenant();
  const template = opts.template ?? normalizeCocTemplate(tenant.settings.coc);
  const brand = tenantDisplayName(tenant);
  const tz = tenant.settings.timezone;
  const doc = renderCocPdf(job, driver, pod, {
    brand,
    formatTime: (d) => formatDateTime(d, undefined, tenant),
    timeZoneLabel: tz === 'Asia/Dubai' ? 'UAE' : tz,
    issuedBy: `issued by ${brand} dispatch`,
    template,
    logo: template.show_logo ? await loadLogo(tenant.branding.logo_url) : null,
    promo: cocPromo(brand, isDefaultTenant(tenant) ? 'nokael.com' : tenant.custom_domain, tenantWhatsApp(tenant)),
  });
  return { doc, fileName: cocFileName(brand, job.job_ref) };
}

/** Builds and downloads the certificate. No OTPs are ever printed. */
export async function downloadCocPdf(job: CocJobData, driver: DriverContact | null, pod: PodFix[] = []) {
  const { doc, fileName } = await buildCocPdf(job, driver, pod);
  doc.save(fileName);
}

/**
 * The handover GPS log for a job (job_pod_log, staff RLS). Same "latest log
 * row per step, confirmed only" rule as get_job_pod_by_token.
 */
export async function loadPodFixes(jobId: string): Promise<PodFix[]> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from('job_pod_log')
    .select('step, action, method, driver_lat, driver_lng, accuracy_m, fix_age_s, created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const latest = new Map<string, any>();
  for (const row of data ?? []) if (!latest.has(row.step)) latest.set(row.step, row);
  return [...latest.values()]
    .filter((r) => r.action === 'confirmed')
    .map((r) => ({ ...r, confirmed_at: r.created_at }));
}

/**
 * Where the package actually changed hands at pickup and at delivery, from the
 * COC log: the driver's own confirmation first, else the client's (as the
 * certificate prints it). null where nothing usable was recorded.
 */
export async function loadHandoverPoints(jobId: string): Promise<{ pickup: LatLng | null; delivery: LatLng | null }> {
  const pod = await loadPodFixes(jobId);
  const at = (steps: PodFix['step'][]) => {
    for (const s of steps) {
      const f = pod.find((p) => p.step === s);
      const c = f && validCoord(f.driver_lat, f.driver_lng);
      if (c) return c;
    }
    return null;
  };
  return { pickup: at(['driver_pickup', 'client_pickup']), delivery: at(['driver_delivery', 'client_delivery']) };
}

/** Loads the driver and handover GPS for a job and downloads its certificate. */
export async function downloadCocForJob(job: CocJobData & { id?: string; driver_id?: string | null }) {
  if (!supabase) throw new Error('Supabase not configured');
  const [driverRes, pod] = await Promise.all([
    job.driver_id
      ? supabase.from('drivers')
          .select('full_name, phone, vehicle_type, vehicle_make, vehicle_model, vehicle_plate')
          .eq('id', job.driver_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    loadPodFixes(job.id!),
  ]);

  await downloadCocPdf(job, (driverRes.data as DriverContact | null) ?? null, pod);
}
