import React from 'react';
import { MapContainer, TileLayer, Marker, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDistanceToNow } from 'date-fns';
import { ar as arLocale } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import {
  Crosshair, WifiOff, Truck, Users, PackageOpen, X, Phone, MapPin, Flag, Loader2, ExternalLink, AlertTriangle,
} from 'lucide-react';
import { supabase, assignDriverToJob, updateJob, type Driver, type JobWithDriver } from '../../lib/supabase';
import { jobStage, STAGE_LABEL } from '../../lib/jobStage';
import { getDriverPositions, isOnline, type DriverPosition } from '../../lib/dispatch';
import { validCoord, distanceMeters, formatDistance, geocodeAddress, type LatLng } from '../../lib/geo';
import { getEtaMinutes } from '../../lib/eta';
import { TERMINAL_STATUSES } from './constants';
import { useCanWrite } from './permissions';
import { useTheme } from '../../context/ThemeContext';

// Driver positions refresh this often while the map is open.
const POSITION_POLL_MS = 15_000;
// A job's own driver_lat/lng older than this is shown greyed out.
const STALE_AFTER_MS = 5 * 60 * 1000;
// Dubai ↔ Abu Dhabi corridor, used until there is something to fit to.
const DEFAULT_CENTER: LatLng = [24.9, 54.9];
// Matches the defaults in driver_publish_location when the org hasn't set its own.
const DEFAULT_GEOFENCE = { pickup_m: 300, delivery_m: 300 };

type Mode = 'active' | 'unassigned' | 'drivers';
type Selection = { kind: 'job'; id: string } | { kind: 'driver'; id: string } | null;

const dot = (color: string, size: number, ring = '#fff', square = false) =>
  L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:${square ? '5px' : '9999px'};background:${color};border:3px solid ${ring};box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const ICON = {
  driverLive: dot('#10b981', 24, '#0b0f19'),
  driverLiveSel: dot('#10b981', 32, '#ffffff'),
  driverBusy: dot('#f59e0b', 24, '#0b0f19'),
  driverBusySel: dot('#f59e0b', 32, '#ffffff'),
  driverStale: dot('#94a3b8', 22, '#0b0f19'),
  driverStaleSel: dot('#94a3b8', 30, '#ffffff'),
  jobOpen: dot('#6366f1', 20, '#ffffff', true),
  jobOpenSel: dot('#6366f1', 28, '#0b0f19', true),
  pickup: dot('#3b82f6', 16),
  delivery: dot('#ef4444', 16),
};

/** Leaflet only notices window resizes; redraw tiles when the map box itself changes size. */
const TrackSize: React.FC = () => {
  const map = useMap();
  React.useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
};

