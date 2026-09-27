import type { QuoteRequest, Driver, JobWithDriver, BusinessInquiry } from '../../lib/supabase';

/**
 * Pure, unit-testable derivations of the dashboard's server-backed state.
 * Nothing here reads or writes React state — everything is (data, filters) -> data,
 * so these can be exercised directly in Vitest without mounting the component.
 */

export type JobStatusFilter = 'all' | 'pending' | 'in_transit' | 'completed' | 'returned' | 'cancelled';

export function filterRequests(
  requests: QuoteRequest[],
  searchTerm: string,
  filterStatus: string
): QuoteRequest[] {
  return requests.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.pickup_location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.delivery_location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (r.corporate_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (r.tracking_id || '').toLowerCase().includes(searchTerm.toLowerCase());

    let matchesFilter = true;
    if (filterStatus === 'active') {
      // Active = pending or contacted (not completed or lost)
      matchesFilter = r.status === 'pending' || r.status === 'contacted';
    } else if (filterStatus !== 'all') {
      matchesFilter = r.status === filterStatus;
    }

    return matchesSearch && matchesFilter;
  });
}

export function filterJobs(
  jobs: JobWithDriver[],
  searchTerm: string,
  jobStatusFilter: JobStatusFilter
): JobWithDriver[] {
  return jobs.filter(j => {
    const s = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm.trim() ||
                          (j.job_ref || '').toLowerCase().includes(s) ||
                          (j.sender_name || '').toLowerCase().includes(s) ||
                          (j.sender_phone || '').toLowerCase().includes(s) ||
                          (j.recipient_name || '').toLowerCase().includes(s) ||
                          (j.recipient_phone || '').toLowerCase().includes(s) ||
                          (j.pickup_location || '').toLowerCase().includes(s) ||
                          (j.delivery_location || '').toLowerCase().includes(s) ||
                          (j.tracking_token || '').toLowerCase().includes(s) ||
                          (j.company_name || '').toLowerCase().includes(s) ||
                          (j.id || '').toLowerCase().includes(s) ||
                          (j.cancellation_reason || '').toLowerCase().includes(s) ||
                          (j.return_reason || '').toLowerCase().includes(s) ||
                          (j.operator_notes || '').toLowerCase().includes(s) ||
                          (j.driver?.full_name || '').toLowerCase().includes(s);

    let matchesStatus = true;
    if (jobStatusFilter === 'pending') matchesStatus = j.status === 'pending';
    else if (jobStatusFilter === 'in_transit') matchesStatus = ['client_pickup', 'driver_pickup', 'driver_delivery'].includes(j.status);
    else if (jobStatusFilter === 'completed') matchesStatus = j.status === 'completed';
    else if (jobStatusFilter === 'returned') matchesStatus = j.status === 'returned';
    else if (jobStatusFilter === 'cancelled') matchesStatus = j.status === 'cancelled';

    return matchesSearch && matchesStatus;
  });
}

export function filterDrivers(
  drivers: Driver[],
  searchTerm: string,
  filterStatus: string,
  filterVehicle: string
): Driver[] {
  return drivers.filter(d => {
    const searchLower = searchTerm.toLowerCase();
    // Phones are stored as +971..., so match on digits and ignore a leading 0
    // ("0527..." finds "+97152...").
    const searchDigits = searchTerm.replace(/\D/g, '').replace(/^0+/, '');
    const phoneDigits = `${d.phone || ''} ${d.whatsapp || ''}`.replace(/[^\d ]/g, '');
    const matchesSearch = d.full_name.toLowerCase().includes(searchLower) ||
                          (d.email || '').toLowerCase().includes(searchLower) ||
                          d.phone.toLowerCase().includes(searchLower) ||
                          (searchDigits.length >= 3 && phoneDigits.includes(searchDigits)) ||
                          (d.base_location || '').toLowerCase().includes(searchLower) ||
                          (d.vehicle_type || '').toLowerCase().includes(searchLower);
    // filterStatus is shared with the Quotes tab's own filter and defaults
    // to 'active' (lowercase) there — that value isn't one of this tab's
    // six stage names, so treat anything unrecognized here as "all" rather
    // than showing an unexpectedly empty table on first visit.
    const DRIVER_STAGE_VALUES = ['Sourced', 'Screening', 'Docs Pending', 'Trial Scheduled', 'Active', 'Rejected'];
    const effectiveDriverFilter = DRIVER_STAGE_VALUES.includes(filterStatus) ? filterStatus : 'all';
    const matchesStatus = effectiveDriverFilter === 'all' || (d.pipeline_status || 'Sourced') === effectiveDriverFilter;
    const matchesVehicle = filterVehicle === 'all' || d.vehicle_type === filterVehicle;
    return matchesSearch && matchesStatus && matchesVehicle;
  });
}

