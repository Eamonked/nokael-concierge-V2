import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Flag, X, Bell, Truck } from 'lucide-react';
import { supabase, type JobWithDriver } from '../../../lib/supabase';
import { subscribeToJobEvents, acknowledgeJobEvent, type JobEvent } from '../../../lib/dispatch';
import { formatDistance } from '../../../lib/geo';
import { jobStage, isRecentLocalChange, STAGE_LABEL, type JobStage } from '../../../lib/jobStage';

/** A driver moved a job to a new stage (seen in the live jobs feed, not job_events). */
type StageToast = { id: string; job_id: string; type: 'stage'; stage: JobStage };
type Toast = JobEvent | StageToast;
const isStage = (toast: Toast): toast is StageToast => toast.type === 'stage';

// Stages worth interrupting dispatch for, in the driver app's own words.
const ANNOUNCED: JobStage[] = ['at_pickup', 'picked_up', 'at_dropoff', 'dropped_off', 'completed', 'returned'];

const TOAST_MS = 20_000;

// Short two-tone chime, generated so there's no audio file to ship.
const chime = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.32);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch { /* audio blocked until the user interacts: fine */ }
};

/**
 * Pops a card (and, if allowed, a desktop notification) whenever a driver
 * enters the pickup or drop-off geofence of one of the org's jobs (job_events
 * via realtime; see supabase-map-geofence.sql), or moves a job to a new stage
 * from the driver app (arrived, collected, delivered, returned).
 */
export function GeofenceAlerts({ jobs, onOpenJob }: { jobs: JobWithDriver[]; onOpenJob: (job: JobWithDriver) => void }) {
  const { t } = useTranslation('dashboard');
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [permission, setPermission] = React.useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const jobsRef = React.useRef(jobs);
  jobsRef.current = jobs;

  const describe = React.useCallback((event: Toast) => {
    const job = jobsRef.current.find(j => j.id === event.job_id);
    const ref = job?.job_ref != null ? `#${job.job_ref.toString().padStart(4, '0')}` : '';
    const driver = job?.driver?.full_name || t('geofence.driver', { defaultValue: 'The driver' });
    if (isStage(event)) {
      const where = ['at_pickup', 'picked_up'].includes(event.stage) ? job?.pickup_location : job?.delivery_location;
      return { job, title: `${driver}: ${STAGE_LABEL[event.stage]}`, body: [ref, where].filter(Boolean).join(' · ') };
    }
    const title = event.type === 'geofence_pickup'
      ? t('geofence.nearPickupTitle', { defaultValue: '{{driver}} is near pickup', driver })
      : t('geofence.nearDropoffTitle', { defaultValue: '{{driver}} is near drop-off', driver });
    const where = event.type === 'geofence_pickup' ? job?.pickup_location : job?.delivery_location;
    const body = [ref, where, event.distance_m != null ? t('geofence.away', { defaultValue: '{{distance}} away', distance: formatDistance(event.distance_m) }) : null]
      .filter(Boolean).join(' · ');
    return { job, title, body };
  }, [t]);

  const push = React.useCallback((event: Toast) => {
    setToasts(prev => [event, ...prev.filter(e => e.id !== event.id)].slice(0, 4));
    chime();
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      const { title, body, job } = describe(event);
      const n = new Notification(title, { body, tag: event.id });
      n.onclick = () => { window.focus(); if (job) onOpenJob(job); n.close(); };
    }
    setTimeout(() => setToasts(prev => prev.filter(e => e.id !== event.id)), TOAST_MS);
  }, [describe, onOpenJob]);

  React.useEffect(() => {
    const channel = subscribeToJobEvents(push);
    return () => { if (channel && supabase) supabase.removeChannel(channel); };
  }, [push]);

  // Stage changes: compare each refresh of the live jobs list with the last
  // one. The first load only records where everything is; changes made from
  // this tab (dispatch overrides) aren't announced back to the person who made them.
  const lastStages = React.useRef<Map<string, JobStage> | null>(null);
  React.useEffect(() => {
    const current = new Map(jobs.filter(j => j.id).map(j => [j.id!, jobStage(j)]));
    const previous = lastStages.current;
    lastStages.current = current;
    if (!previous) return;
    current.forEach((stage, jobId) => {
      const before = previous.get(jobId);
      if (!before || before === stage || !ANNOUNCED.includes(stage) || isRecentLocalChange(jobId)) return;
      // Delivered shows as 'dropped_off' then 'completed' within one change; announce it once.
      if (stage === 'completed' && before === 'dropped_off') return;
      push({ id: `stage-${jobId}-${stage}`, job_id: jobId, type: 'stage', stage });
    });
  }, [jobs, push]);

  const dismiss = (event: Toast) => {
    setToasts(prev => prev.filter(e => e.id !== event.id));
    if (isStage(event)) return;
    acknowledgeJobEvent(event.id).catch(() => { /* viewers can't acknowledge; the toast still goes */ });
  };

  const askPermission = () => {
    if (typeof Notification === 'undefined') return;
    Notification.requestPermission().then(setPermission);
  };

  return (
    <div className="geofence-toasts" aria-live="polite">
      {toasts.map(event => {
        const { job, title, body } = describe(event);
        const pickupSide = isStage(event) ? ['at_pickup', 'picked_up'].includes(event.stage) : event.type === 'geofence_pickup';
        const Icon = isStage(event) ? Truck : pickupSide ? MapPin : Flag;
        return (
          <div key={event.id} className={`geofence-toast ${pickupSide ? 'pickup' : 'dropoff'}`} role="status">
            <span className="geofence-toast-icon" aria-hidden="true"><Icon /></span>
            <button type="button" className="geofence-toast-body" onClick={() => { if (job) onOpenJob(job); dismiss(event); }}>
              <b>{title}</b>
              <small>{body}</small>
            </button>
            <button type="button" className="geofence-toast-close" onClick={() => dismiss(event)} aria-label={t('geofence.dismiss', { defaultValue: 'Dismiss' })}>
              <X />
            </button>
          </div>
        );
      })}
      {toasts.length > 0 && permission === 'default' && (
        <button type="button" className="geofence-permission" onClick={askPermission}>
          <Bell />{t('geofence.enableDesktop', { defaultValue: 'Also notify me when this tab is in the background' })}
        </button>
      )}
    </div>
  );
}
