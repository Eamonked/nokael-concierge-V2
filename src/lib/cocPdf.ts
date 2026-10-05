import { supabase } from './supabase';
import { formatDateTime, tenantDisplayName, getActiveTenant, type TenantProfile } from './tenant';
import {
  renderCocPdf, normalizeCocTemplate, loadLogo, cocFileName,
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
  });
  return { doc, fileName: cocFileName(brand, job.job_ref) };
}

/** Builds and downloads the certificate. No OTPs are ever printed. */
export async function downloadCocPdf(job: CocJobData, driver: DriverContact | null, pod: PodFix[] = []) {
  const { doc, fileName } = await buildCocPdf(job, driver, pod);
  doc.save(fileName);
}

/**
 * Loads the driver and handover GPS for a job and downloads its certificate.
 * Same "latest log row per step, confirmed only" rule as get_job_pod_by_token.
 */
export async function downloadCocForJob(job: CocJobData & { id?: string; driver_id?: string | null }) {
  if (!supabase) throw new Error('Supabase not configured');
  const [driverRes, podRes] = await Promise.all([
    job.driver_id
      ? supabase.from('drivers')
          .select('full_name, phone, vehicle_type, vehicle_make, vehicle_model, vehicle_plate')
          .eq('id', job.driver_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('job_pod_log')
      .select('step, action, method, driver_lat, driver_lng, accuracy_m, fix_age_s, created_at')
      .eq('job_id', job.id!)
      .order('created_at', { ascending: false }),
  ]);
  if (podRes.error) throw podRes.error;

  const latest = new Map<string, any>();
  for (const row of podRes.data ?? []) if (!latest.has(row.step)) latest.set(row.step, row);
  const pod: PodFix[] = [...latest.values()]
    .filter((r) => r.action === 'confirmed')
    .map((r) => ({ ...r, confirmed_at: r.created_at }));

  await downloadCocPdf(job, (driverRes.data as DriverContact | null) ?? null, pod);
}
