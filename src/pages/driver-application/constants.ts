import { FileText, Truck } from 'lucide-react';

// `id` values are the literal strings written to Supabase (document_type column) —
// do not change them. `i18nKey` is only for looking up the translated label/description.
export const DOCUMENT_TYPES = [
  { id: 'emirates_id', i18nKey: 'emiratesId', icon: FileText },
  { id: 'license', i18nKey: 'license', icon: FileText },
  { id: 'registration', i18nKey: 'registration', icon: FileText },
  { id: 'vehicle_photo', i18nKey: 'vehiclePhoto', icon: Truck },
];

// `value` is the literal string written to Supabase (Driver.vehicle_type column) —
// do not change these. `i18nKey` is only for the translated <option> label.
export const VEHICLE_TYPES = [
  { value: 'Sedan', i18nKey: 'sedan' },
  { value: 'Executive SUV', i18nKey: 'executiveSuv' },
  { value: 'Panel Van', i18nKey: 'panelVan' },
  { value: 'Motorcycle (License R)', i18nKey: 'motorcycle' },
  { value: '3-Ton Pickup', i18nKey: 'pickup3Ton' },
];

// ⚠ Pending WhatsApp-language-style decision — these labels are concatenated directly
// into Driver.availability_hours (e.g. "Mon, Tue, Wed | 08:00 - 20:00"), which is stored
// and read by ops as plain text. Translating them would change stored data, not just
// display, so left as fixed English until that call is made (see plan doc, WhatsApp note).
export const DAYS_OF_WEEK = [
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' },
  { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
];
