import { Router } from 'express';
import { rateLimit } from '../middleware/security.js';
import { getServiceClient } from './team.js';
import { routeProblem, validFutureDate, validPhone } from '../shared/quoteValidation.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const textFields = ['pickup_location', 'delivery_location', 'emirate', 'item_type', 'urgency', 'name', 'phone', 'company_name', 'corporate_code', 'customer_type', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'notes'] as const;

async function notifySavedQuote(payload: Record<string, any>) {
  if (payload.organization_id !== (process.env.VITE_NOKAEL_ORG_ID || '89412cf2-dd3a-447c-906a-e59aaa64926d')) return;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    console.error('[quotes] Saved enquiry; dispatcher notification is not configured');
    return;
  }
  // Text is generated from the saved record, never arbitrary client HTML.
  const message = `New quote ${payload.tracking_id}\n${payload.name}\n${payload.phone}\n${payload.pickup_location} → ${payload.delivery_location}\n${payload.emirate}\n${payload.item_type}: ${payload.urgency}\n${payload.notes || ''}\nContact: ${payload.whatsapp_opt_in ? 'WhatsApp' : 'Phone'}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text: message }),
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) return;
    } catch { /* retry without exposing customer details in logs */ }
  }
  console.error('[quotes] Dispatcher notification failed after retries', payload.id);
}

export function createQuotesRouter(deps: { client?: ReturnType<typeof getServiceClient>; notify?: typeof notifySavedQuote } = {}) {
  const router = Router();
  const alerted = new Map<string, number>();
  router.post('/lead-alert', rateLimit(10, 60_000), async (req, res) => {
    const client = deps.client === undefined ? getServiceClient() : deps.client;
    const { id, kind, tenant_slug } = req.body || {};
    if (!client) return res.status(503).json({ error: 'Notification service unavailable' });
    if (!uuid.test(id || '') || !['business', 'driver'].includes(kind) || typeof tenant_slug !== 'string' || !/^[a-z0-9-]{1,80}$/.test(tenant_slug)) return res.status(400).json({ error: 'Invalid intake reference' });
    const key = `${kind}:${id}`;
    const now = Date.now();
    for (const [k, expires] of alerted) if (expires < now) alerted.delete(k);
    if (alerted.has(key)) return res.sendStatus(202);
    alerted.set(key, now + 10 * 60_000);
    try {
      const { data: org, error: orgError } = await client.rpc('get_public_org', { p_slug: tenant_slug });
      if (orgError || !org?.id) return res.sendStatus(400);
      const table = kind === 'business' ? 'business_inquiries' : 'drivers';
      const fields = kind === 'business' ? 'id, organization_id, created_at, company_name, contact_person, phone_whatsapp, typical_routes' : 'id, organization_id, created_at, full_name, phone, base_location, vehicle_type';
      const { data: record, error } = await client.from(table).select(fields).eq('id', id).eq('organization_id', org.id).maybeSingle();
      if (error || !record || !Number.isFinite(Date.parse((record as any).created_at)) || Date.parse((record as any).created_at) < now - 10 * 60_000) return res.sendStatus(400);
      const row = record as any;
      await (deps.notify || notifySavedQuote)({ id, organization_id: org.id, tracking_id: id, name: row.contact_person || row.full_name, phone: row.phone_whatsapp || row.phone, pickup_location: row.company_name || row.base_location, delivery_location: row.typical_routes || '', emirate: '', item_type: kind, urgency: 'New saved intake', notes: row.vehicle_type || '', whatsapp_opt_in: kind === 'business' });
      return res.sendStatus(202);
    } catch { alerted.delete(key); return res.sendStatus(503); }
  });
  router.post('/quotes', rateLimit(10, 60_000), async (req, res) => {
    const client = deps.client === undefined ? getServiceClient() : deps.client;
    if (!client) return res.status(503).json({ error: 'Enquiries are temporarily unavailable. Please call dispatch.' });
    const body = req.body;
    if (!body || typeof body !== 'object' || !uuid.test(body.id || '') || typeof body.tenant_slug !== 'string' || !/^[a-z0-9-]{1,80}$/.test(body.tenant_slug)) {
      return res.status(400).json({ error: 'Invalid enquiry.' });
    }
    const payload: Record<string, any> = { id: body.id, status: 'pending', source: 'website' };
    for (const field of textFields) {
      if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].length > 1000)) return res.status(400).json({ error: 'Invalid enquiry details.' });
      if (typeof body[field] === 'string') payload[field] = body[field].trim();
    }
    if (!['pickup_location', 'delivery_location', 'name', 'phone', 'emirate'].every(k => payload[k]) || !validPhone(payload.phone) ||
      !['document', 'parcel', 'spare_part', 'other'].includes(payload.item_type) || !['immediate', 'today', 'scheduled'].includes(payload.urgency) ||
      typeof body.whatsapp_opt_in !== 'boolean' || (body.customer_type && !['business', 'personal'].includes(body.customer_type))) {
      return res.status(400).json({ error: 'Check the route, item and contact details.' });
    }
    const regions = payload.emirate.split(' → ');
    if (regions.length !== 2 || regions.some((region: string) => !region.trim()) || routeProblem(payload.pickup_location, regions[0]) || routeProblem(payload.delivery_location, regions[1])) {
      return res.status(400).json({ error: 'Check that each address matches its selected region.' });
    }
    // Deadline is stored in notes, avoiding a new database column/migration.
    if (payload.urgency === 'scheduled' && !validFutureDate(body.pickup_at)) return res.status(400).json({ error: 'Choose a future pickup time.' });
    if (body.deadline && (!validFutureDate(body.deadline) || (body.pickup_at && Date.parse(body.deadline) <= Date.parse(body.pickup_at)))) return res.status(400).json({ error: 'Check the delivery deadline.' });
    payload.notes = [payload.notes, payload.urgency === 'scheduled' ? `Pickup (UTC): ${body.pickup_at}` : '', body.deadline ? `Delivery deadline (UTC): ${body.deadline}` : ''].filter(Boolean).join('\n');
    payload.whatsapp_opt_in = body.whatsapp_opt_in;
    payload.repeat_business = body.repeat_business === true;
    for (const leg of ['pickup', 'delivery']) {
      const lat = body[`${leg}_lat`], lng = body[`${leg}_lng`];
      if (lat != null || lng != null) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return res.status(400).json({ error: 'Invalid location.' });
        payload[`${leg}_lat`] = lat; payload[`${leg}_lng`] = lng;
      }
    }
    try {
      // Resolve the public tenant rather than accepting an arbitrary organization_id.
      const { data: org, error: orgError } = await client.rpc('get_public_org', { p_slug: body.tenant_slug });
      if (orgError || !org?.id) return res.status(400).json({ error: 'Booking company unavailable.' });
      if (Array.isArray(org.settings?.regions) && org.settings.regions.length && regions.some((region: string) => !org.settings.regions.includes(region))) return res.status(400).json({ error: 'Choose a supported region.' });
      payload.organization_id = org.id;
      payload.tracking_id = `NK-${body.id.replace(/-/g, '').toUpperCase()}`;
      const { error } = await client.from('quote_requests').insert(payload);
      if (error) {
        // A retry after a lost response must not create another lead or notification.
        if (error.code === '23505') {
          const { data: existing } = await client.from('quote_requests').select(Object.keys(payload).join(',')).eq('id', payload.id).maybeSingle();
          if (existing && Object.keys(payload).every(key => (existing as any)[key] === payload[key])) return res.json({ id: payload.id, tracking_id: payload.tracking_id });
          return res.status(409).json({ error: 'This enquiry reference was already submitted. Contact dispatch to change it.' });
        }
        console.error('[quotes] Save failed', error.code);
        return res.status(503).json({ error: 'Your enquiry could not be saved. Please try again or call dispatch.' });
      }
      // Saving is authoritative. Notification failures never turn a saved lead into a failed form.
      void (deps.notify || notifySavedQuote)(payload).catch(() => console.error('[quotes] Saved enquiry; notification unavailable', payload.id));
      return res.status(201).json({ id: payload.id, tracking_id: payload.tracking_id });
    } catch {
      return res.status(503).json({ error: 'Your enquiry could not be saved. Please try again or call dispatch.' });
    }
  });
  return router;
}
