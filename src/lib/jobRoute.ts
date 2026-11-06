import type { Job } from './supabase';

/**
 * Short route tag shown after "Dubai → Abu Dhabi" in lists: '' for one-way,
 * "⇄ round trip · 4 stops" or "+2 stops" for jobs with a stop list. For those,
 * pickup_emirate / delivery_emirate are stop 1 and the first drop-off.
 */
export function routeTag(job: Pick<Job, 'job_kind' | 'stops'>): string {
  if (!job.job_kind || job.job_kind === 'one_way') return '';
  const n = job.stops?.length ?? 0;
  if (job.job_kind === 'round_trip') return n ? `⇄ round trip · ${n} stops` : '⇄ round trip';
  return n > 2 ? `+${n - 2} stops` : 'multi-stop';
}

/** "Dubai → Abu Dhabi" plus the tag, for one-line route summaries. */
export const routeSummary = (job: Pick<Job, 'pickup_emirate' | 'delivery_emirate' | 'job_kind' | 'stops'>): string => {
  const tag = routeTag(job);
  return `${job.pickup_emirate} → ${job.delivery_emirate}${tag ? ` · ${tag}` : ''}`;
};
