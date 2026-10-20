// ==========================================
// Live dispatch: driver positions and geofence events
// (see supabase-map-geofence.sql)
// ==========================================
import React from 'react';
import { supabase } from './supabase';

export interface DriverPosition {
  driver_id: string;
  latitude: number;
  longitude: number;
  last_update: string;
  accuracy_meters: number | null;
  is_tracking_active: boolean;
}

/** A driver is "online" when the app has sent a fix this recently and tracking is on. */
export const ONLINE_WITHIN_MS = 5 * 60 * 1000;

export const isOnline = (p: DriverPosition | undefined, now = Date.now()): boolean =>
  !!p && p.is_tracking_active && now - new Date(p.last_update).getTime() <= ONLINE_WITHIN_MS;

/** Last known position of every active, approved driver in the org. */
export const getDriverPositions = async (orgId: string): Promise<DriverPosition[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_dispatch_driver_positions', { p_organization_id: orgId });
  if (error) throw error;
  return (data || []) as DriverPosition[];
};

export type JobEventType = 'geofence_pickup' | 'geofence_delivery';

export interface JobEvent {
  id: string;
  organization_id: string;
  job_id: string;
  driver_id: string | null;
  type: JobEventType;
  distance_m: number | null;
  radius_m: number | null;
  created_at: string;
  acknowledged_at: string | null;
}

export const getRecentJobEvents = async (sinceHours = 12): Promise<JobEvent[]> => {
  if (!supabase) return [];
  const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();
  const { data, error } = await supabase
    .from('job_events')
    .select('id, organization_id, job_id, driver_id, type, distance_m, radius_m, created_at, acknowledged_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as JobEvent[];
};

/** New geofence events as they happen (RLS limits them to the viewer's org). */
export const subscribeToJobEvents = (onInsert: (event: JobEvent) => void) => {
  if (!supabase) return null;
  return supabase
    .channel('job_events_realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'job_events' }, payload => onInsert(payload.new as JobEvent))
    .subscribe();
};

export const acknowledgeJobEvent = async (id: string): Promise<void> => {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('job_events')
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user?.id ?? null })
    .eq('id', id);
  if (error) throw error;
};

// ==========================================
// Client link views (supabase-link-views-migration.sql in the portal repo)
// ==========================================

export interface LinkView {
  party: 'sender' | 'recipient';
  first_seen_at: string;
  last_seen_at: string;
  visits: number;
}

/** A client counts as "viewing now" this soon after the page's last heartbeat (sent every 2 min). */
export const VIEWING_NOW_MS = 3 * 60 * 1000;

/**
 * When the sender / recipient opened the link dispatch sent them, kept live:
 * loaded once, then updated by realtime as the client's page reports in.
 * No polling.
 */
export function useLinkViews(jobId: string | undefined): Partial<Record<LinkView['party'], LinkView>> {
  const [views, setViews] = React.useState<Partial<Record<LinkView['party'], LinkView>>>({});
  React.useEffect(() => {
    setViews({});
    if (!jobId || !supabase) return;
    const sb = supabase;
    let alive = true;
    const put = (row: LinkView) => { if (alive) setViews(prev => ({ ...prev, [row.party]: row })); };
    sb.from('job_link_views').select('party, first_seen_at, last_seen_at, visits').eq('job_id', jobId)
      .then(({ data }) => (data as LinkView[] | null)?.forEach(put));
    const channel = sb.channel(`link-views:${jobId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_link_views', filter: `job_id=eq.${jobId}` },
        payload => { if (payload.new && (payload.new as LinkView).party) put(payload.new as LinkView); })
      .subscribe();
    return () => { alive = false; sb.removeChannel(channel); };
  }, [jobId]);
  return views;
}
