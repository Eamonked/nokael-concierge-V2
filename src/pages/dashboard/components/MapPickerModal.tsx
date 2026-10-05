import React from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';
import { X, Search, Loader2, MapPin, ExternalLink } from 'lucide-react';
import { EMIRATE_CENTERS, emirateBias, validCoord, type LatLng } from '../../../lib/geo';
import { getActiveTenant } from '../../../lib/tenant';
import { useTheme } from '../../../context/ThemeContext';

// ==========================================
// Pick on map — the exact point for a stop
// ==========================================
// Dispatch searches a place (Mapbox Search Box: malls, towers, hotels,
// streets) and/or taps the map, then drags the pin onto the exact gate or
// building. The confirmed point is saved as the stop's lat/lng instead of
// whatever the typed address happens to geocode to — the driver's
// navigation, ETA, geofence alerts and arrival check all use it.

const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

interface Place {
  id: string;
  label: string;
  coords: LatLng | null;
}

const labelOf = (p: any): string =>
  [p?.name, p?.full_address || p?.place_formatted].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');

const coordsOf = (f: any): LatLng | null => {
  const c = f?.geometry?.coordinates;
  return Array.isArray(c) && c.length === 2 ? validCoord(c[1], c[0]) : null;
};

async function searchPlaces(q: string, emirate: string, language: string, signal: AbortSignal): Promise<Place[]> {
  // Country + proximity to the chosen emirate, but no emirate box: if the
  // emirate on the form is wrong, dispatch must still be able to find the place.
  const { bbox: _bbox, ...bias } = emirateBias(emirate);
  const qs = new URLSearchParams({ q, access_token: token!, limit: '6', auto_complete: 'true', language, ...bias });
  const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/forward?${qs}`, { signal });
  if (!res.ok) return [];
  const all: Place[] = ((await res.json())?.features ?? []).map((f: any) => ({
    id: f.properties?.mapbox_id ?? f.id, label: labelOf(f.properties), coords: coordsOf(f),
  }));
  return all.filter((p, i) => p.label && p.coords && all.findIndex(o => o.label === p.label) === i);
}

async function reverseLookup([lat, lng]: LatLng, language: string): Promise<string | null> {
  if (!token) return null;
  const qs = new URLSearchParams({ access_token: token, longitude: String(lng), latitude: String(lat), limit: '1', language });
  const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/reverse?${qs}`);
  if (!res.ok) return null;
  const f = (await res.json())?.features?.[0];
  return f ? labelOf(f.properties) || null : null;
}

const PIN_ICON = L.divIcon({
  html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))"><path d="M17 1C8.2 1 1 8 1 16.8 1 28.5 17 43 17 43s16-14.5 16-26.2C33 8 25.8 1 17 1z" fill="#dc2626" stroke="#fff" stroke-width="2"/><circle cx="17" cy="16.5" r="5.5" fill="#fff"/></svg>`,
  className: '',
  iconSize: [34, 44],
  iconAnchor: [17, 43],
});

/** Tap anywhere on the map to move the pin there. */
const TapToPlace: React.FC<{ onPlace: (p: LatLng) => void }> = ({ onPlace }) => {
  useMapEvents({ click: e => onPlace([e.latlng.lat, e.latlng.lng]) });
  return null;
};

