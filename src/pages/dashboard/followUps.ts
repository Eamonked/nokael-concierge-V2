import React from 'react';
import { supabase, type QuoteRequest, type JobWithDriver, type BusinessInquiry } from '../../lib/supabase';
import { toIntlDigits } from '../../lib/driverContact';
import { SAMPLE_CERT_LEAD_TAG } from '../../constants';

// ==========================================
// Follow-ups queue
// ==========================================
// Who dispatch should message today, worked out from data the dashboard
// already loads. Only what staff did about each one (done / snoozed) is
// stored, in public.follow_up_state (supabase-follow-ups.sql).
//
//   quote   — a quote still pending/contacted 2 h after it came in (up to 14 days)
//   lead    — a sample-certificate download still pending a day later (up to 30 days)
//   first   — a client's only delivery so far, 7 days on (up to 45 days)
//   repeat  — 3+ deliveries in 30 days and no business account yet

export type FollowUpKind = 'quote' | 'lead' | 'first' | 'repeat';

export interface FollowUp {
  /** Stable id, also the follow_up_state key: 'quote:<id>', 'first:<phone key>', … */
  key: string;
  kind: FollowUpKind;
  name: string;
  company?: string | null;
  phone: string | null;
  /** When it became due (ISO). */
  dueAt: string;
  /** One line of context for the row, e.g. the route. */
  detail: string;
  /** Pre-written WhatsApp message; staff can edit it in WhatsApp before sending. */
  message: string;
  quoteId?: string;
  inquiryId?: string;
  jobId?: string;
  /** Deliveries in the last 30 days (repeat). */
  count?: number;
}

export interface FollowUpStateRow {
  item_key: string;
  status: 'done' | 'snoozed';
  snoozed_until: string | null;
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Same idea as public._phone_key: last 9 digits, so +9715…, 05… and 9715… match. */
export const phoneKey = (p?: string | null): string | null => {
  const d = (p ?? '').replace(/\D/g, '');
  return d.length >= 7 ? d.slice(-9) : null;
};

const firstName = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0] || 'there';
const iso = (ms: number) => new Date(ms).toISOString();
const deliveredAt = (j: JobWithDriver) => j.client_delivery_at || j.driver_delivery_at || j.updated_at || j.created_at;
const clientPhone = (j: JobWithDriver) => j.client_whatsapp || j.sender_phone;
const clientName = (j: JobWithDriver) => j.client_name || j.sender_name;

