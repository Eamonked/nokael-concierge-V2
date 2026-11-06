import type { Job } from './supabase';

/* ------------------------------------------------------------------ */
/* One stage model for dispatch, the driver app and the client page.   */
/*                                                                     */
/* `DriverStage` is exactly what the server's driver_jobs RPC returns  */
/* (and so what both driver apps show): it is derived from the four    */
/* driver timestamps, latest first. Keep `driverStage` in sync with    */
/* the `'stage'` CASE in driver_jobs.                                  */
/* ------------------------------------------------------------------ */

export type DriverStage = 'heading_to_pickup' | 'at_pickup' | 'picked_up' | 'at_dropoff' | 'dropped_off';

/** What dispatch sees: the driver's stage, or why there isn't one. */
export type JobStage = DriverStage | 'unassigned' | 'completed' | 'cancelled' | 'returned';

type StageFields = Pick<Job,
  | 'status' | 'driver_id' | 'confirmation_mode' | 'created_at'
  | 'driver_arrived_pickup_at' | 'driver_pickup_at' | 'driver_arrived_delivery_at' | 'driver_delivery_at'
  | 'client_delivery_at'> & Partial<Pick<Job, 'job_kind' | 'stops'>>;

/** Multi-stop / round-trip jobs: the stops, in order (empty for one-way jobs). */
const stopList = (job: StageFields) =>
  job.job_kind && job.job_kind !== 'one_way' ? [...(job.stops ?? [])].sort((a, b) => a.seq - b.seq) : [];

export const driverStage = (job: StageFields): DriverStage => {
  // Multi-stop: the stage at the stop the driver is on now (the app shows the
  // same thing stop by stop; driver_jobs' legacy 'stage' is only for old apps).
  const stops = stopList(job);
  if (stops.length) {
    const cur = stops.find(s => !s.handed_at && !s.skipped_at);
    if (!cur) return 'dropped_off';
    if (cur.arrived_at) return cur.kind === 'pickup' ? 'at_pickup' : 'at_dropoff';
    return stops.some(s => s.handed_at) ? 'picked_up' : 'heading_to_pickup';
  }
  if (job.driver_delivery_at) return 'dropped_off';
  if (job.driver_arrived_delivery_at) return 'at_dropoff';
  if (job.driver_pickup_at) return 'picked_up';
  if (job.driver_arrived_pickup_at) return 'at_pickup';
  return 'heading_to_pickup';
};

const fourStepAwaitingRecipient = (job: StageFields) =>
  job.confirmation_mode !== 'driver_only' && !!job.driver_delivery_at && !job.client_delivery_at;

export const jobStage = (job: StageFields): JobStage => {
  if (job.status === 'cancelled') return 'cancelled';
  if (job.status === 'returned') return 'returned';
  if (job.status === 'completed' && !fourStepAwaitingRecipient(job)) return 'completed';
  if (!job.driver_id && !job.driver_arrived_pickup_at && !job.driver_pickup_at) return 'unassigned';
  return driverStage(job);
};

