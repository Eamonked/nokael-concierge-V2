import type { Driver } from './supabase';

/**
 * Driver app sign-in rules, mirrored from the `driver_login` database function
 * so the dashboard can tell an admin up front whether a driver will get in:
 *
 *  - the driver must be `active` and `onboarding_status = 'approved'`, and have a PIN;
 *  - they sign in with their phone or WhatsApp number (matched on the LAST 9 DIGITS)
 *    or their email, and use the PIN as the password;
 *  - a number or email shared by two drivers matches nobody, so it can't be used to sign in.
 */
export const driverPhoneKey = (value?: string | null): string | null => {
  const digits = (value || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : null;
};

export const driverEmailKey = (value?: string | null): string | null => {
  const email = (value || '').trim().toLowerCase();
  return email.includes('@') ? email : null;
};

/**
 * The database refuses a driver whose phone/WhatsApp (last 9 digits) or email
 * already belongs to another driver (supabase-driver-unique-identity.sql).
 * Returns which one clashed, or null for any other error.
 */
export const driverIdentityConflict = (error: unknown): 'phone' | 'email' | null => {
  const message = String((error as { message?: string })?.message ?? error ?? '');
  if (message.includes('driver_phone_taken')) return 'phone';
  if (message.includes('driver_email_taken') || message.includes('drivers_email_unique')) return 'email';
  return null;
};

/** Both the intake form and Add Agent write `inter_emirate_yes_no`; older rows may only have `inter_emirate`. */
export const driverInterEmirate = (driver: Partial<Driver>): boolean =>
  driver.inter_emirate_yes_no ?? driver.inter_emirate ?? true;

/** File types accepted by /api/upload-driver-doc (routes/upload.ts). */
export const DRIVER_DOC_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
export const DRIVER_DOC_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Upload one driver document to the Google Drive folder behind
 * /api/upload-driver-doc. Returns the link stored in driver_documents.file_url.
 */
export const uploadDriverDocFile = async (file: File): Promise<{ file_url: string; drive_file_id?: string }> => {
  const body = new FormData();
  body.append('file', file);
  const apiKey = import.meta.env.VITE_NOKAEL_API_KEY;

  const response = await fetch('/api/upload-driver-doc', {
    method: 'POST',
    headers: apiKey ? { 'x-nokael-key': apiKey } : {},
    body,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.details || err.error || 'Upload failed');
  }
  return response.json();
};