const FitBounds: React.FC<{ points: LatLng[]; nonce: number }> = ({ points, nonce }) => {
  const map = useMap();
  const fitted = React.useRef(false);
  const fit = React.useCallback(() => {
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 13 });
  }, [map, points]);
  React.useEffect(() => {
    if (!fitted.current && points.length) { fit(); fitted.current = true; }
  }, [points, fit]);
  React.useEffect(() => { if (nonce > 0) fit(); }, [nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

const FlyTo: React.FC<{ target: LatLng | null }> = ({ target }) => {
  const map = useMap();
  React.useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 12), { duration: 0.7 });
  }, [target?.[0], target?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

interface LiveMapViewProps {
  jobs: JobWithDriver[];
  drivers: Driver[];
  orgId: string | null;
  onJobClick: (job: JobWithDriver) => void;
  onChanged: () => void | Promise<void>;
}

export const LiveMapView: React.FC<LiveMapViewProps> = ({ jobs, drivers, orgId, onJobClick, onChanged }) => {
  const { t, i18n } = useTranslation('dashboard');
  const isArabic = !!i18n.language?.startsWith('ar');
  const dateLocale = isArabic ? arLocale : undefined;
  const isDark = useTheme().theme === 'dark';
  const canWrite = useCanWrite();

  const [mode, setMode] = React.useState<Mode>('active');
  const [selection, setSelection] = React.useState<Selection>(null);
  const [fitNonce, setFitNonce] = React.useState(0);
  const [positions, setPositions] = React.useState<DriverPosition[]>([]);
  const [positionsError, setPositionsError] = React.useState(false);
  const [geofence, setGeofence] = React.useState(DEFAULT_GEOFENCE);
  const [assigning, setAssigning] = React.useState<string | null>(null);
  const [eta, setEta] = React.useState<{ key: string; minutes: number | null; loading: boolean } | null>(null);

  // Clock for "online" / "stale" as time passes without new data.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  // Driver positions (security-definer RPC; the raw table isn't readable by the dashboard).
  React.useEffect(() => {
    if (!orgId) return;
    let alive = true;
    const load = () =>
      getDriverPositions(orgId)
        .then(rows => { if (alive) { setPositions(rows); setPositionsError(false); } })
        .catch(err => { console.warn('[map] driver positions:', err); if (alive) setPositionsError(true); });
    load();
    const id = setInterval(load, POSITION_POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [orgId]);

  // The org's geofence radius, for drawing the circles.
  React.useEffect(() => {
    if (!orgId || !supabase) return;
    supabase.from('organizations').select('settings').eq('id', orgId).maybeSingle()
      .then(({ data }) => {
        const g = (data?.settings as any)?.geofence;
        if (g) setGeofence({ pickup_m: Number(g.pickup_m) || 300, delivery_m: Number(g.delivery_m) || 300 });
      });
  }, [orgId]);

  // Open jobs typed without coordinates can't be placed on the map. Look their
  // addresses up once per session and save the result (writers only).
  const geocoded = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (!canWrite) return;
    const todo = jobs.filter(j =>
      j.id && !TERMINAL_STATUSES.includes(j.status) && !geocoded.current.has(j.id) &&
      (!validCoord(j.pickup_lat, j.pickup_lng) || !validCoord(j.delivery_lat, j.delivery_lng)));
    if (!todo.length || !import.meta.env.VITE_MAPBOX_TOKEN) return;
    todo.forEach(j => geocoded.current.add(j.id!));
    (async () => {
      let changed = false;
      for (const j of todo) {
        const updates: Record<string, number> = {};
        if (!validCoord(j.pickup_lat, j.pickup_lng)) {
          const p = await geocodeAddress(j.pickup_location, j.pickup_emirate);
          if (p) { updates.pickup_lat = p[0]; updates.pickup_lng = p[1]; }
        }
        if (!validCoord(j.delivery_lat, j.delivery_lng)) {
          const d = await geocodeAddress(j.delivery_location, j.delivery_emirate);
          if (d) { updates.delivery_lat = d[0]; updates.delivery_lng = d[1]; }
        }
        if (Object.keys(updates).length) {
          try { await updateJob(j.id!, updates as any); changed = true; }
          catch (err) { console.warn('[map] could not save coordinates for', j.job_ref, err); }
        }
      }
      if (changed) onChanged();
    })();
  }, [jobs, canWrite, onChanged]);

  // ---- Derived data ---------------------------------------------------------
  const posByDriver = React.useMemo(() => new Map(positions.map(p => [p.driver_id, p])), [positions]);
  const driverById = React.useMemo(() => new Map(drivers.map(d => [d.id!, d])), [drivers]);

  const openJobs = React.useMemo(() => jobs.filter(j => j.id && !TERMINAL_STATUSES.includes(j.status)), [jobs]);
  const loadByDriver = React.useMemo(() => {
    const m = new Map<string, JobWithDriver[]>();
    openJobs.forEach(j => { if (j.driver_id) m.set(j.driver_id, [...(m.get(j.driver_id) || []), j]); });
    return m;
  }, [openJobs]);

  /** Best known position for a driver: the tracking row, else the job row's copy. */
  const driverPos = React.useCallback((driverId: string, job?: JobWithDriver): { pos: LatLng | null; at: number | null } => {
    const p = posByDriver.get(driverId);
    const fromTracking = p ? { pos: validCoord(p.latitude, p.longitude), at: new Date(p.last_update).getTime() } : null;
    const fromJob = job ? { pos: validCoord(job.driver_lat, job.driver_lng), at: job.driver_updated_at ? new Date(job.driver_updated_at).getTime() : null } : null;
    if (fromTracking?.pos && (!fromJob?.pos || (fromTracking.at ?? 0) >= (fromJob.at ?? 0))) return fromTracking;
    return fromJob?.pos ? fromJob : { pos: null, at: null };
  }, [posByDriver]);

  const activeRows = React.useMemo(() => openJobs
    .filter(j => !!j.driver_id)
    .map(j => {
      const { pos, at } = driverPos(j.driver_id!, j);
      return { job: j, pos, at, stale: at == null || now - at > STALE_AFTER_MS };
    })
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0)), [openJobs, driverPos, now]);

  const unassignedRows = React.useMemo(() => openJobs
    .filter(j => !j.driver_id)
    .map(j => ({ job: j, pickup: validCoord(j.pickup_lat, j.pickup_lng) }))
    .sort((a, b) => new Date(a.job.created_at || 0).getTime() - new Date(b.job.created_at || 0).getTime()), [openJobs]);

  const driverRows = React.useMemo(() => drivers
    .filter(d => d.id && d.active !== false && d.onboarding_status === 'approved')
    .map(d => {
      const p = posByDriver.get(d.id!);
      const pos = p ? validCoord(p.latitude, p.longitude) : null;
      return { driver: d, pos, at: p ? new Date(p.last_update).getTime() : null, online: isOnline(p, now), load: loadByDriver.get(d.id!) || [] };
    })
    .sort((a, b) => Number(b.online) - Number(a.online) || (b.at ?? 0) - (a.at ?? 0)), [drivers, posByDriver, loadByDriver, now]);

  const onlineDrivers = driverRows.filter(r => r.online && r.pos);

  const selectedJob = selection?.kind === 'job' ? openJobs.find(j => j.id === selection.id) || null : null;
  const selectedDriver = selection?.kind === 'driver' ? driverRows.find(r => r.driver.id === selection.id) || null : null;

  // Where the selected job is heading next.
  const nextStop = selectedJob ? (() => {
    const pickedUp = !!selectedJob.driver_pickup_at;
    const target = pickedUp ? validCoord(selectedJob.delivery_lat, selectedJob.delivery_lng) : validCoord(selectedJob.pickup_lat, selectedJob.pickup_lng);
    return { kind: pickedUp ? 'delivery' as const : 'pickup' as const, target, address: pickedUp ? selectedJob.delivery_location : selectedJob.pickup_location };
  })() : null;
  const selectedJobDriver = selectedJob?.driver_id ? driverPos(selectedJob.driver_id, selectedJob) : null;

  // Live ETA (Mapbox) for the selected job's driver → next stop. Recomputed when
  // the driver moves more than ~200 m, not on every poll.
  const etaKey = selectedJob && selectedJobDriver?.pos && nextStop?.target
    ? `${selectedJob.id}:${nextStop.kind}:${selectedJobDriver.pos.map(v => v.toFixed(3)).join(',')}`
    : null;
  React.useEffect(() => {
    if (!etaKey || !selectedJobDriver?.pos || !nextStop?.target) { setEta(null); return; }
    let alive = true;
    setEta({ key: etaKey, minutes: null, loading: true });
    getEtaMinutes(selectedJobDriver.pos[0], selectedJobDriver.pos[1], nextStop.target[0], nextStop.target[1])
      .then(minutes => { if (alive) setEta({ key: etaKey, minutes, loading: false }); });
    return () => { alive = false; };
  }, [etaKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Map content per mode -------------------------------------------------
  const flyTarget: LatLng | null = selectedDriver?.pos
    ?? (selectedJob && mode === 'unassigned' ? validCoord(selectedJob.pickup_lat, selectedJob.pickup_lng) : null)
    ?? selectedJobDriver?.pos
    ?? null;

  const fitPoints = React.useMemo<LatLng[]>(() => {
    if (mode === 'active') return activeRows.filter(r => r.pos).map(r => r.pos!);
    if (mode === 'unassigned') return [...unassignedRows.filter(r => r.pickup).map(r => r.pickup!), ...onlineDrivers.map(r => r.pos!)];
    return driverRows.filter(r => r.pos).map(r => r.pos!);
  }, [mode, activeRows, unassignedRows, onlineDrivers, driverRows]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setSelection(null);
    setFitNonce(n => n + 1);
  };

  const ago = (ms: number | null) => ms == null ? '—' : formatDistanceToNow(new Date(ms), { addSuffix: true, locale: dateLocale });
  const ref = (j: JobWithDriver) => `#${j.job_ref?.toString().padStart(4, '0') ?? '—'}`;
  // Same wording as the driver app (see lib/jobStage).
  const stage = (j: JobWithDriver) => STAGE_LABEL[jobStage(j)];

  const assign = async (job: JobWithDriver, driver: Driver) => {
    if (!canWrite || !job.id || !driver.id) return;
    const busy = loadByDriver.get(driver.id)?.length || 0;
    const online = isOnline(posByDriver.get(driver.id), now);
    const warn = [
      !online && t('liveMap.assignOfflineWarn', { defaultValue: '{{name}} is not online right now.', name: driver.full_name }),
      busy > 0 && t('liveMap.assignBusyWarn', { defaultValue: '{{name}} already has {{count}} open job(s).', name: driver.full_name, count: busy }),
    ].filter(Boolean).join('\n');
    const question = t('liveMap.assignConfirm', { defaultValue: 'Assign {{ref}} to {{name}}?', ref: ref(job), name: driver.full_name });
    if (!window.confirm(warn ? `${warn}\n\n${question}` : question)) return;

    setAssigning(`${job.id}:${driver.id}`);
    try {
      await assignDriverToJob(job.id, driver.id);
      await onChanged();
      setMode('active');
      setSelection({ kind: 'job', id: job.id });
    } catch (err: any) {
      alert(t('liveMap.assignFailed', { defaultValue: 'Could not assign the driver: {{error}}', error: err?.message || String(err) }));
    } finally {
      setAssigning(null);
    }
  };

  // ---- Panels ---------------------------------------------------------------
  const jobPickup = selectedJob ? validCoord(selectedJob.pickup_lat, selectedJob.pickup_lng) : null;
  const jobDrop = selectedJob ? validCoord(selectedJob.delivery_lat, selectedJob.delivery_lng) : null;

  // For an unassigned job: online drivers first, nearest to the pickup first.
  // Drivers seen recently but not online are listed after them.
  const candidates = selectedJob && !selectedJob.driver_id
    ? driverRows
        .filter(r => r.online || r.pos)
        .map(r => ({ ...r, dist: jobPickup && r.pos ? distanceMeters(r.pos, jobPickup) : null }))
        .sort((a, b) => Number(b.online) - Number(a.online) || (a.dist ?? Infinity) - (b.dist ?? Infinity))
        .slice(0, 8)
    : [];

  const AssignButton: React.FC<{ job: JobWithDriver; driver: Driver }> = ({ job, driver }) => {
    const key = `${job.id}:${driver.id}`;
    return (
      <button type="button" className="dm-assign" disabled={!canWrite || !!assigning} onClick={() => assign(job, driver)}>
        {assigning === key ? <Loader2 className="animate-spin" /> : null}
        {t('liveMap.assign', { defaultValue: 'Assign' })}
      </button>
    );
  };

  const GeofenceBadges: React.FC<{ job: JobWithDriver }> = ({ job }) => (
    <>
      {job.driver_near_pickup_at && !job.driver_pickup_at && (
        <span className="dm-badge near">{t('liveMap.nearPickup', { defaultValue: 'Near pickup' })}</span>
      )}
      {job.driver_near_delivery_at && !job.driver_delivery_at && (
        <span className="dm-badge near">{t('liveMap.nearDropoff', { defaultValue: 'Near drop-off' })}</span>
      )}
    </>
  );

  const JobDetail = selectedJob && (
    <div className="dm-panel" role="region" aria-label={ref(selectedJob)}>
      <div className="dm-panel-head">
        <div>
          <span className="dm-eyebrow">{stage(selectedJob)}</span>
          <h3>{ref(selectedJob)} <GeofenceBadges job={selectedJob} /></h3>
        </div>
        <button type="button" className="dm-close" onClick={() => setSelection(null)} aria-label={t('liveMap.close', { defaultValue: 'Close' })}><X /></button>
      </div>

      <ul className="dm-facts">
        <li><MapPin /><span><small>{t('liveMap.pickup')}</small>{selectedJob.pickup_location} · {selectedJob.pickup_emirate}</span></li>
        <li><Flag /><span><small>{t('liveMap.delivery')}</small>{selectedJob.delivery_location} · {selectedJob.delivery_emirate}</span></li>
      </ul>

      {selectedJob.driver_id ? (() => {
        const d = driverById.get(selectedJob.driver_id) || selectedJob.driver;
        const dist = selectedJobDriver?.pos && nextStop?.target ? distanceMeters(selectedJobDriver.pos, nextStop.target) : null;
        return (
          <>
            <div className="dm-driver-card">
              <span className="dm-avatar">{(d?.full_name || '?').split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase()}</span>
              <div>
                <b>{d?.full_name || '—'}</b>
                <small>{selectedJobDriver?.at ? t('liveMap.updated', { time: ago(selectedJobDriver.at) }) : t('liveMap.noSignal')}</small>
              </div>
              {d?.phone && <a className="dm-icon-btn" href={`tel:${d.phone}`} aria-label={d.phone}><Phone /></a>}
            </div>
            <div className="dm-stats">
              <div>
                <small>{nextStop?.kind === 'delivery' ? t('liveMap.etaDropoff', { defaultValue: 'ETA to drop-off' }) : t('liveMap.etaPickup', { defaultValue: 'ETA to pickup' })}</small>
                <b>{eta?.loading ? '…' : eta?.minutes != null ? t('liveMap.minutes', { defaultValue: '{{count}} min', count: eta.minutes }) : '—'}</b>
              </div>
              <div>
                <small>{t('liveMap.distance', { defaultValue: 'Distance' })}</small>
                <b>{formatDistance(dist)}</b>
              </div>
            </div>
            {!nextStop?.target && (
              <p className="dm-note"><AlertTriangle />{t('liveMap.noStopCoords', { defaultValue: 'This stop has no map location yet, so ETA and geofence alerts are unavailable.' })}</p>
            )}
          </>
        );
      })() : (
        <>
          <p className="dm-section-title">{t('liveMap.nearestDrivers', { defaultValue: 'Nearest online drivers' })}</p>
          {!jobPickup && (
            <p className="dm-note"><AlertTriangle />{t('liveMap.noPickupCoords', { defaultValue: 'The pickup address couldn’t be found on the map, so drivers aren’t sorted by distance.' })}</p>
          )}
          {candidates.length === 0 && <p className="dm-empty">{t('liveMap.noOnlineDrivers', { defaultValue: 'No drivers are online right now.' })}</p>}
          <ul className="dm-candidates">
            {candidates.map(r => (
              <li key={r.driver.id}>
                <span className={`dm-status ${r.online ? (r.load.length ? 'busy' : 'live') : 'stale'}`} />
                <div>
                  <b>{r.driver.full_name}</b>
                  <small>
                    {formatDistance(r.dist)}
                    {r.load.length > 0 && ` · ${t('liveMap.openJobs', { defaultValue: '{{count}} open job(s)', count: r.load.length })}`}
                    {!r.online && ` · ${t('liveMap.lastSeen', { defaultValue: 'seen {{time}}', time: ago(r.at) })}`}
                  </small>
                </div>
                <AssignButton job={selectedJob} driver={r.driver} />
              </li>
            ))}
          </ul>
        </>
      )}

      <button type="button" className="dm-open" onClick={() => onJobClick(selectedJob)}>
        <ExternalLink />{t('liveMap.openJob')}
      </button>
    </div>
  );

  const DriverDetail = selectedDriver && (
    <div className="dm-panel" role="region" aria-label={selectedDriver.driver.full_name}>
      <div className="dm-panel-head">
        <div>
          <span className={`dm-eyebrow ${selectedDriver.online ? 'ok' : ''}`}>
            {selectedDriver.online ? t('liveMap.online', { defaultValue: 'Online' }) : t('liveMap.offline', { defaultValue: 'Offline' })}
            {' · '}{t('liveMap.updated', { time: ago(selectedDriver.at) })}
          </span>
          <h3>{selectedDriver.driver.full_name}</h3>
        </div>
        <button type="button" className="dm-close" onClick={() => setSelection(null)} aria-label={t('liveMap.close', { defaultValue: 'Close' })}><X /></button>
      </div>

      <ul className="dm-facts">
        <li><Truck /><span>{[selectedDriver.driver.vehicle_type, selectedDriver.driver.vehicle_plate].filter(Boolean).join(' · ') || '—'}</span></li>
        {selectedDriver.driver.phone && <li><Phone /><span><a href={`tel:${selectedDriver.driver.phone}`}>{selectedDriver.driver.phone}</a></span></li>}
      </ul>

      {selectedDriver.load.length > 0 && (
        <>
          <p className="dm-section-title">{t('liveMap.currentJobs', { defaultValue: 'Current jobs' })}</p>
          <ul className="dm-candidates">
            {selectedDriver.load.map(j => (
              <li key={j.id}>
                <span className="dm-status busy" />
                <div><b>{ref(j)}</b><small>{stage(j)} · {j.pickup_emirate} → {j.delivery_emirate}</small></div>
                <button type="button" className="dm-link" onClick={() => { setMode('active'); setSelection({ kind: 'job', id: j.id! }); }}>
                  {t('liveMap.view', { defaultValue: 'View' })}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="dm-section-title">{t('liveMap.assignJob', { defaultValue: 'Assign a job' })}</p>
      {unassignedRows.length === 0 ? (
        <p className="dm-empty">{t('liveMap.noUnassigned', { defaultValue: 'Every open job has a driver.' })}</p>
      ) : (
        <ul className="dm-candidates">
          {unassignedRows
            .map(r => ({ ...r, dist: r.pickup && selectedDriver.pos ? distanceMeters(selectedDriver.pos, r.pickup) : null }))
            .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity))
            .map(r => (
              <li key={r.job.id}>
                <span className="dm-status job" />
                <div>
                  <b>{ref(r.job)}</b>
                  <small>{r.job.pickup_emirate} → {r.job.delivery_emirate} · {formatDistance(r.dist)}</small>
                </div>
                <AssignButton job={r.job} driver={selectedDriver.driver} />
              </li>
            ))}
        </ul>
      )}
    </div>
  );

  // ---- List rows -----------------------------------------------------------
  const listItems = mode === 'active'
    ? activeRows.map(r => (
      <button key={r.job.id} type="button" className={`dm-row${selection?.kind === 'job' && selection.id === r.job.id ? ' selected' : ''}`}
        onClick={() => setSelection({ kind: 'job', id: r.job.id! })}>
        <div className="dm-row-top">
          <span className="dm-ref">{ref(r.job)}</span>
          <span className={`dm-signal ${r.pos && !r.stale ? 'live' : ''}`}>
            {r.pos ? <><i />{r.stale ? t('liveMap.stale') : t('liveMap.live')}</> : <><WifiOff />{t('liveMap.noSignal')}</>}
          </span>
        </div>
        <b>{r.job.driver?.full_name || driverById.get(r.job.driver_id!)?.full_name || '—'}</b>
        <small>{stage(r.job)} · {r.job.pickup_emirate} → {r.job.delivery_emirate}</small>
        <div className="dm-row-badges"><GeofenceBadges job={r.job} /></div>
      </button>
    ))
    : mode === 'unassigned'
    ? unassignedRows.map(r => (
      <button key={r.job.id} type="button" className={`dm-row${selection?.kind === 'job' && selection.id === r.job.id ? ' selected' : ''}`}
        onClick={() => setSelection({ kind: 'job', id: r.job.id! })}>
        <div className="dm-row-top">
          <span className="dm-ref">{ref(r.job)}</span>
          <span className="dm-signal">{r.job.created_at ? ago(new Date(r.job.created_at).getTime()) : ''}</span>
        </div>
        <b title={r.job.pickup_location}>{r.job.pickup_location || '—'}</b>
        <small>{r.job.pickup_emirate} → {r.job.delivery_emirate}{r.job.urgency ? ` · ${r.job.urgency}` : ''}</small>
        {!r.pickup && <div className="dm-row-badges"><span className="dm-badge warn">{t('liveMap.notOnMap', { defaultValue: 'Not on map' })}</span></div>}
      </button>
    ))
    : driverRows.map(r => (
      <button key={r.driver.id} type="button" className={`dm-row${selection?.kind === 'driver' && selection.id === r.driver.id ? ' selected' : ''}`}
        onClick={() => setSelection({ kind: 'driver', id: r.driver.id! })}>
        <div className="dm-row-top">
          <b>{r.driver.full_name}</b>
          <span className={`dm-signal ${r.online ? 'live' : ''}`}>
            {r.online ? <><i />{t('liveMap.online', { defaultValue: 'Online' })}</> : <><WifiOff />{r.at ? ago(r.at) : t('liveMap.noSignal')}</>}
          </span>
        </div>
        <small>
          {r.driver.vehicle_type || '—'}
          {r.load.length > 0 ? ` · ${t('liveMap.openJobs', { defaultValue: '{{count}} open job(s)', count: r.load.length })}` : ` · ${t('liveMap.free', { defaultValue: 'Free' })}`}
        </small>
      </button>
    ));

  // Fill the window below whatever sits above the map (header, banners): the
  // CSS sizes the map to 100dvh minus this offset.
  const shellRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const measure = () => el.style.setProperty('--dm-top', `${Math.max(0, el.getBoundingClientRect().top + window.scrollY)}px`);
    measure();
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => { window.removeEventListener('resize', measure); ro.disconnect(); };
  }, []);

  const emptyText = mode === 'active' ? t('liveMap.noActive')
    : mode === 'unassigned' ? t('liveMap.noUnassigned', { defaultValue: 'Every open job has a driver.' })
    : t('liveMap.noApprovedDrivers', { defaultValue: 'No approved drivers yet.' });

  return (
    <div className="dispatch-map" ref={shellRef}>
      <aside className="dm-list">
        <div className="dm-modes" role="tablist">
          {([
            ['active', Truck, t('liveMap.activeJobs'), activeRows.length],
            ['unassigned', PackageOpen, t('liveMap.unassigned', { defaultValue: 'Unassigned' }), unassignedRows.length],
            ['drivers', Users, t('liveMap.onlineDrivers', { defaultValue: 'Online drivers' }), onlineDrivers.length],
          ] as const).map(([value, Icon, label, count]) => (
            <button key={value} type="button" role="tab" aria-selected={mode === value} className={mode === value ? 'selected' : ''} onClick={() => switchMode(value)}>
              <Icon /><span>{label}</span><em>{count}</em>
            </button>
          ))}
        </div>
        <div className="dm-rows">
          {listItems.length ? listItems : <p className="dm-empty">{emptyText}</p>}
        </div>
      </aside>

      <div className="dm-map">
        <MapContainer center={DEFAULT_CENTER} zoom={9} scrollWheelZoom className="dm-leaflet">
          <TrackSize />
          {/* Map labels follow the UI language. OSM's standard tiles label places in the
              local language (Arabic in the UAE); Mapbox labels them in English. Without a
              Mapbox token, OSM is used for both. OSM has no dark style, so dark mode inverts
              it with a CSS filter (.dm-tiles-dark). */}
          {import.meta.env.VITE_MAPBOX_TOKEN && !isArabic ? (
            <TileLayer
              key={isDark ? 'tiles-en-dark' : 'tiles-en'}
              url={`https://api.mapbox.com/styles/v1/mapbox/${isDark ? 'dark-v11' : 'streets-v12'}/tiles/512/{z}/{x}/{y}{r}?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`}
              tileSize={512}
              zoomOffset={-1}
              attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
          ) : (
            <TileLayer
              key={isDark ? 'tiles-local-dark' : 'tiles-local'}
              className={isDark ? 'dm-tiles-dark' : undefined}
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
          )}
          <FitBounds points={fitPoints} nonce={fitNonce} />
          <FlyTo target={flyTarget} />

          {/* Active jobs: driver pins */}
          {mode === 'active' && activeRows.filter(r => r.pos).map(r => {
            const sel = selection?.kind === 'job' && selection.id === r.job.id;
            return (
              <Marker key={r.job.id} position={r.pos!} zIndexOffset={sel ? 1000 : 0}
                icon={r.stale ? (sel ? ICON.driverStaleSel : ICON.driverStale) : (sel ? ICON.driverLiveSel : ICON.driverLive)}
                title={`${ref(r.job)} · ${r.job.driver?.full_name || ''}`}
                eventHandlers={{ click: () => setSelection({ kind: 'job', id: r.job.id! }) }} />
            );
          })}

          {/* Unassigned: job pins at pickup, online drivers for context */}
          {mode === 'unassigned' && unassignedRows.filter(r => r.pickup).map(r => {
            const sel = selection?.kind === 'job' && selection.id === r.job.id;
            return (
              <Marker key={r.job.id} position={r.pickup!} zIndexOffset={sel ? 1000 : 500}
                icon={sel ? ICON.jobOpenSel : ICON.jobOpen} title={ref(r.job)}
                eventHandlers={{ click: () => setSelection({ kind: 'job', id: r.job.id! }) }} />
            );
          })}

          {/* Drivers (their own mode, or as context when assigning) */}
          {(mode === 'drivers' || mode === 'unassigned') && driverRows.filter(r => r.pos && (mode === 'drivers' || r.online)).map(r => {
            const sel = selection?.kind === 'driver' && selection.id === r.driver.id;
            const icon = !r.online ? (sel ? ICON.driverStaleSel : ICON.driverStale)
              : r.load.length ? (sel ? ICON.driverBusySel : ICON.driverBusy)
              : (sel ? ICON.driverLiveSel : ICON.driverLive);
            return (
              <Marker key={r.driver.id} position={r.pos!} icon={icon} zIndexOffset={sel ? 1000 : 0} title={r.driver.full_name}
                eventHandlers={{ click: () => { setMode('drivers'); setSelection({ kind: 'driver', id: r.driver.id! }); } }} />
            );
          })}

          {/* Selected job: stops, geofence radius, line from driver to next stop */}
          {selectedJob && jobPickup && (
            <>
              <Marker position={jobPickup} icon={ICON.pickup} title={t('liveMap.pickup')} />
              {!selectedJob.driver_pickup_at && (
                <Circle center={jobPickup} radius={geofence.pickup_m} pathOptions={{ color: '#3b82f6', weight: 1.5, fillOpacity: 0.08 }} />
              )}
            </>
          )}
          {selectedJob && jobDrop && (
            <>
              <Marker position={jobDrop} icon={ICON.delivery} title={t('liveMap.delivery')} />
              {!!selectedJob.driver_pickup_at && (
                <Circle center={jobDrop} radius={geofence.delivery_m} pathOptions={{ color: '#ef4444', weight: 1.5, fillOpacity: 0.08 }} />
              )}
            </>
          )}
          {selectedJob && selectedJobDriver?.pos && nextStop?.target && (
            <Polyline positions={[selectedJobDriver.pos, nextStop.target]} pathOptions={{ color: '#64748b', weight: 2, dashArray: '6 6' }} />
          )}
          {selectedJob && !selectedJob.driver_id && jobPickup && jobDrop && (
            <Polyline positions={[jobPickup, jobDrop]} pathOptions={{ color: '#6366f1', weight: 2, dashArray: '4 6' }} />
          )}
        </MapContainer>

        {JobDetail || DriverDetail}

        {fitPoints.length === 0 && (
          <div className="dm-map-note">
            {positionsError
              ? t('liveMap.positionsError', { defaultValue: 'Couldn’t load driver positions. Retrying…' })
              : mode === 'unassigned'
              ? t('liveMap.noUnassignedOnMap', { defaultValue: 'No unassigned job has a map location yet.' })
              : t('liveMap.noLocations')}
          </div>
        )}
        {fitPoints.length > 0 && (
          <button type="button" className="dm-fit" onClick={() => setFitNonce(n => n + 1)}>
            <Crosshair />{t('liveMap.fitAll')}
          </button>
        )}
        <div className="dm-legend" aria-hidden="true">
          <span><i className="live" />{t('liveMap.legendFree', { defaultValue: 'Free' })}</span>
          <span><i className="busy" />{t('liveMap.legendBusy', { defaultValue: 'On a job' })}</span>
          <span><i className="stale" />{t('liveMap.legendStale', { defaultValue: 'No recent GPS' })}</span>
          <span><i className="job" />{t('liveMap.legendUnassigned', { defaultValue: 'Unassigned job' })}</span>
        </div>
      </div>
    </div>
  );
};
