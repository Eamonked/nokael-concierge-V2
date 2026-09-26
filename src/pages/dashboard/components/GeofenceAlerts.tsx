import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Flag, X, Bell } from 'lucide-react';
import { supabase, type JobWithDriver } from '../../../lib/supabase';
import { subscribeToJobEvents, acknowledgeJobEvent, type JobEvent } from '../../../lib/dispatch';
import { formatDistance } from '../../../lib/geo';

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
 * enters the pickup or drop-off geofence of one of the org's jobs.
 * Events come from job_events via realtime; see supabase-map-geofence.sql.
 */
export function GeofenceAlerts({ jobs, onOpenJob }: { jobs: JobWithDriver[]; onOpenJob: (job: JobWithDriver) => void }) {
  const { t } = useTranslation('dashboard');
  const [toasts, setToasts] = React.useState<JobEvent[]>([]);
  const [permission, setPermission] = React.useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const jobsRef = React.useRef(jobs);
  jobsRef.current = jobs;

  const describe = React.useCallback((event: JobEvent) => {
    const job = jobsRef.current.find(j => j.id === event.job_id);
    const ref = job?.job_ref != null ? `#${job.job_ref.toString().padStart(4, '0')}` : '';
    const driver = job?.driver?.full_name || t('geofence.driver', { defaultValue: 'The driver' });
    const title = event.type === 'geofence_pickup'
      ? t('geofence.nearPickupTitle', { defaultValue: '{{driver}} is near pickup', driver })
      : t('geofence.nearDropoffTitle', { defaultValue: '{{driver}} is near drop-off', driver });
    const where = event.type === 'geofence_pickup' ? job?.pickup_location : job?.delivery_location;
    const body = [ref, where, event.distance_m != null ? t('geofence.away', { defaultValue: '{{distance}} away', distance: formatDistance(event.distance_m) }) : null]
      .filter(Boolean).join(' · ');
    return { job, title, body };
  }, [t]);

  React.useEffect(() => {
    const channel = subscribeToJobEvents(event => {
      setToasts(prev => [event, ...prev.filter(e => e.id !== event.id)].slice(0, 4));
      chime();
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        const { title, body, job } = describe(event);
        const n = new Notification(title, { body, tag: event.id });
        n.onclick = () => { window.focus(); if (job) onOpenJob(job); n.close(); };
      }
      setTimeout(() => setToasts(prev => prev.filter(e => e.id !== event.id)), TOAST_MS);
    });
    return () => { if (channel && supabase) supabase.removeChannel(channel); };
  }, [describe, onOpenJob]);

  const dismiss = (event: JobEvent) => {
    setToasts(prev => prev.filter(e => e.id !== event.id));
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
        const Icon = event.type === 'geofence_pickup' ? MapPin : Flag;
        return (
          <div key={event.id} className={`geofence-toast ${event.type === 'geofence_pickup' ? 'pickup' : 'dropoff'}`} role="status">
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
