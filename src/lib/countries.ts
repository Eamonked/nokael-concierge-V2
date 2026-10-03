// ==========================================
// Country presets for tenant onboarding
// ==========================================
// Picking a country in onboarding pre-fills everything below into
// organizations.settings; every value stays editable afterwards. Shared by
// the browser (onboarding wizard) and the server (routes/onboarding.ts), so
// keep it free of browser/Node-only imports.

export interface CountryPreset {
  code: string;          // ISO 3166-1 alpha-2
  name: string;
  currency: string;      // ISO 4217
  timezone: string;      // IANA
  locale: string;        // BCP 47, used for number/date formatting
  dial_code: string;     // E.164 prefix
  region_label: string;  // what a "region" is called locally
  regions: string[];     // [] = free-text region
  tax_label: string;
  tax_rate: number;      // percent
  map_center: [number, number]; // [lng, lat], biases address search
}

const p = (
  code: string, name: string, currency: string, timezone: string, locale: string, dial_code: string,
  region_label: string, regions: string[], tax_label: string, tax_rate: number, map_center: [number, number],
): CountryPreset => ({ code, name, currency, timezone, locale, dial_code, region_label, regions, tax_label, tax_rate, map_center });

export const COUNTRY_PRESETS: CountryPreset[] = [
  p('AE', 'United Arab Emirates', 'AED', 'Asia/Dubai', 'en-AE', '+971', 'Emirate',
    ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'], 'VAT', 5, [55.0, 25.0]),
  p('SA', 'Saudi Arabia', 'SAR', 'Asia/Riyadh', 'en-SA', '+966', 'Region',
    ['Riyadh', 'Makkah', 'Madinah', 'Eastern Province', 'Qassim', 'Asir', 'Tabuk', 'Hail', 'Northern Borders', 'Jazan', 'Najran', 'Al Bahah', 'Al Jawf'], 'VAT', 15, [46.68, 24.71]),
  p('QA', 'Qatar', 'QAR', 'Asia/Qatar', 'en-QA', '+974', 'Municipality',
    ['Doha', 'Al Rayyan', 'Al Wakrah', 'Al Khor', 'Umm Salal', 'Al Daayen', 'Al Shamal', 'Al Shahaniya'], 'VAT', 0, [51.53, 25.29]),
  p('KW', 'Kuwait', 'KWD', 'Asia/Kuwait', 'en-KW', '+965', 'Governorate',
    ['Capital', 'Hawalli', 'Farwaniya', 'Mubarak Al-Kabeer', 'Ahmadi', 'Jahra'], 'VAT', 0, [47.98, 29.37]),
  p('BH', 'Bahrain', 'BHD', 'Asia/Bahrain', 'en-BH', '+973', 'Governorate',
    ['Capital', 'Muharraq', 'Northern', 'Southern'], 'VAT', 10, [50.58, 26.22]),
  p('OM', 'Oman', 'OMR', 'Asia/Muscat', 'en-OM', '+968', 'Governorate',
    ['Muscat', 'Dhofar', 'Musandam', 'Al Buraimi', 'Ad Dakhiliyah', 'North Al Batinah', 'South Al Batinah', 'South Ash Sharqiyah', 'North Ash Sharqiyah', 'Adh Dhahirah', 'Al Wusta'], 'VAT', 5, [58.41, 23.59]),
  p('EG', 'Egypt', 'EGP', 'Africa/Cairo', 'en-EG', '+20', 'Governorate',
    ['Cairo', 'Giza', 'Alexandria', 'Qalyubia', 'Sharqia', 'Dakahlia', 'Port Said', 'Suez', 'Ismailia', 'Red Sea', 'South Sinai'], 'VAT', 14, [31.24, 30.04]),
  p('JO', 'Jordan', 'JOD', 'Asia/Amman', 'en-JO', '+962', 'Governorate',
    ['Amman', 'Irbid', 'Zarqa', 'Balqa', 'Madaba', 'Aqaba', 'Karak', 'Mafraq', 'Jerash', 'Ajloun', 'Tafilah', "Ma'an"], 'Sales tax', 16, [35.93, 31.95]),
  p('GB', 'United Kingdom', 'GBP', 'Europe/London', 'en-GB', '+44', 'City', [], 'VAT', 20, [-0.13, 51.51]),
  p('IE', 'Ireland', 'EUR', 'Europe/Dublin', 'en-IE', '+353', 'County', [], 'VAT', 23, [-6.26, 53.35]),
  p('DE', 'Germany', 'EUR', 'Europe/Berlin', 'de-DE', '+49', 'City', [], 'MwSt', 19, [13.40, 52.52]),
  p('FR', 'France', 'EUR', 'Europe/Paris', 'fr-FR', '+33', 'City', [], 'TVA', 20, [2.35, 48.86]),
  p('NL', 'Netherlands', 'EUR', 'Europe/Amsterdam', 'nl-NL', '+31', 'City', [], 'BTW', 21, [4.90, 52.37]),
  p('ES', 'Spain', 'EUR', 'Europe/Madrid', 'es-ES', '+34', 'City', [], 'IVA', 21, [-3.70, 40.42]),
  p('IT', 'Italy', 'EUR', 'Europe/Rome', 'it-IT', '+39', 'City', [], 'IVA', 22, [12.50, 41.90]),
  p('US', 'United States', 'USD', 'America/New_York', 'en-US', '+1', 'State', [], 'Sales tax', 0, [-74.01, 40.71]),
  p('CA', 'Canada', 'CAD', 'America/Toronto', 'en-CA', '+1', 'Province',
    ['Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan', 'Nova Scotia', 'New Brunswick', 'Newfoundland and Labrador', 'Prince Edward Island'], 'GST', 5, [-79.38, 43.65]),
  p('IN', 'India', 'INR', 'Asia/Kolkata', 'en-IN', '+91', 'City', [], 'GST', 18, [77.21, 28.61]),
  p('PK', 'Pakistan', 'PKR', 'Asia/Karachi', 'en-PK', '+92', 'City', [], 'GST', 18, [67.01, 24.86]),
  p('NG', 'Nigeria', 'NGN', 'Africa/Lagos', 'en-NG', '+234', 'State', [], 'VAT', 7.5, [3.38, 6.52]),
  p('KE', 'Kenya', 'KES', 'Africa/Nairobi', 'en-KE', '+254', 'County', [], 'VAT', 16, [36.82, -1.29]),
  // Kampala metro first — that's where most same-day volume is. "Area" rather
  // than "District" because customers mix cities (Entebbe) and districts (Wakiso).
  p('UG', 'Uganda', 'UGX', 'Africa/Kampala', 'en-UG', '+256', 'Area',
    ['Kampala', 'Wakiso', 'Entebbe', 'Mukono', 'Jinja', 'Mbarara', 'Masaka', 'Mbale', 'Gulu', 'Lira', 'Fort Portal', 'Hoima', 'Arua'], 'VAT', 18, [32.58, 0.35]),
  p('GH', 'Ghana', 'GHS', 'Africa/Accra', 'en-GH', '+233', 'Region', [], 'VAT', 15, [-0.19, 5.60]),
  p('ZA', 'South Africa', 'ZAR', 'Africa/Johannesburg', 'en-ZA', '+27', 'Province',
    ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'], 'VAT', 15, [28.05, -26.20]),
  p('SG', 'Singapore', 'SGD', 'Asia/Singapore', 'en-SG', '+65', 'District', [], 'GST', 9, [103.82, 1.35]),
  p('MY', 'Malaysia', 'MYR', 'Asia/Kuala_Lumpur', 'en-MY', '+60', 'State', [], 'SST', 8, [101.69, 3.14]),
  p('AU', 'Australia', 'AUD', 'Australia/Sydney', 'en-AU', '+61', 'State',
    ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia', 'Tasmania', 'Australian Capital Territory', 'Northern Territory'], 'GST', 10, [151.21, -33.87]),
  p('NZ', 'New Zealand', 'NZD', 'Pacific/Auckland', 'en-NZ', '+64', 'City', [], 'GST', 15, [174.76, -36.85]),
];

export const findCountry = (code?: string | null): CountryPreset | undefined =>
  code ? COUNTRY_PRESETS.find(c => c.code === code.toUpperCase()) : undefined;

/** "Acme Couriers Ltd" → "acme-couriers-ltd", clipped to the DB slug rule. */
export const slugify = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');

/** "Acme Couriers" → "ACM" — default job-reference prefix. */
export const refPrefixFor = (name: string): string => {
  const letters = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (letters.slice(0, 3) || 'JOB').padEnd(2, 'X');
};

/** Settings object for a fresh org in this country. */
export const settingsForCountry = (preset: CountryPreset, companyName: string) => ({
  country: preset.code,
  currency: preset.currency,
  timezone: preset.timezone,
  locale: preset.locale,
  dial_code: preset.dial_code,
  region_label: preset.region_label,
  regions: preset.regions,
  tax_label: preset.tax_label,
  tax_rate: preset.tax_rate,
  map_center: preset.map_center,
  job_ref_prefix: refPrefixFor(companyName),
  languages: ['en'],
});
