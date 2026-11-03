// Shared by the public form and server. Unknown free-text addresses remain usable;
// explicit city/district contradictions must be corrected before submission.
export function routeProblem(address: string, region: string): boolean {
  const normalized = address.toLowerCase();
  const cities: Record<string, RegExp> = {
    Dubai: /\bdubai\b|\bdifc\b|\bjebel ali\b|دبي/i,
    'Abu Dhabi': /\babu\s*dhabi\b|\badgm\b|\bmussafah\b|أبو\s*ظبي/i,
    Sharjah: /\bsharjah\b|الشارقة/i,
    Ajman: /\bajman\b|عجمان/i,
    'Umm Al Quwain': /\bumm al quwain\b|أم القيوين/i,
    'Ras Al Khaimah': /\bras al khaimah\b|رأس الخيمة/i,
    Fujairah: /\bfujairah\b|الفجيرة/i,
  };
  if (!cities[region]) return false;
  const mentioned = Object.entries(cities).filter(([, pattern]) => pattern.test(normalized));
  return mentioned.length > 0 && !mentioned.some(([name]) => name === region);
}

export function validFutureDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now();
}

export function validPhone(value: string): boolean {
  return /^\+?[\d\s()-]+$/.test(value) && value.replace(/\D/g, '').length >= 8 && value.replace(/\D/g, '').length <= 15;
}
