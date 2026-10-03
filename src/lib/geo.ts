// ==========================================
// Coordinates, distances and address lookup
// ==========================================

import { getActiveTenant } from './tenant';

export type LatLng = [number, number];

/** A usable coordinate pair, or null. (0,0) is treated as "not set". */
export const validCoord = (lat?: number | null, lng?: number | null): LatLng | null =>
  typeof lat === 'number' && typeof lng === 'number' &&
  Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
    ? [lat, lng]
    : null;

/** Straight-line (great-circle) distance in metres. Same formula as public._distance_m. */
export const distanceMeters = (a: LatLng, b: LatLng): number => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

export const formatDistance = (meters: number | null | undefined): string => {
  if (meters == null || !Number.isFinite(meters)) return '—';
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
};

// City centre of each emirate [lng, lat] (Mapbox order), used to rank results.
export const EMIRATE_CENTERS: Record<string, [number, number]> = {
  'Abu Dhabi': [54.3773, 24.4539],
  'Dubai': [55.2708, 25.2048],
  'Sharjah': [55.4033, 25.3463],
  'Ajman': [55.5136, 25.4052],
  'Umm Al Quwain': [55.5552, 25.5647],
  'Ras Al Khaimah': [55.9432, 25.8007],
  'Fujairah': [56.3265, 25.1288],
};

// Rough bounding box of each emirate [minLng, minLat, maxLng, maxLat]. Results
// outside the chosen emirate's box are never used, so a place that shares its
// name with one in another emirate can't pull the pin there. Neighbouring boxes
// overlap a little at the borders; that's fine for a filter.
export const EMIRATE_BBOX: Record<string, [number, number, number, number]> = {
  'Abu Dhabi': [51.5, 22.6, 56.05, 24.95],
  'Dubai': [54.88, 24.72, 55.66, 25.36],
  'Sharjah': [55.3, 25.0, 56.4, 25.47],
  'Ajman': [55.42, 25.36, 55.62, 25.47],
  'Umm Al Quwain': [55.5, 25.42, 55.95, 25.66],
  'Ras Al Khaimah': [55.72, 25.5, 56.2, 26.1],
  'Fujairah': [56.0, 24.95, 56.42, 25.7],
};

/**
 * Lookup parameters that keep results inside the company's country and, for
 * UAE companies, inside (and ranked around) the chosen emirate. Elsewhere the
 * company's map centre (organizations.settings.map_center) ranks results.
 */
export const emirateBias = (emirate?: string | null): Record<string, string> => {
  const { country, map_center } = getActiveTenant().settings;
  const isUae = (country || 'AE').toUpperCase() === 'AE';
  const center = isUae && emirate ? EMIRATE_CENTERS[emirate.trim()] : undefined;
  const bbox = isUae && emirate ? EMIRATE_BBOX[emirate.trim()] : undefined;
  return {
    country: (country || 'AE').toLowerCase(),
    proximity: (center ?? map_center).join(','),
    ...(bbox && { bbox: bbox.join(',') }),
  };
};

/**
 * Turn a typed address into coordinates, limited to the company's country
 * (and, in the UAE, to the chosen emirate).
 * Tries the Mapbox Search Box API first: it knows malls, towers, hotels and
 * other named places ("Al Wahda Mall"), which the older Geocoding API lacks
 * and would otherwise match to a same-named street elsewhere. Falls back to
 * the Geocoding API for plain street addresses. Same VITE_MAPBOX_TOKEN.
 * Returns null when there's no token, no match inside the emirate, or the
 * request fails — no pin is better than a wrong one.
 */
export async function geocodeAddress(address: string, emirate?: string | null): Promise<LatLng | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  const text = (address || '').trim();
  if (!token || !text) return null;
  const bias = emirateBias(emirate);

  try {
    const qs = new URLSearchParams({ q: text, limit: '1', language: 'en', access_token: token, ...bias });
    const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/forward?${qs}`);
    if (res.ok) {
      const coords = (await res.json())?.features?.[0]?.geometry?.coordinates;
      if (Array.isArray(coords) && coords.length === 2) {
        const hit = validCoord(coords[1], coords[0]);
        if (hit) return hit;
      }
    }
  } catch {
    // fall through to the Geocoding API
  }

  try {
    const qs = new URLSearchParams({ limit: '1', access_token: token, ...bias });
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?${qs}`);
    if (!res.ok) return null;
    const center = (await res.json())?.features?.[0]?.center;
    return Array.isArray(center) && center.length === 2 ? validCoord(center[1], center[0]) : null;
  } catch {
    return null;
  }
}
