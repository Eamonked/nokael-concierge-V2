// ==========================================
// Coordinates, distances and address lookup
// ==========================================

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

// Centre of the Dubai ↔ Abu Dhabi corridor, used to bias address lookups.
const UAE_PROXIMITY = '55.0,25.0';

/**
 * Turn a typed address into coordinates with the Mapbox Geocoding API
 * (same VITE_MAPBOX_TOKEN as the ETA lookup). Limited to the UAE.
 * Returns null when there's no token, no match, or the request fails.
 */
export async function geocodeAddress(address: string, emirate?: string | null): Promise<LatLng | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  const text = [address, emirate].map(s => (s || '').trim()).filter(Boolean).join(', ');
  if (!token || !text) return null;

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json` +
      `?country=ae&limit=1&proximity=${UAE_PROXIMITY}&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const center = data?.features?.[0]?.center;
    return Array.isArray(center) && center.length === 2 ? validCoord(center[1], center[0]) : null;
  } catch {
    return null;
  }
}