export function filterBusinessInquiries(
  businessInquiries: BusinessInquiry[],
  searchTerm: string
): BusinessInquiry[] {
  return businessInquiries.filter(b => {
    const searchLower = searchTerm.toLowerCase();
    return b.company_name.toLowerCase().includes(searchLower) ||
           b.contact_person.toLowerCase().includes(searchLower) ||
           (b.corporate_code || '').toLowerCase().includes(searchLower);
  });
}

// ==========================================
// Business Accounts (jobs.business_id derived)
// ==========================================
// Pure derivations replacing the Business tab's former Math.random() mock
// data. All of these operate on whatever job list the caller already has —
// they don't fetch anything themselves.

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Every job linked to a given business account, from an already-fetched job list. */
export function filterJobsByBusiness(jobs: JobWithDriver[], businessId?: string | null): JobWithDriver[] {
  if (!businessId) return [];
  return jobs.filter(j => j.business_id === businessId);
}

/** Count of a business's jobs that are still in an active (non-terminal) status. */
export function getActiveJobCountForBusiness(jobs: JobWithDriver[], businessId?: string | null): number {
  return filterJobsByBusiness(jobs, businessId).filter(
    j => !['completed', 'cancelled', 'returned'].includes(j.status)
  ).length;
}

export interface BusinessFinancials {
  /** Sum of price_aed across jobs still owed (due or overdue) — reuses jobs.price_aed, no separate invoices ledger. */
  outstanding: number;
  overdueCount: number;
  nextDueDate: string | null;
}

export function getBusinessFinancials(jobs: JobWithDriver[]): BusinessFinancials {
  let outstanding = 0;
  let overdueCount = 0;
  let nextDueDate: string | null = null;

  for (const job of jobs) {
    if (job.payment_status === 'due' || job.payment_status === 'overdue') {
      outstanding += job.price_aed || 0;
      if (job.payment_status === 'overdue') overdueCount += 1;
      if (job.payment_due_date && (!nextDueDate || job.payment_due_date < nextDueDate)) {
        nextDueDate = job.payment_due_date;
      }
    }
  }

  return { outstanding, overdueCount, nextDueDate };
}

/**
 * Job counts for the trailing N months (oldest first), for the drawer's
 * monthly volume bar chart. Bucketed by jobs.created_at.
 */
export function getMonthlyVolumeByMonth(jobs: JobWithDriver[], months: number = 12): number[] {
  const now = new Date();
  const monthStarts: number[] = [];
  for (let i = months - 1; i >= 0; i--) {
    monthStarts.push(new Date(now.getFullYear(), now.getMonth() - i, 1).getTime());
  }
  const afterLastMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

  const buckets = new Array(months).fill(0);
  for (const job of jobs) {
    if (!job.created_at) continue;
    const created = new Date(job.created_at).getTime();
    for (let i = 0; i < months; i++) {
      const start = monthStarts[i];
      const end = i < months - 1 ? monthStarts[i + 1] : afterLastMonthStart;
      if (created >= start && created < end) {
        buckets[i] += 1;
        break;
      }
    }
  }
  return buckets;
}

export type RenewalTone = 'success' | 'warning' | 'neutral';

