import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDistanceToNow } from 'date-fns';
import { ar as arLocale } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { Crosshair, WifiOff, Truck } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { JobWithDriver } from '../../lib/supabase';
import { TERMINAL_STATUSES, getStageConfig } from './constants';

// A driver position older than this is shown greyed out. The pin is the last
// known position, not a live one, so dispatch shouldn't read it as current.
const STALE_AFTER_MS = 5 * 60 * 1000;
// Dubai ↔ Abu Dhabi corridor, used until there is a position to fit to.
const DEFAULT_CENTER: [number, number] = [24.9, 54.9];

type LatLng = [number, number];

const validCoord = (lat?: number | null, lng?: number | null): LatLng | null =>
  typeof lat === 'number' && typeof lng === 'number' &&
  Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
    ? [lat, lng]
    : null;

const pin = (color: string, size: number, ring = '#fff') =>
  L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid ${ring};box-shadow:0 2px 8px rgba(0,0,0,.45)"></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const ICONS = {
  fresh: pin('#39ff14', 26, '#0b0b0b'),
  freshSelected: pin('#39ff14', 34, '#ffffff'),
  stale: pin('#94a3b8', 26, '#0b0b0b'),
  staleSelected: pin('#94a3b8', 34, '#ffffff'),
  pickup: pin('#3b82f6', 18),
  delivery: pin('#ef4444', 18),
};

