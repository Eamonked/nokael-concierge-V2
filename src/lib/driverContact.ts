import type { Driver } from './supabase';

/**
 * Mirrors public.normalize_uae_phone (supabase-driver-contacts.sql) so links
 * still work for rows written before that migration ran.
 * Returns digits only with country code (what wa.me wants), or null.
 */
export const toIntlDigits = (value?: string | null): string | null => {
  if (!value) return null;
  const raw = value.trim();
  const d = raw.replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) return d.slice(2);
  if (/^971\d{8,9}$/.test(d)) return d;
  if (/^0\d{8,9}$/.test(d)) return `971${d.slice(1)}`;
  if (/^5\d{8}$/.test(d)) return `971${d}`;
  if (raw.startsWith('+')) return d;
  return null; // unknown format: no link rather than a wrong one
};

export const telLink = (phone?: string | null) => {
  const d = toIntlDigits(phone);
  return d ? `tel:+${d}` : null;
};

export const whatsappLink = (number?: string | null, message?: string) => {
  const d = toIntlDigits(number);
  if (!d) return null;
  return `https://wa.me/${d}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
};

/** WhatsApp number if set, otherwise phone. */
export const driverWhatsapp = (d: Pick<Driver, 'phone' | 'whatsapp'>) => d.whatsapp || d.phone;

/** Approved, on-call drivers: the people you ring when the core team is booked. */
export const isStandby = (d: Driver) =>
  (d.pipeline_status || 'Sourced') === 'Active' && (d.availability || 'on-call') === 'on-call';

const vEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');

/**
 * vCard 3.0 file for the selected drivers. Import it on the dispatch phone once
 * and every driver is a saved contact, which WhatsApp broadcast lists require.
 * Names are prefixed "Nokael" so they group together in the address book.
 */
export const driversToVCard = (drivers: Driver[]) =>
  drivers
    .map(d => {
      const phone = toIntlDigits(d.phone);
      const wa = toIntlDigits(driverWhatsapp(d));
      const name = `Nokael ${d.full_name || 'Driver'}`;
      const note = [d.availability, d.base_location, d.vehicle_type, d.tier && `Tier ${d.tier}`]
        .filter(Boolean)
        .join(' · ');
      return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${vEscape(name)}`,
        `N:;${vEscape(name)};;;`,
        'ORG:Nokael Drivers',
        phone && `TEL;TYPE=CELL:+${phone}`,
        wa && wa !== phone && `TEL;TYPE=CELL,WHATSAPP:+${wa}`,
        d.email && `EMAIL:${vEscape(d.email)}`,
        note && `NOTE:${vEscape(note)}`,
        'END:VCARD',
      ]
        .filter(Boolean)
        .join('\r\n');
    })
    .join('\r\n');

export const downloadText = (filename: string, text: string, mime: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
