import type { QuoteRequest, Driver, JobWithDriver, BusinessInquiry } from '../../lib/supabase';

/**
 * Pure, unit-testable derivations of the dashboard's server-backed state.
 * Nothing here reads or writes React state — everything is (data, filters) -> data,
 * so these can be exercised directly in Vitest without mounting the component.
 */

export type JobStatusFilter = 'all' | 'pending' | 'in_transit' | 'completed' | 'cancelled';

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
                          (j.operator_notes || '').toLowerCase().includes(s) ||
                          (j.driver?.full_name || '').toLowerCase().includes(s);

    let matchesStatus = true;
    if (jobStatusFilter === 'pending') matchesStatus = j.status === 'pending';
    else if (jobStatusFilter === 'in_transit') matchesStatus = ['client_pickup', 'driver_pickup', 'driver_delivery'].includes(j.status);
    else if (jobStatusFilter === 'completed') matchesStatus = j.status === 'completed';
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
    const matchesSearch = d.full_name.toLowerCase().includes(searchLower) ||
                          d.email.toLowerCase().includes(searchLower) ||
                          d.phone.toLowerCase().includes(searchLower) ||
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