export interface RenewalStatus {
  label: string;
  tone: RenewalTone;
}

/**
 * Replaces the former `Math.random() > 0.7` branch. Purely a function of
 * business.status / business.contract_expiry — no job data needed.
 */
export function getBusinessRenewalStatus(business: BusinessInquiry): RenewalStatus {
  if (business.status === 'pending') return { label: 'Under Review', tone: 'warning' };
  if (business.status === 'archived') return { label: 'Archived', tone: 'neutral' };

  if (!business.contract_expiry) return { label: 'Active', tone: 'success' };

  const msLeft = new Date(business.contract_expiry).getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));

  if (msLeft < 0) return { label: `Expired (${Math.abs(daysLeft)}d ago)`, tone: 'warning' };
  if (msLeft <= THIRTY_DAYS_MS) return { label: `Renewal Due (${daysLeft}d)`, tone: 'warning' };
  return { label: 'Active', tone: 'success' };
}

/** Whether a business's contract renews within the next 30 days (used for the Renewals filter/stat). */
export function isRenewalDueSoon(business: BusinessInquiry): boolean {
  if (business.status !== 'active' || !business.contract_expiry) return false;
  const msLeft = new Date(business.contract_expiry).getTime() - Date.now();
  return msLeft >= 0 && msLeft <= THIRTY_DAYS_MS;
}

/**
 * On-time completion %, approximated per Decision 2 (no per-job SLA deadline
 * exists in the schema): completed / (completed + cancelled + returned) over
 * whatever job list is passed in. Returns null when there's no history yet
 * to compute a rate from, rather than a fabricated 0%/100%.
 */
export function getCompletionRate(jobs: JobWithDriver[]): number | null {
  const relevant = jobs.filter(j => ['completed', 'cancelled', 'returned'].includes(j.status));
  if (relevant.length === 0) return null;
  const completed = relevant.filter(j => j.status === 'completed').length;
  return Math.round((completed / relevant.length) * 1000) / 10;
}

export function getApprovedDrivers(drivers: Driver[]): Driver[] {
  const statusSortWeight: Record<string, number> = { available: 0, on_job: 1, offline: 2 };
  return drivers
    .filter(d => (d.pipeline_status || 'Sourced') === 'Active')
    .slice()
    .sort((a, b) => {
      const statusDiff = (statusSortWeight[a.status || 'offline'] ?? 2) - (statusSortWeight[b.status || 'offline'] ?? 2);
      if (statusDiff !== 0) return statusDiff;
      return (a.tier || 'D').localeCompare(b.tier || 'D');
    });
}

export interface DriverPoolSummary {
  dubaiActive: number;
  abuDhabiActive: number;
  dubaiTarget: number;
  abuDhabiTarget: number;
  totalActive: number;
  totalTarget: number;
  inPipeline: number;
}

// Target-vs-actual, mirroring the "Summary" tab of
// Nokael_Driver_Onboarding_Tracker.xlsx (10 Dubai + 5 Abu Dhabi = 15).
const DRIVER_TARGETS: Record<'Dubai' | 'Abu Dhabi', number> = { 'Dubai': 10, 'Abu Dhabi': 5 };

export function getDriverPoolSummary(drivers: Driver[]): DriverPoolSummary {
  const activeDrivers = drivers.filter(d => (d.pipeline_status || 'Sourced') === 'Active');
  return {
    dubaiActive: activeDrivers.filter(d => d.emirate === 'Dubai').length,
    abuDhabiActive: activeDrivers.filter(d => d.emirate === 'Abu Dhabi').length,
    dubaiTarget: DRIVER_TARGETS['Dubai'],
    abuDhabiTarget: DRIVER_TARGETS['Abu Dhabi'],
    totalActive: activeDrivers.length,
    totalTarget: DRIVER_TARGETS['Dubai'] + DRIVER_TARGETS['Abu Dhabi'],
    inPipeline: drivers.filter(d => !['Active', 'Rejected'].includes(d.pipeline_status || 'Sourced')).length,
  };
}

