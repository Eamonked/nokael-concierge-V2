// ==========================================
// Live ETA calculation (Mapbox Directions API)
// ==========================================
// There is no routing engine stored in the database — an ETA is a live
// derived value that depends on the driver's current position, which
// changes constantly. Storing it would just be another field that goes
// stale the moment it's written, so it is always computed on demand here.
//
// Provider: Mapbox Directions API, `driving-traffic` profile. Requires
// VITE_MAPBOX_TOKEN to be set (see .env.example). Returns null — never a
// guess — when the token is missing, the request fails, or no route is
// found, so callers should render "—" rather than a fabricated value.

export async function getEtaMinutes(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<number | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token) return null;

  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${fromLng},${fromLat};${toLng},${toLat}?access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const seconds = data?.routes?.[0]?.duration;
    return typeof seconds === 'number' ? Math.round(seconds / 60) : null;
  } catch {
    return null;
  }
}
