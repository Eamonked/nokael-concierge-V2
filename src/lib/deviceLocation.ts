export type LocationFailure = 'denied' | 'timeout' | 'unavailable';

/** Retry an unavailable precise fix with a cached/network fix; never retry denial. */
export function requestDeviceLocation(
  geolocation: Pick<Geolocation, 'getCurrentPosition'>,
  success: PositionCallback,
  failure: (reason: LocationFailure) => void,
) {
  geolocation.getCurrentPosition(success, error => {
    if (error.code === 1) { failure('denied'); return; }
    geolocation.getCurrentPosition(success, fallbackError => {
      failure(fallbackError.code === 1 ? 'denied' : fallbackError.code === 3 ? 'timeout' : 'unavailable');
    }, { enableHighAccuracy: false, maximumAge: 300_000, timeout: 15_000 });
  }, { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 });
}
