// ==========================================
// Live dispatch: driver positions and geofence events
// (see supabase-map-geofence.sql)
// ==========================================
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