// Fits the view to all driver pins once when the first positions arrive, and
// again whenever `nonce` changes (the "Fit all" button). It never re-fits on
// its own after that, so realtime refreshes don't yank the map away from
// whatever the operator is looking at.
const FitBounds: React.FC<{ points: LatLng[]; nonce: number }> = ({ points, nonce }) => {
  const map = useMap();
  const fitted = React.useRef(false);
  const fit = React.useCallback(() => {
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 13 });
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
    if (target) map.flyTo(target, Math.max(map.getZoom(), 13), { duration: 0.8 });
  }, [target?.[0], target?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

export const LiveMapView: React.FC<{ jobs: JobWithDriver[]; onJobClick: (job: JobWithDriver) => void }> = ({ jobs, onJobClick }) => {
  const { t, i18n } = useTranslation('dashboard');
  const STAGE_CONFIG = getStageConfig(t);
  const dateLocale = i18n.language?.startsWith('ar') ? arLocale : undefined;
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [fitNonce, setFitNonce] = React.useState(0);

  // Re-evaluate "stale" as time passes even when no new data arrives.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const rows = React.useMemo(() => {
    return jobs
      .filter(j => !TERMINAL_STATUSES.includes(j.status) && !!j.driver_id)
      .map(j => {
        const pos = validCoord(j.driver_lat, j.driver_lng);
        const updatedMs = j.driver_updated_at ? new Date(j.driver_updated_at).getTime() : null;
        const stale = updatedMs == null || now - updatedMs > STALE_AFTER_MS;
        return { job: j, pos, updatedMs, stale };
      })
      .sort((a, b) => (b.updatedMs ?? 0) - (a.updatedMs ?? 0));
  }, [jobs, now]);

  const located = rows.filter(r => r.pos);
  const unlocated = rows.filter(r => !r.pos);
  const points = React.useMemo(() => located.map(r => r.pos!), [located]);
  const selected = rows.find(r => r.job.id === selectedId) || null;
  const selectedPos = selected?.pos ?? null;
  const flyTarget = React.useMemo<LatLng | null>(() => selectedPos, [selectedPos?.[0], selectedPos?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  const ago = (ms: number | null) =>
    ms == null ? '—' : formatDistanceToNow(new Date(ms), { addSuffix: true, locale: dateLocale });

  const Row: React.FC<{ r: (typeof rows)[number] }> = ({ r }) => (
    <button
      type="button"
      onClick={() => setSelectedId(r.job.id!)}
      className={cn(
        'w-full text-left p-3 rounded-xl border transition-all',
        selectedId === r.job.id ? 'border-brand-neon bg-brand-neon/10' : 'border-brand-border bg-brand-input hover:border-brand-neon/40'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono font-bold text-brand-neon">#{r.job.job_ref?.toString().padStart(4, '0')}</span>
        <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold', r.pos && !r.stale ? 'text-brand-neon' : 'text-brand-muted')}>
          {r.pos ? (
            <>
              <span className={cn('w-1.5 h-1.5 rounded-full', r.stale ? 'bg-slate-400' : 'bg-brand-neon animate-pulse')} />
              {r.stale ? t('liveMap.stale') : t('liveMap.live')}
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              {t('liveMap.noSignal')}
            </>
          )}
        </span>
      </div>
      <p className="text-sm font-semibold text-brand-text truncate mt-1">{r.job.driver?.full_name || '—'}</p>
      <p className="text-[11px] text-brand-muted truncate">
        {STAGE_CONFIG[r.job.status]?.label || r.job.status} · {r.job.pickup_emirate} → {r.job.delivery_emirate}
      </p>
      {r.pos && <p className="text-[10px] text-brand-muted mt-0.5">{t('liveMap.updated', { time: ago(r.updatedMs) })}</p>}
    </button>
  );

  const selPickup = selected ? validCoord(selected.job.pickup_lat, selected.job.pickup_lng) : null;
  const selDelivery = selected ? validCoord(selected.job.delivery_lat, selected.job.delivery_lng) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
      {/* Job list */}
      <div className="space-y-3 lg:max-h-[640px] overflow-y-auto no-scrollbar">
        <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">
          {t('liveMap.activeJobs')} ({rows.length})
        </p>
        {rows.length === 0 && (
          <div className="p-4 bg-brand-input border border-brand-border rounded-xl text-xs text-brand-muted flex items-start gap-2">
            <Truck className="w-4 h-4 shrink-0 mt-0.5" />
            {t('liveMap.noActive')}
          </div>
        )}
        {located.map(r => <Row key={r.job.id} r={r} />)}
        {unlocated.map(r => <Row key={r.job.id} r={r} />)}
      </div>

      {/* Map */}
      <div className="relative rounded-2xl overflow-hidden border border-brand-border h-[420px] lg:h-[640px]">
        <MapContainer center={DEFAULT_CENTER} zoom={9} scrollWheelZoom className="w-full h-full z-0">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <FitBounds points={points} nonce={fitNonce} />
          <FlyTo target={flyTarget} />

          {located.map(r => {
            const isSel = selectedId === r.job.id;
            const icon = r.stale ? (isSel ? ICONS.staleSelected : ICONS.stale) : (isSel ? ICONS.freshSelected : ICONS.fresh);
            return (
              <Marker
                key={r.job.id}
                position={r.pos!}
                icon={icon}
                zIndexOffset={isSel ? 1000 : 0}
                eventHandlers={{ click: () => setSelectedId(r.job.id!) }}
              >
                <Popup>
                  <div className="space-y-1 text-xs">
                    <p className="font-bold">#{r.job.job_ref?.toString().padStart(4, '0')} · {r.job.driver?.full_name || '—'}</p>
                    <p>{STAGE_CONFIG[r.job.status]?.label || r.job.status}</p>
                    <p className="opacity-70">{t('liveMap.updated', { time: ago(r.updatedMs) })}</p>
                    <button type="button" onClick={() => onJobClick(r.job)} className="mt-1 font-semibold underline">
                      {t('liveMap.openJob')}
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {selPickup && <Marker position={selPickup} icon={ICONS.pickup}><Popup>{t('liveMap.pickup')}</Popup></Marker>}
          {selDelivery && <Marker position={selDelivery} icon={ICONS.delivery}><Popup>{t('liveMap.delivery')}</Popup></Marker>}
        </MapContainer>

        {located.length === 0 && (
          <div className="absolute inset-x-4 top-4 z-[500] p-3 bg-brand-bg/90 border border-brand-border rounded-xl text-xs text-brand-muted">
            {t('liveMap.noLocations')}
          </div>
        )}
        {located.length > 0 && (
          <button
            type="button"
            onClick={() => setFitNonce(n => n + 1)}
            className="absolute bottom-4 right-4 z-[500] inline-flex items-center gap-1.5 px-3 py-2 bg-brand-bg/90 hover:bg-brand-surface border border-brand-border rounded-xl text-xs font-semibold text-brand-text"
          >
            <Crosshair className="w-3.5 h-3.5" />
            {t('liveMap.fitAll')}
          </button>
        )}
      </div>
    </div>
  );
};
