import React from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';
import { isMultiStop, type JobWithDriver } from '../../../lib/supabase';
import { validCoord, EMIRATE_CENTERS, type LatLng } from '../../../lib/geo';
import { useLiveRoute, getStaticRoute, getStaticRouteVia } from '../../../lib/route';
import { formatDateTime } from '../../../lib/tenant';
import { useTheme } from '../../../context/ThemeContext';
import { Icon } from './Icon';

/* ------------------------------------------------------------------ */
/* Route map in the Jobs detail panel.                                 */
/* While a driver is on the way: the road route from the driver to the */
/* next stop, with the same ETA as the Live Map and the client portal  */
/* (lib/route). Otherwise: the road route pickup → drop-off, looked up */
/* once per session.                                                   */
/* ------------------------------------------------------------------ */

const dot = (color: string, size: number, square = false) =>
  L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:${square ? '5px' : '9999px'};background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const ICON = {
  pickup: dot('#3b82f6', 16),
  delivery: dot('#ef4444', 16),
  driver: dot('#10b981', 22),
};

/** Multi-stop jobs: a numbered pin per stop (blue pickup, red drop-off, grey once handed over). */
const numbered = (n: number, kind: 'pickup' | 'drop', done: boolean) =>
  L.divIcon({
    html: `<div style="width:22px;height:22px;border-radius:9999px;background:${done ? '#94a3b8' : kind === 'pickup' ? '#3b82f6' : '#ef4444'};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);color:#fff;font:700 11px/18px system-ui;text-align:center">${n}</div>`,
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

const DEFAULT_CENTER: LatLng = [24.9, 54.9];

/** Fit the view once per job, and again when the first route arrives — not on every ping. */
function FitOnce({ points, routeReady }: { points: LatLng[]; routeReady: boolean }) {
  const map = useMap();
  const fitted = React.useRef({ stops: false, route: false });
  React.useEffect(() => {
    if (!points.length) return;
    if (fitted.current.stops && (fitted.current.route || !routeReady)) return;
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 14 });
    fitted.current.stops = true;
    if (routeReady) fitted.current.route = true;
  }, [map, points, routeReady]);
  React.useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export function JobRouteMap({ job, onExpand }: { job: JobWithDriver; onExpand: () => void }) {
  const { t, i18n } = useTranslation('dashboard');
  const isArabic = !!i18n.language?.startsWith('ar');
  const isDark = useTheme().theme === 'dark';

  const pickup = validCoord(job.pickup_lat, job.pickup_lng)
    ?? (EMIRATE_CENTERS[job.pickup_emirate] ? [EMIRATE_CENTERS[job.pickup_emirate][1], EMIRATE_CENTERS[job.pickup_emirate][0]] as LatLng : null);
  const drop = validCoord(job.delivery_lat, job.delivery_lng)
    ?? (EMIRATE_CENTERS[job.delivery_emirate] ? [EMIRATE_CENTERS[job.delivery_emirate][1], EMIRATE_CENTERS[job.delivery_emirate][0]] as LatLng : null);
  const exactStops = !!validCoord(job.pickup_lat, job.pickup_lng) && !!validCoord(job.delivery_lat, job.delivery_lng);

  // The job row carries the driver's latest fix while the job is open
  // (driver_publish_location), and reaches the dashboard over realtime.
  const driver = job.driver_id ? validCoord(job.driver_lat, job.driver_lng) : null;
  const live = useLiveRoute(job.driver_id ? job : null, driver, job.driver_updated_at);
  const liveMode = !!driver && !!live.stop;

  // Multi-stop / round trip: every stop with a pin, in order.
  const multi = isMultiStop(job);
  const stopPins = React.useMemo(() => (multi ? job.stops ?? [] : [])
    .map(s => ({ s, p: validCoord(s.lat, s.lng) }))
    .filter((x): x is { s: NonNullable<JobWithDriver['stops']>[number]; p: LatLng } => !!x.p), [multi, job.stops]);
  const allStopsPinned = multi && stopPins.length === (job.stops?.length ?? 0) && stopPins.length >= 2;
  const stopsKey = stopPins.map(x => x.p.join(',')).join(';');
  // Stops still to do, from the next one on (dashed hint while the driver is on the way).
  const remaining = stopPins.filter(x => !x.s.handed_at).map(x => x.p);

  // Pickup → drop-off (or stop 1 → … → last stop) road route when no driver is on the way.
  const [staticCoords, setStaticCoords] = React.useState<LatLng[]>([]);
  const pKey = pickup?.join(','), dKey = drop?.join(',');
  React.useEffect(() => {
    setStaticCoords([]);
    if (liveMode) return;
    let alive = true;
    if (multi) {
      if (!allStopsPinned) return;
      getStaticRouteVia(stopPins.map(x => x.p)).then(r => { if (alive && r) setStaticCoords(r.coords); });
    } else {
      if (!exactStops || !pickup || !drop) return;
      getStaticRoute(pickup, drop).then(r => { if (alive && r) setStaticCoords(r.coords); });
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMode, exactStops, pKey, dKey, multi, allStopsPinned, stopsKey]);

  const routeCoords = liveMode ? live.coords : staticCoords;
  const fitPoints = React.useMemo<LatLng[]>(
    () => [...(multi ? stopPins.map(x => x.p) : [pickup, drop]), liveMode ? driver : null, ...routeCoords].filter(Boolean) as LatLng[],
    // Refit only when the stops change or a route first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pKey, dKey, stopsKey, liveMode, routeCoords.length > 0],
  );

  const etaLabel = live.stop?.seq
    ? t('liveMap.etaStop', { defaultValue: 'ETA to stop {{n}} of {{total}}', n: live.stop.seq, total: live.stop.total })
    : live.stop?.kind === 'delivery'
      ? t('liveMap.etaDropoff', { defaultValue: 'ETA to drop-off' })
      : t('liveMap.etaPickup', { defaultValue: 'ETA to pickup' });

  return (
    <div className="jw-map">
      <MapContainer
        key={job.id}
        center={pickup ?? DEFAULT_CENTER}
        zoom={9}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        style={{ width: '100%', height: '100%', minHeight: 'inherit' }}
      >
        {import.meta.env.VITE_MAPBOX_TOKEN && !isArabic ? (
          <TileLayer
            key={isDark ? 'tiles-en-dark' : 'tiles-en'}
            url={`https://api.mapbox.com/styles/v1/mapbox/${isDark ? 'dark-v11' : 'streets-v12'}/tiles/512/{z}/{x}/{y}{r}?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`}
            tileSize={512}
            zoomOffset={-1}
          />
        ) : (
          <TileLayer
            key={isDark ? 'tiles-local-dark' : 'tiles-local'}
            className={isDark ? 'dm-tiles-dark' : undefined}
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        <FitOnce points={fitPoints} routeReady={routeCoords.length > 0} />

        {routeCoords.length > 1 && (
          <Polyline positions={routeCoords} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.85 }} />
        )}
        {/* Heading to pickup: hint the rest of the trip without another lookup. */}
        {!multi && liveMode && live.stop?.kind === 'pickup' && pickup && drop && (
          <Polyline positions={[pickup, drop]} pathOptions={{ color: '#94a3b8', weight: 2, dashArray: '4 6' }} />
        )}
        {!multi && !routeCoords.length && !liveMode && pickup && drop && (
          <Polyline positions={[pickup, drop]} pathOptions={{ color: '#94a3b8', weight: 2, dashArray: '4 6' }} />
        )}
        {multi && (liveMode ? remaining.length > 1 : !routeCoords.length && stopPins.length > 1) && (
          <Polyline positions={liveMode ? remaining : stopPins.map(x => x.p)} pathOptions={{ color: '#94a3b8', weight: 2, dashArray: '4 6' }} />
        )}
        {!multi && pickup && <Marker position={pickup} icon={ICON.pickup} title={t('liveMap.pickup')} />}
        {!multi && drop && <Marker position={drop} icon={ICON.delivery} title={t('liveMap.delivery')} />}
        {stopPins.map(({ s, p }) => (
          <Marker key={s.id ?? s.seq} position={p} icon={numbered(s.seq, s.kind, !!s.handed_at)}
            title={`${s.seq}. ${s.kind === 'pickup' ? t('liveMap.pickup') : t('liveMap.delivery')} · ${s.address}`} />
        ))}
        {liveMode && driver && <Marker position={driver} icon={ICON.driver} zIndexOffset={1000} title={job.driver?.full_name || ''} />}
      </MapContainer>

      {liveMode && (
        <div className="jw-map-eta" aria-live="polite">
          <small>{etaLabel}</small>
          <b>
            {live.stop?.arrived ? t('liveMap.arrived', { defaultValue: 'Arrived' })
              : live.loading ? '…'
              : live.minutes != null ? t('liveMap.minutes', { defaultValue: '{{count}} min', count: live.minutes }) : '—'}
          </b>
          {live.arriveAt && !live.stop?.arrived && <small>{formatDateTime(live.arriveAt, { timeStyle: 'short' })}</small>}
        </div>
      )}

      <button className="jw-map-expand" onClick={onExpand} aria-label="Open live map" title="Open live map">
        <Icon name="expand" size={16} />
      </button>
    </div>
  );
}
