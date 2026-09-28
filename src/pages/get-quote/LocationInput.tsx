import React from 'react';
import { useTranslation } from 'react-i18next';
import { Crosshair, Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fieldClass } from './constants';
import { emirateBias, validCoord, type LatLng } from '../../lib/geo';

// Address autocomplete backed by the Mapbox Search Box API (same VITE_MAPBOX_TOKEN
// as lib/eta.ts), which knows malls, towers and hotels as well as streets.
// Limited to the selected emirate (lib/geo emirateBias). Without a token it
// degrades to a plain text input — typing always works. A picked suggestion or
// "use my location" also reports the exact point (onChange's second argument),
// so the stop gets a map pin; typed text reports null.

interface Suggestion {
  id: string;
  label: string;
  coords: LatLng | null;
}

/** Search Box features carry [lng, lat]; return [lat, lng] or null. */
const coordsOf = (f: any): LatLng | null => {
  const c = f?.geometry?.coordinates;
  return Array.isArray(c) && c.length === 2 ? validCoord(c[1], c[0]) : null;
};

interface LocationInputProps {
  id: string;
  value: string;
  onChange: (value: string, coords: LatLng | null) => void;
  emirate: string;
  placeholder: string;
  icon: LucideIcon;
  iconClassName?: string;
}

const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

// Named place first ("Al Wahda Mall"), then its address, so the pick is unambiguous.
const labelOf = (p: any): string =>
  [p?.name, p?.full_address || p?.place_formatted].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');

async function searchPlaces(params: Record<string, string>, signal?: AbortSignal): Promise<Suggestion[]> {
  const qs = new URLSearchParams({ access_token: token!, country: 'ae', limit: '5', ...params });
  const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/forward?${qs}`, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  const all: Suggestion[] = (data?.features ?? []).map((f: any) => ({ id: f.properties?.mapbox_id ?? f.id, label: labelOf(f.properties), coords: coordsOf(f) }));
  return all.filter((s, i) => s.label && all.findIndex((o) => o.label === s.label) === i); // same place listed twice
}

async function reverseLookup(lng: number, lat: number, language: string): Promise<Suggestion | null> {
  const qs = new URLSearchParams({ access_token: token!, longitude: String(lng), latitude: String(lat), limit: '1', language });
  const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/reverse?${qs}`);
  if (!res.ok) return null;
  const f = (await res.json())?.features?.[0];
  return f ? { id: f.properties?.mapbox_id ?? f.id, label: labelOf(f.properties), coords: coordsOf(f) } : null;
}

export default function LocationInput({ id, value, onChange, emirate, placeholder, icon: Icon, iconClassName }: LocationInputProps) {
  const { t, i18n } = useTranslation('getQuote');
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(-1);
  const [locating, setLocating] = React.useState(false);
  const [geoError, setGeoError] = React.useState<string | null>(null);
  // Only what the visitor types drives lookups — not a picked suggestion, a
  // geolocated address, or a value restored when the step remounts.
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  // The last picked place. Adding detail after it ("…, Gate 3", a villa number)
  // keeps its pin; changing the place itself drops it.
  const picked = React.useRef<{ label: string; coords: LatLng | null } | null>(null);
  const listId = `${id}-suggestions`;
  const language = i18n.language?.startsWith('ar') ? 'ar' : 'en';

  React.useEffect(() => {
    if (!token) return;
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchPlaces(
          { q, auto_complete: 'true', language, ...emirateBias(emirate) },
          controller.signal
        );
        setSuggestions(results);
        setHighlight(-1);
        setOpen(results.length > 0 && document.activeElement === inputRef.current);
      } catch {
        // aborted or offline — keep the free-text value, just no suggestions
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, emirate, language]);

  const pick = (s: Suggestion) => {
    setQuery('');
    picked.current = { label: s.label, coords: s.coords };
    onChange(s.label, s.coords);
    setOpen(false);
    setSuggestions([]);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError(t('step1.locationUnavailable'));
      return;
    }
    setGeoError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const fallback = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
        let label = fallback;
        if (token) {
          try {
            const first = await reverseLookup(coords.longitude, coords.latitude, language);
            if (first) label = first.label;
          } catch {
            // fall back to raw coordinates — still enough for a driver to navigate
          }
        }
        setQuery('');
        // The device's own fix is the pin, whatever address label it resolves to.
        const pin = validCoord(coords.latitude, coords.longitude);
        picked.current = { label, coords: pin };
        onChange(label, pin);
        setLocating(false);
      },
      () => {
        setGeoError(t('step1.locationUnavailable'));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === 'Enter' && highlight >= 0) {
      // Enter would otherwise submit the step
      e.preventDefault();
      pick(suggestions[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div>
      <div className="relative">
        <Icon className={cn('absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none', iconClassName)} />
        <input
          ref={inputRef}
          id={id}
          required
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={highlight >= 0 ? `${listId}-${highlight}` : undefined}
          placeholder={placeholder}
          className={cn(fieldClass, 'ps-11')}
          value={value}
          onChange={e => {
            setQuery(e.target.value);
            const text = e.target.value;
            const kept = picked.current && text.startsWith(picked.current.label) ? picked.current.coords : null;
            if (!kept) picked.current = null;
            onChange(text, kept);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setOpen(false)}
        />
        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-brand-field-border bg-brand-surface shadow-lg backdrop-blur-xl"
          >
            {suggestions.map((s, i) => (
              <li
                key={s.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === highlight}
                // mousedown fires before the input's blur closes the list
                onMouseDown={e => {
                  e.preventDefault();
                  pick(s);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  'px-4 py-3 text-sm cursor-pointer text-brand-text border-b border-brand-border last:border-0',
                  i === highlight && 'bg-brand-neon/10'
                )}
              >
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-neon hover:underline disabled:opacity-60"
        >
          {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
          {locating ? t('step1.locating') : t('step1.useMyLocation')}
        </button>
        {geoError && <p className="text-[11px] text-red-500">{geoError}</p>}
      </div>
    </div>
  );
}
