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
  | 'client_delivery_at'>;

export const driverStage = (job: StageFields): DriverStage => {
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
export type NextAction = 'arrive_pickup' | 'collect' | 'arrive_dropoff' | 'deliver' | 'recipient_confirm';

export const nextAction = (job: StageFields): NextAction | null => {
  const stage = jobStage(job);
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