export function getFollowUps(
  input: { jobs: JobWithDriver[]; requests: QuoteRequest[]; inquiries: BusinessInquiry[]; brand: string },
  now: number = Date.now(),
): FollowUp[] {
  const { jobs, requests, inquiries, brand } = input;
  const items: FollowUp[] = [];

  // Pending quotes
  for (const q of requests) {
    if (!q.id || !q.created_at || !(q.status === 'pending' || q.status === 'contacted')) continue;
    const created = new Date(q.created_at).getTime();
    if (now - created > 14 * DAY) continue;
    items.push({
      key: `quote:${q.id}`,
      kind: 'quote',
      name: q.name,
      company: q.company_name,
      phone: q.phone,
      dueAt: iso(created + 2 * HOUR),
      detail: `${q.pickup_location} → ${q.delivery_location}`,
      message: `Hi ${firstName(q.name)}, this is ${brand} dispatch about your delivery request from ${q.pickup_location} to ${q.delivery_location}. Would you like us to book a driver? We can usually collect within 30–60 minutes.`,
      quoteId: q.id,
    });
  }

  // Sample-certificate leads
  for (const b of inquiries) {
    if (!b.id || !b.created_at || (b.status ?? 'pending') !== 'pending') continue;
    if (!(b.urgent_express_dedicated_needs ?? '').startsWith(SAMPLE_CERT_LEAD_TAG)) continue;
    const created = new Date(b.created_at).getTime();
    if (now - created > 30 * DAY) continue;
    items.push({
      key: `lead:${b.id}`,
      kind: 'lead',
      name: b.contact_person,
      company: b.company_name,
      phone: b.phone_whatsapp,
      dueAt: iso(created + DAY),
      detail: b.email,
      message: `Hi ${firstName(b.contact_person)}, thanks for downloading the ${brand} sample Chain of Custody certificate. If you have documents or parcels to move, reply here with the route and we'll send you a quote. Every delivery comes with a certificate like the sample.`,
      inquiryId: b.id,
    });
  }

  // Completed deliveries per client (by phone), oldest first
  const byClient = new Map<string, JobWithDriver[]>();
  for (const j of jobs) {
    if (j.status !== 'completed') continue;
    const k = phoneKey(clientPhone(j));
    if (!k) continue;
    const list = byClient.get(k) ?? [];
    list.push(j);
    byClient.set(k, list);
  }

  for (const [k, list] of byClient) {
    list.sort((a, b) => new Date(deliveredAt(a)!).getTime() - new Date(deliveredAt(b)!).getTime());
    const latest = list[list.length - 1];
    // Managed business accounts already have a dispatcher talking to them.
    if (list.some(j => j.business_id)) continue;

    if (list.length === 1) {
      const j = list[0];
      const at = new Date(deliveredAt(j)!).getTime();
      if (now - at > 45 * DAY) continue;
      items.push({
        key: `first:${k}`,
        kind: 'first',
        name: clientName(j),
        company: j.company_name,
        phone: clientPhone(j),
        dueAt: iso(at + 7 * DAY),
        detail: `${j.job_ref ?? ''} · ${j.pickup_location} → ${j.delivery_location}`.replace(/^ · /, ''),
        message: `Hi ${firstName(clientName(j))}, thanks for sending with ${brand}. Whenever you need another delivery, reply here with the route, or re-book in one tap from your tracking link. We're happy to quote any route.`,
        jobId: j.id,
      });
      continue;
    }

    const recent = list.filter(j => now - new Date(deliveredAt(j)!).getTime() <= 30 * DAY);
    if (recent.length >= 3) {
      const company = latest.company_name;
      items.push({
        key: `repeat:${k}`,
        kind: 'repeat',
        name: clientName(latest),
        company,
        phone: clientPhone(latest),
        dueAt: deliveredAt(latest)!,
        detail: `${recent.length} deliveries in 30 days`,
        message: `Hi ${firstName(clientName(latest))}, thanks for sending ${recent.length} deliveries with ${brand} this month. A business account gives you fixed rates, monthly invoicing and a dedicated dispatcher who knows your routes. Shall I set one up${company ? ` for ${company}` : ''}?`,
        jobId: latest.id,
        count: recent.length,
      });
    }
  }

  // Hottest first (someone waiting on a quote beats a thank-you), then oldest due.
  return items.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

const KIND_ORDER: Record<FollowUpKind, number> = { quote: 0, lead: 1, repeat: 2, first: 3 };

export type FollowUpBucket = 'due' | 'upcoming' | 'snoozed' | 'done';

export function bucketOf(item: FollowUp, state: FollowUpStateRow | undefined, now: number = Date.now()): FollowUpBucket {
  if (state?.status === 'done') return 'done';
  if (state?.status === 'snoozed' && state.snoozed_until && new Date(state.snoozed_until).getTime() > now) return 'snoozed';
  return new Date(item.dueAt).getTime() <= now ? 'due' : 'upcoming';
}

/** wa.me link with the message filled in, or null when the number can't be read. */
export const followUpWhatsApp = (item: FollowUp): string | null => {
  const d = toIntlDigits(item.phone);
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(item.message)}` : null;
};

/**
 * Loads this company's follow_up_state and saves changes to it. `missing` is
 * true when the table isn't there yet (migration not applied): the queue still
 * shows, but done/snooze can't be saved.
 */
export function useFollowUpState(orgId: string | null | undefined) {
  const [rows, setRows] = React.useState<Map<string, FollowUpStateRow>>(new Map());
  const [missing, setMissing] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!supabase || !orgId) return;
    const { data, error } = await supabase
      .from('follow_up_state')
      .select('item_key, status, snoozed_until')
      .eq('organization_id', orgId);
    if (error) {
      setMissing(error.code === '42P01' || error.code === 'PGRST205');
      if (error.code !== '42P01' && error.code !== 'PGRST205') console.error('[follow-ups] load failed:', error.message);
      return;
    }
    setMissing(false);
    setRows(new Map((data as FollowUpStateRow[]).map(r => [r.item_key, r])));
  }, [orgId]);

  React.useEffect(() => { load(); }, [load]);

  const save = React.useCallback(async (key: string, change: { status: 'done' | 'snoozed'; snoozed_until?: string | null } | null) => {
    if (!supabase || !orgId) throw new Error('Supabase not configured');
    const previous = rows.get(key);
    // Optimistic: the row moves straight away, and comes back if the save fails.
    setRows(prev => {
      const next = new Map(prev);
      if (change) next.set(key, { item_key: key, status: change.status, snoozed_until: change.snoozed_until ?? null });
      else next.delete(key);
      return next;
    });
    const { error } = change
      ? await supabase.from('follow_up_state').upsert({
          organization_id: orgId,
          item_key: key,
          status: change.status,
          snoozed_until: change.snoozed_until ?? null,
          updated_at: new Date().toISOString(),
        })
      : await supabase.from('follow_up_state').delete().eq('organization_id', orgId).eq('item_key', key);
    if (error) {
      setRows(prev => {
        const next = new Map(prev);
        if (previous) next.set(key, previous); else next.delete(key);
        return next;
      });
      throw error;
    }
  }, [orgId, rows]);

  return { state: rows, missing, save, reload: load };
}