export interface DashboardStats {
  total: number;
  pending: number;
  completed: number;
  drivers: number;
  pendingDrivers: number;
  business: number;
  pendingBusiness: number;
}

export function getDashboardStats(
  requests: QuoteRequest[],
  drivers: Driver[],
  businessInquiries: BusinessInquiry[]
): DashboardStats {
  return {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    completed: requests.filter(r => r.status === 'completed').length,
    drivers: drivers.length,
    pendingDrivers: drivers.filter(d => !['Active', 'Rejected'].includes(d.pipeline_status || 'Sourced')).length,
    business: businessInquiries.length,
    pendingBusiness: businessInquiries.filter(b => b.status === 'pending').length,
  };
}

// ==========================================
// Alerts
// ==========================================
// Local-only for now — there is no `alerts` table. These are computed fresh
// from the live `jobs` collection on every render rather than persisted, so
// there is nothing to fetch, subscribe to, or migrate. `now` is a parameter
// (not a fresh Date.now() inline) purely so this stays a pure, unit-testable
// (data, now) -> data function like everything else in this file.

export type AlertType = 'slaBreach' | 'stalledJob' | 'failedHandoff' | 'signalLost';
export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  jobId: string;
  jobRef: string;
  type: AlertType;
  severity: AlertSeverity;
  // ISO timestamp the condition was first true — used to render "x min ago"
  // and to sort/expire alerts. Not a creation time for a stored row.
  detectedAt: string;
}

// A driver actively en route (driver_pickup/driver_delivery) who hasn't
// reported a GPS ping in this long is worth a dispatcher's attention.
const STALLED_AFTER_MS = 20 * 60 * 1000;
// Cancelled jobs stop being "alerts" (as opposed to just history) after this long.
const RECENT_FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function getAlerts(jobs: JobWithDriver[], now: number = Date.now()): Alert[] {
  const alerts: Alert[] = [];

  for (const job of jobs) {
    if (!job.id) continue;
    const jobRef = job.job_ref || job.id;

    // SLA breach — still waiting for a driver past the scheduled pickup window
    if (job.status === 'pending' && job.scheduled_pickup_at) {
      const scheduled = new Date(job.scheduled_pickup_at).getTime();
      if (scheduled < now) {
        alerts.push({ id: `${job.id}-slaBreach`, jobId: job.id, jobRef, type: 'slaBreach', severity: 'critical', detectedAt: job.scheduled_pickup_at });
      }
    }

    // Driver is meant to be actively moving — check GPS signal
    if (job.status === 'driver_pickup' || job.status === 'driver_delivery') {
      if (job.driver_lat == null || job.driver_lng == null) {
        alerts.push({
          id: `${job.id}-signalLost`,
          jobId: job.id,
          jobRef,
          type: 'signalLost',
          severity: 'info',
          detectedAt: job.driver_updated_at || job.updated_at || job.created_at || new Date(now).toISOString(),
        });
      } else if (job.driver_updated_at) {
        const updated = new Date(job.driver_updated_at).getTime();
        if (now - updated > STALLED_AFTER_MS) {
          alerts.push({ id: `${job.id}-stalledJob`, jobId: job.id, jobRef, type: 'stalledJob', severity: 'warning', detectedAt: job.driver_updated_at });
        }
      }
    }

    // Recently failed / cancelled — surfaced briefly so a bad handoff doesn't
    // get missed, then ages out of the alert feed (it's still in job history).
    if (job.status === 'cancelled' && job.cancelled_at) {
      const cancelled = new Date(job.cancelled_at).getTime();
      if (now - cancelled < RECENT_FAILURE_WINDOW_MS) {
        alerts.push({ id: `${job.id}-failedHandoff`, jobId: job.id, jobRef, type: 'failedHandoff', severity: 'critical', detectedAt: job.cancelled_at });
      }
    }
  }

  const severityWeight: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => {
    const diff = severityWeight[a.severity] - severityWeight[b.severity];
    if (diff !== 0) return diff;
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
  });
}
