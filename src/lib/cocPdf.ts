import { jsPDF } from 'jspdf';
import { supabase } from './supabase';

// ==========================================
// Chain of Custody certificate (staff copy)
// ==========================================
// Same certificate the client downloads from coc.nokael.com/<token>/track
// (Nokael-Confirmation-Portal/src/lib/cocPdf.ts — keep the two in step).
// Client links close 24 h after delivery; after that dispatch issues the
// certificate from here, reading the job, driver and handover log directly
// (staff RLS) instead of through the client token.

/** The job fields the certificate prints. */
export interface CocJobData {
  job_ref?: string | null;
  status: string;
  sender_name: string;
  company_name?: string | null;
  recipient_name: string;
  pickup_location: string;
  pickup_emirate: string;
  delivery_location: string;
  delivery_emirate: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  item_type: string;
  urgency: string;
  created_at?: string | null;
  sender_ready_at?: string | null;
  driver_arrived_pickup_at?: string | null;
  driver_pickup_at?: string | null;
  client_pickup_at?: string | null;
  driver_arrived_delivery_at?: string | null;
  driver_delivery_at?: string | null;
  client_delivery_at?: string | null;
}

const formatUAETime = (date: string | Date | null | undefined): string =>
  date ? new Intl.DateTimeFormat('en-AE', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)) : '';

export interface DriverContact {
  full_name: string | null;
  phone: string | null;
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
}

/** One confirmed custody step with the driver's GPS fix (get_job_pod_by_token). */
export interface PodFix {
  step: 'client_pickup' | 'driver_pickup' | 'driver_delivery' | 'client_delivery';
  method: 'otp' | 'ops_override';
  driver_lat: number | null;
  driver_lng: number | null;
  accuracy_m: number | null;
  fix_age_s: number | null;
  confirmed_at: string;
}

const metersBetween = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

/** The fix for a handover: the driver's own confirmation first, else the client's. */
const fixFor = (pod: PodFix[], steps: PodFix['step'][]) =>
  steps.map((s) => pod.find((p) => p.step === s)).find(Boolean) ?? null;

