import { format, formatDistanceToNow } from 'date-fns';
import type { JobWithDriver } from '../../lib/supabase';

// Helper to format timestamps safely
export const formatTimestamp = (dateStr?: string | null) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return {
      time: format(d, 'hh:mm a'),
      date: format(d, 'dd MMM yyyy'),
      ago: formatDistanceToNow(d, { addSuffix: true }),
    };
  } catch {
    return null;
  }
};

export function computeCustodyMilestones(activeJob: JobWithDriver) {
  const ts1 = formatTimestamp(activeJob.created_at);
  const ts2 = formatTimestamp(
    activeJob.client_pickup_at ||
    activeJob.client_pickup_confirmed_at ||
    activeJob.driver_arrived_pickup_at ||
    activeJob.sender_ready_at
  );
  const ts3 = formatTimestamp(activeJob.driver_pickup_at || activeJob.driver_pickup_confirmed_at);
  const ts4 = formatTimestamp(activeJob.driver_delivery_at || activeJob.driver_arrived_delivery_at || activeJob.driver_delivery_confirmed_at);
  const ts5 = formatTimestamp(activeJob.client_delivery_at || activeJob.client_delivery_confirmed_at);
  const tsCancel = formatTimestamp(activeJob.cancelled_at || (activeJob.status === 'cancelled' ? activeJob.updated_at : null));

  const isCancelled = activeJob.status === 'cancelled';

  const step2Done = Boolean(ts2) || ['client_pickup', 'driver_pickup', 'driver_delivery', 'completed'].includes(activeJob.status) || Boolean(ts3) || Boolean(ts4) || Boolean(ts5);
  const step3Done = Boolean(ts3) || ['driver_pickup', 'driver_delivery', 'completed'].includes(activeJob.status) || Boolean(ts4) || Boolean(ts5);
  const step4Done = Boolean(ts4) || ['driver_delivery', 'completed'].includes(activeJob.status) || Boolean(ts5);
  const step5Done = Boolean(ts5) || activeJob.status === 'completed';

  // Find where failure occurred (last completed milestone index)
  let lastCompletedStep = 1;
  if (step4Done) lastCompletedStep = 4;
  else if (step3Done) lastCompletedStep = 3;
  else if (step2Done) lastCompletedStep = 2;
  else lastCompletedStep = 1;

  return { ts1, ts2, ts3, ts4, ts5, tsCancel, isCancelled, step2Done, step3Done, step4Done, step5Done, lastCompletedStep };
}