/** Labels match the driver app's progress tracker word for word. */
export const STAGE_LABEL: Record<JobStage, string> = {
  unassigned: 'Awaiting driver',
  heading_to_pickup: 'Heading to pickup',
  at_pickup: 'Arrived at pickup',
  picked_up: 'Package collected',
  at_dropoff: 'Arrived at drop-off',
  dropped_off: 'Delivered',
  completed: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

/** Badge tone for a stage: neutral / moving / attention / done / bad. */
export const STAGE_TONE: Record<JobStage, 'neutral' | 'moving' | 'attention' | 'done' | 'bad'> = {
  unassigned: 'attention',
  heading_to_pickup: 'moving',
  at_pickup: 'attention',
  picked_up: 'moving',
  at_dropoff: 'attention',
  dropped_off: 'done',
  completed: 'done',
  cancelled: 'bad',
  returned: 'bad',
};

export interface StageStep {
  key: string;
  label: string;
  /** When it happened, if the column records it. */
  at: string | null;
  done: boolean;
}

/**
 * The timeline dispatch sees: booking, then the driver app's five steps,
 * then (four-step jobs only) the recipient's own confirmation. A step also
 * counts as done when a later one is, since an override can skip ahead.
 */
export const stageSteps = (job: StageFields): StageStep[] => {
  const stops = stopList(job);
  if (stops.length) {
    // Booked, assigned, then one step per stop handover.
    const stopRows = [
      { key: 'booked', label: 'Booked', at: job.created_at ?? null, reached: true },
      { key: 'heading', label: 'Driver assigned', at: null, reached: !!job.driver_id },
      ...stops.map(s => ({
        key: `stop-${s.seq}`,
        label: s.skipped_at && !s.handed_at
          ? `Stop ${s.seq} · Not visited (job ended by dispatch)`
          : `Stop ${s.seq} · ${s.kind === 'pickup' ? 'Collected' : 'Delivered'}${s.handed_at ? '' : s.arrived_at ? ' (driver there)' : ''}`,
        at: s.handed_at ?? s.skipped_at ?? s.arrived_at ?? null,
        reached: !!s.handed_at || !!s.skipped_at,
      })),
    ];
    const last = stopRows.map(r => r.reached).lastIndexOf(true);
    return stopRows.map(({ reached, ...row }, i) => ({ ...row, done: reached || i <= last }));
  }
  const rows: Array<Omit<StageStep, 'done'> & { reached: boolean }> = [
    { key: 'booked', label: 'Booked', at: job.created_at ?? null, reached: true },
    { key: 'heading', label: 'Heading to pickup', at: null, reached: !!job.driver_id },
    { key: 'at_pickup', label: 'Arrived at pickup', at: job.driver_arrived_pickup_at ?? null, reached: !!job.driver_arrived_pickup_at },
    { key: 'picked_up', label: 'Package collected', at: job.driver_pickup_at ?? null, reached: !!job.driver_pickup_at },
    { key: 'at_dropoff', label: 'Arrived at drop-off', at: job.driver_arrived_delivery_at ?? null, reached: !!job.driver_arrived_delivery_at },
    // Older jobs could complete on the recipient's confirmation alone.
    { key: 'dropped_off', label: 'Delivered', at: job.driver_delivery_at ?? job.client_delivery_at ?? null,
      reached: !!job.driver_delivery_at || !!job.client_delivery_at || job.status === 'completed' },
  ];
  if (job.confirmation_mode !== 'driver_only') {
    rows.push({ key: 'recipient', label: 'Recipient confirmed', at: job.client_delivery_at ?? null, reached: !!job.client_delivery_at });
  }
  const lastReached = rows.map(r => r.reached).lastIndexOf(true);
  return rows.map(({ reached, ...row }, i) => ({ ...row, done: reached || i <= lastReached }));
};

/** The next thing the driver would do, for dispatch's "mark it for them" button. */
export type NextAction = 'arrive_pickup' | 'collect' | 'arrive_dropoff' | 'deliver' | 'recipient_confirm' | 'stop_arrive' | 'stop_handover';

export const nextAction = (job: StageFields): NextAction | null => {
  const stage = jobStage(job);
  const stops = stopList(job);
  if (stops.length) {
    if (['completed', 'cancelled', 'returned', 'unassigned'].includes(stage)) return null;
    const cur = stops.find(s => !s.handed_at && !s.skipped_at);
    if (!cur) return null;
    return cur.arrived_at ? 'stop_handover' : 'stop_arrive';
  }
  switch (stage) {
    case 'heading_to_pickup': return 'arrive_pickup';
    case 'at_pickup': return 'collect';
    case 'picked_up': return 'arrive_dropoff';
    case 'at_dropoff': return 'deliver';
    case 'dropped_off': return fourStepAwaitingRecipient(job) ? 'recipient_confirm' : null;
    default: return null;
  }
};

export const NEXT_ACTION_LABEL: Record<NextAction, string> = {
  arrive_pickup: 'Mark arrived at pickup',
  collect: 'Mark package collected',
  arrive_dropoff: 'Mark arrived at drop-off',
  deliver: 'Mark delivered',
  recipient_confirm: 'Mark recipient confirmed',
  stop_arrive: 'Mark arrived at next stop',
  stop_handover: 'Mark next stop handed over',
};

/** NEXT_ACTION_LABEL, with the stop number for multi-stop jobs. */
export const nextActionLabel = (job: StageFields, action: NextAction): string => {
  const cur = stopList(job).find(s => !s.handed_at && !s.skipped_at);
  if (cur && action === 'stop_arrive') return `Mark arrived at stop ${cur.seq}`;
  if (cur && action === 'stop_handover') return `Mark stop ${cur.seq} ${cur.kind === 'pickup' ? 'collected' : 'delivered'}`;
  return NEXT_ACTION_LABEL[action];
};

/* Stage changes made from this tab, so the "driver update" alert only fires
   for changes that came from somewhere else. */
const localChanges = new Map<string, number>();
const LOCAL_WINDOW_MS = 15_000;

export const noteLocalStageChange = (jobId: string) => localChanges.set(jobId, Date.now());
export const isRecentLocalChange = (jobId: string) => {
  const at = localChanges.get(jobId);
  return at != null && Date.now() - at < LOCAL_WINDOW_MS;
};