/** Builds and downloads the certificate. No OTPs are ever printed. */
export function downloadCocPdf(job: CocJobData, driver: DriverContact | null, pod: PodFix[] = []) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ink = '#0f172a';
  const muted = '#64748b';
  const accent = '#0369A1';
  const success = '#10b981';
  const W = 210;
  const M = 18;

  // Header band
  doc.setFillColor(ink);
  doc.rect(0, 0, W, 38, 'F');
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('NOKAEL', M, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('CHAIN OF CUSTODY CERTIFICATE', M, 26);
  doc.setFontSize(9);
  doc.text(`Job ref  ${job.job_ref ?? ''}`, W - M, 18, { align: 'right' });
  doc.text(`Issued  ${formatUAETime(new Date())} (UAE)`, W - M, 26, { align: 'right' });

  let y = 52;
  const label = (text: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(muted);
    doc.text(text.toUpperCase(), x, yy);
  };
  const value = (text: string, x: number, yy: number, maxW = 80) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(ink);
    const lines = doc.splitTextToSize(text || '—', maxW);
    doc.text(lines, x, yy);
    return lines.length * 5;
  };

  // Status line
  const completed = job.status === 'completed';
  doc.setFillColor(completed ? '#ecfdf5' : '#f1f5f9');
  doc.roundedRect(M, y - 7, W - 2 * M, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(completed ? success : accent);
  doc.text(completed ? 'DELIVERED — CUSTODY CHAIN COMPLETE' : `STATUS: ${job.status.replace(/_/g, ' ').toUpperCase()}`, M + 4, y);
  y += 16;

  // Parties
  const col2 = W / 2 + 4;
  label('Sender', M, y);
  label('Recipient', col2, y);
  y += 6;
  const h1 = value(`${job.sender_name}${job.company_name ? `\n${job.company_name}` : ''}`, M, y);
  const h2 = value(job.recipient_name, col2, y);
  y += Math.max(h1, h2) + 5;

  label('Collected from', M, y);
  label('Delivered to', col2, y);
  y += 6;
  const h3 = value(`${job.pickup_location}, ${job.pickup_emirate}`, M, y);
  const h4 = value(`${job.delivery_location}, ${job.delivery_emirate}`, col2, y);
  y += Math.max(h3, h4) + 5;

  label('Item', M, y);
  label('Driver', col2, y);
  y += 6;
  value(`${job.item_type} · ${job.urgency}`.toUpperCase(), M, y);
  const vehicle = driver ? [driver.vehicle_make, driver.vehicle_model, driver.vehicle_plate].filter(Boolean).join(' ') : '';
  const h5 = value(`${driver?.full_name || 'Nokael courier'}${vehicle ? `\n${vehicle}` : ''}`, col2, y);
  y += Math.max(5, h5) + 10;

  // Timeline
  doc.setDrawColor('#e2e8f0');
  doc.line(M, y, W - M, y);
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(ink);
  doc.text('Custody events', M, y);
  y += 9;

  const pickupFix = fixFor(pod, ['driver_pickup', 'client_pickup']);
  const deliveryFix = fixFor(pod, ['driver_delivery', 'client_delivery']);
  const verifiedBy = (fix: PodFix | null, codeText: string) =>
    fix?.method === 'ops_override' ? 'Confirmed by Nokael operations' : codeText;

  type Event = { label: string; at?: string | null; note: string; fix?: PodFix | null; address?: [number | null, number | null] };
  const events: Event[] = [
    { label: 'Job booked', at: job.created_at, note: 'Manifest logged with Nokael dispatch' },
    { label: 'Package ready at origin', at: job.sender_ready_at, note: 'Sender confirmed package prepared' },
    { label: 'Driver arrived at pickup', at: job.driver_arrived_pickup_at, note: job.pickup_location },
    {
      label: 'Custody transferred to driver',
      at: job.driver_pickup_at || job.client_pickup_at,
      note: verifiedBy(pickupFix, 'Handover verified by one-time code'),
      fix: pickupFix,
      address: [job.pickup_lat, job.pickup_lng],
    },
    { label: 'Driver arrived at destination', at: job.driver_arrived_delivery_at, note: job.delivery_location },
    {
      label: 'Custody transferred to recipient',
      at: job.client_delivery_at || job.driver_delivery_at,
      note: verifiedBy(deliveryFix, 'Receipt verified by one-time code'),
      fix: deliveryFix,
      address: [job.delivery_lat, job.delivery_lng],
    },
  ];

  events.forEach((e, i) => {
    const done = Boolean(e.at);
    doc.setFillColor(done ? success : '#cbd5e1');
    doc.circle(M + 2, y - 1.3, 1.8, 'F');
    if (i < events.length - 1) {
      doc.setDrawColor(done ? success : '#e2e8f0');
      doc.setLineWidth(0.4);
      doc.line(M + 2, y + 1, M + 2, y + 11);
    }
    doc.setFont('helvetica', done ? 'bold' : 'normal');
    doc.setFontSize(10);
    doc.setTextColor(done ? ink : muted);
    doc.text(e.label, M + 8, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(done ? formatUAETime(e.at!) : 'Not recorded', W - M, y, { align: 'right' });
    doc.setFontSize(8.5);
    doc.setTextColor(muted);
    doc.text(doc.splitTextToSize(e.note, 120)[0], M + 8, y + 4.5);

    // Where the handover happened, as a tappable map link.
    const f = e.at ? e.fix : null;
    if (f && f.driver_lat != null && f.driver_lng != null) {
      const coords = `${f.driver_lat.toFixed(5)}, ${f.driver_lng.toFixed(5)}`;
      const [aLat, aLng] = e.address ?? [null, null];
      const off = aLat != null && aLng != null ? metersBetween(f.driver_lat, f.driver_lng, aLat, aLng) : null;
      const extra = [
        f.accuracy_m != null ? `±${Math.round(f.accuracy_m)} m` : null,
        off != null ? (off < 1000 ? `${Math.round(off)} m from booked address` : `${(off / 1000).toFixed(1)} km from booked address`) : null,
      ].filter(Boolean).join(' · ');
      doc.setTextColor(accent);
      doc.textWithLink(`GPS ${coords}`, M + 8, y + 9, { url: `https://maps.google.com/?q=${f.driver_lat},${f.driver_lng}` });
      if (extra) {
        doc.setTextColor(muted);
        doc.text(`  ·  ${extra}`, M + 8 + doc.getTextWidth(`GPS ${coords}`), y + 9);
      }
      y += 4.5;
    }
    y += 13;
  });

  // Transit time
  const start = job.driver_pickup_at || job.client_pickup_at;
  const end = job.client_delivery_at || job.driver_delivery_at;
  if (start && end) {
    const mins = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
    y += 4;
    doc.setFillColor('#f8fafc');
    doc.roundedRect(M, y, W - 2 * M, 14, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(muted);
    doc.text('TOTAL TIME IN CUSTODY', M + 5, y + 8.8);
    doc.setFontSize(12);
    doc.setTextColor(ink);
    doc.text(mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : mins < 1 ? '< 1 min' : `${mins} min`, W - M - 5, y + 9, { align: 'right' });
  }

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(muted);
  doc.text('Each handover was confirmed with a single-use code held by the party receiving custody.', W / 2, 276, { align: 'center' });
  doc.text('GPS is the driver\'s phone position when the handover was confirmed.', W / 2, 280, { align: 'center' });
  doc.text(`Nokael Chain of Custody · ${job.job_ref ?? ''} · issued by Nokael dispatch`, W / 2, 285, { align: 'center' });

  doc.save(`Nokael-COC-${job.job_ref ?? 'job'}.pdf`);
}

/**
 * Loads the driver and handover GPS for a job and downloads its certificate.
 * Same "latest log row per step, confirmed only" rule as get_job_pod_by_token.
 */
export async function downloadCocForJob(job: CocJobData & { id?: string; driver_id?: string | null }) {
  if (!supabase) throw new Error('Supabase not configured');
  const [driverRes, podRes] = await Promise.all([
    job.driver_id
      ? supabase.from('drivers')
          .select('full_name, phone, vehicle_type, vehicle_make, vehicle_model, vehicle_plate')
          .eq('id', job.driver_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('job_pod_log')
      .select('step, action, method, driver_lat, driver_lng, accuracy_m, fix_age_s, created_at')
      .eq('job_id', job.id!)
      .order('created_at', { ascending: false }),
  ]);
  if (podRes.error) throw podRes.error;

  const latest = new Map<string, any>();
  for (const row of podRes.data ?? []) if (!latest.has(row.step)) latest.set(row.step, row);
  const pod: PodFix[] = [...latest.values()]
    .filter((r) => r.action === 'confirmed')
    .map((r) => ({ ...r, confirmed_at: r.created_at }));

  downloadCocPdf(job, (driverRes.data as DriverContact | null) ?? null, pod);
}