/** Moves the view when a search result is chosen (nonce bumps on every jump). */
const FlyTo: React.FC<{ target: LatLng | null; nonce: number }> = ({ target, nonce }) => {
  const map = useMap();
  React.useEffect(() => {
    if (target && nonce) map.flyTo(target, Math.max(map.getZoom(), 17), { duration: 0.6 });
  }, [nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

export interface MapPickerResult {
  coords: LatLng;
  /** Address of the point (search result or reverse lookup), when known. */
  label: string | null;
  /** Dispatch asked to replace the typed address with `label`. */
  useLabel: boolean;
}

interface MapPickerModalProps {
  title: string;
  /** Pin to start from (the stop's current point), if any. */
  initial: LatLng | null;
  /** The address typed on the form — pre-fills the search. */
  address: string;
  emirate: string;
  onConfirm: (result: MapPickerResult) => void;
  onClose: () => void;
}

export const MapPickerModal: React.FC<MapPickerModalProps> = ({ title, initial, address, emirate, onConfirm, onClose }) => {
  const { t, i18n } = useTranslation('dashboard');
  const isArabic = !!i18n.language?.startsWith('ar');
  const language = isArabic ? 'ar' : 'en';
  const isDark = useTheme().theme === 'dark';

  const startCenter = React.useMemo<LatLng>(() => {
    if (initial) return initial;
    const c = EMIRATE_CENTERS[emirate?.trim()] ?? getActiveTenant().settings.map_center;
    return [c[1], c[0]];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [pin, setPin] = React.useState<LatLng | null>(initial);
  const [label, setLabel] = React.useState<string | null>(null);
  const [labelLoading, setLabelLoading] = React.useState(false);
  const [useLabel, setUseLabel] = React.useState(!address.trim());
  const [query, setQuery] = React.useState(address);
  const [results, setResults] = React.useState<Place[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searched, setSearched] = React.useState(false);
  const [fly, setFly] = React.useState<{ target: LatLng | null; nonce: number }>({ target: null, nonce: 0 });
  const lookupSeq = React.useRef(0);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Live suggestions while typing.
  React.useEffect(() => {
    const q = query.trim();
    if (!token || q.length < 3) {
      setResults([]);
      setSearched(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlaces(q, emirate, language, controller.signal));
        setSearched(true);
      } catch {
        // aborted / offline — tapping the map still works
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, emirate, language]);

  /** A tapped or dragged point: look up its address for the operator to check. */
  const placeAt = (p: LatLng) => {
    setPin(p);
    const seq = ++lookupSeq.current;
    setLabel(null);
    setLabelLoading(true);
    reverseLookup(p, language)
      .then(l => seq === lookupSeq.current && setLabel(l))
      .catch(() => undefined)
      .finally(() => seq === lookupSeq.current && setLabelLoading(false));
  };

  const choose = (place: Place) => {
    if (!place.coords) return;
    lookupSeq.current++; // drop any reverse lookup still in flight
    setPin(place.coords);
    setLabel(place.label);
    setLabelLoading(false);
    setResults([]);
    setSearched(false);
    setFly(f => ({ target: place.coords, nonce: f.nonce + 1 }));
  };

  const confirm = () => pin && onConfirm({ coords: pin, label, useLabel: useLabel && !!label });

  return createPortal(
    <div className="map-picker-layer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="map-picker-backdrop" onClick={onClose} />
      <div className="map-picker">
        <div className="map-picker-head">
          <div>
            <h3>{title}</h3>
            <p>{t('mapPicker.hint', { defaultValue: 'Search for the place, then tap the map or drag the pin onto the exact entrance.' })}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('mapPicker.close', { defaultValue: 'Close' })}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="map-picker-search">
          <Search className="w-4 h-4" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (results[0]) choose(results[0]);
              }
            }}
            placeholder={t('mapPicker.searchPlaceholder', { defaultValue: 'Search a building, mall, hotel or street…' })}
          />
          {searching && <Loader2 className="w-4 h-4 animate-spin" />}
          {(results.length > 0 || (searched && !searching)) && (
            <ul className="map-picker-results">
              {results.map(r => (
                <li key={r.id}>
                  <button type="button" onClick={() => choose(r)}>
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{r.label}</span>
                  </button>
                </li>
              ))}
              {results.length === 0 && (
                <li className="map-picker-empty">{t('mapPicker.noResults', { defaultValue: 'No matches. Zoom in and tap the map instead.' })}</li>
              )}
            </ul>
          )}
        </div>
        {!token && <p className="map-picker-warn">{t('mapPicker.noToken', { defaultValue: 'Search is unavailable (no Mapbox token). Tap the map to place the pin.' })}</p>}

        <div className="map-picker-map">
          <MapContainer center={startCenter} zoom={initial ? 17 : 12} scrollWheelZoom className="map-picker-leaflet">
            {token && !isArabic ? (
              <TileLayer
                key={isDark ? 'pick-en-dark' : 'pick-en'}
                url={`https://api.mapbox.com/styles/v1/mapbox/${isDark ? 'dark-v11' : 'streets-v12'}/tiles/512/{z}/{x}/{y}{r}?access_token=${token}`}
                tileSize={512}
                zoomOffset={-1}
                maxZoom={20}
                attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
            ) : (
              <TileLayer
                key={isDark ? 'pick-local-dark' : 'pick-local'}
                className={isDark ? 'dm-tiles-dark' : undefined}
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
            )}
            <TapToPlace onPlace={placeAt} />
            <FlyTo target={fly.target} nonce={fly.nonce} />
            {pin && (
              <Marker
                position={pin}
                icon={PIN_ICON}
                draggable
                eventHandlers={{ dragend: e => { const p = (e.target as L.Marker).getLatLng(); placeAt([p.lat, p.lng]); } }}
              />
            )}
          </MapContainer>
          {!pin && <div className="map-picker-tap">{t('mapPicker.tapToPlace', { defaultValue: 'Tap the map to drop the pin' })}</div>}
        </div>

        <div className="map-picker-foot">
          <div className="map-picker-point">
            {pin ? (
              <>
                <b>{labelLoading ? t('mapPicker.lookingUp', { defaultValue: 'Looking up address…' }) : label || t('mapPicker.unnamed', { defaultValue: 'Unnamed point' })}</b>
                <small>
                  {pin[0].toFixed(6)}, {pin[1].toFixed(6)} ·{' '}
                  <a href={`https://www.google.com/maps/search/?api=1&query=${pin[0]},${pin[1]}`} target="_blank" rel="noreferrer">
                    {t('mapPicker.checkGoogle', { defaultValue: 'Check in Google Maps' })} <ExternalLink className="w-3 h-3" />
                  </a>
                </small>
                {label && (
                  <label className="map-picker-uselabel">
                    <input type="checkbox" checked={useLabel} onChange={e => setUseLabel(e.target.checked)} />
                    {t('mapPicker.useAddress', { defaultValue: 'Use this as the address text' })}
                  </label>
                )}
              </>
            ) : (
              <small>{t('mapPicker.noPin', { defaultValue: 'No pin yet.' })}</small>
            )}
          </div>
          <button type="button" className="outline-button" onClick={onClose}>{t('mapPicker.cancel', { defaultValue: 'Cancel' })}</button>
          <button type="button" className="dark-button" disabled={!pin} onClick={confirm}>{t('mapPicker.confirm', { defaultValue: 'Use this location' })}</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
