/** The Confirmation Portal (client links, driver web app, Android download). */
export const COC_URL = (import.meta.env.VITE_COC_URL || 'https://coc.nokael.com').replace(/\/$/, '');

/** Where drivers install the Nokael Driver Android app (the page also links the web app for iPhones). */
export const DRIVER_APP_DOWNLOAD_URL: string = import.meta.env.VITE_DRIVER_APP_URL || `${COC_URL}/android`;

export const driverAppShareText = (company = 'Nokael') =>
  `Install the ${company} Driver app: ${DRIVER_APP_DOWNLOAD_URL}`;

/** Phone: the share sheet. Desktop (or share cancelled/unsupported): copy the link. */
export async function shareDriverApp(company?: string): Promise<'shared' | 'copied' | 'failed'> {
  const text = driverAppShareText(company);
  if (typeof navigator !== 'undefined' && navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title: 'Driver app', text, url: DRIVER_APP_DOWNLOAD_URL });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'failed';
    }
  }
  try {
    await navigator.clipboard.writeText(DRIVER_APP_DOWNLOAD_URL);
    return 'copied';
  } catch {
    return 'failed';
  }
}
