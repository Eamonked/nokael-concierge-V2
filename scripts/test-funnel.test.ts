import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { createQuotesRouter } from '../routes/quotes.js';
import { createNotifyRouter } from '../routes/notify.js';
import { routeProblem, validFutureDate, validPhone } from '../shared/quoteValidation.js';
import { requestDeviceLocation } from '../src/lib/deviceLocation.js';
import type { AddressInfo } from 'node:net';

const orgId = '89412cf2-dd3a-447c-906a-e59aaa64926d';
test('location retries an unavailable precise fix with a network/cached fix', () => {
  const options: PositionOptions[] = [];
  let result = false;
  requestDeviceLocation({ getCurrentPosition(success, failure, option) {
    options.push(option!);
    if (options.length === 1) failure!({ code: 2 } as GeolocationPositionError);
    else success({ coords: { latitude: 25, longitude: 55 } } as GeolocationPosition);
  } }, () => { result = true; }, () => assert.fail('Fallback should succeed'));
  assert.equal(result, true);
  assert.equal(options[1].enableHighAccuracy, false);
});
test('location denial is reported without retrying or prompting again', () => {
  let calls = 0;
  requestDeviceLocation({ getCurrentPosition(_success, failure) { calls++; failure!({ code: 1 } as GeolocationPositionError); } }, () => assert.fail(), reason => assert.equal(reason, 'denied'));
  assert.equal(calls, 1);
});
function request(overrides: Record<string, unknown> = {}) {
  return { id: randomUUID(), tenant_slug: 'nokael', name: 'Test Customer', phone: '+971501234567', pickup_location: 'DIFC, Dubai', delivery_location: 'ADGM, Abu Dhabi', emirate: 'Dubai → Abu Dhabi', item_type: 'document', urgency: 'immediate', whatsapp_opt_in: false, ...overrides };
}

function database(fail = false) {
  const saved = new Map<string, any>();
  const client = {
    rpc: async () => ({ data: { id: orgId, settings: { regions: ['Dubai', 'Abu Dhabi'] } }, error: null }),
    from: () => ({
      insert: async (payload: any) => {
        if (fail) return { error: { code: 'TEST_FAILURE' } };
        if (saved.has(payload.id)) return { error: { code: '23505' } };
        saved.set(payload.id, payload); return { error: null };
      },
      select: () => ({ eq: (_field: string, id: string) => ({ maybeSingle: async () => ({ data: saved.get(id) }) }) }),
    }),
  };
  return { client: client as any, saved };
}

async function withServer(client: any, run: (post: (body: any) => Promise<Response>, notifications: any[]) => Promise<void>) {
  const notifications: any[] = [];
  const app = express(); app.use(express.json());
  app.use(createQuotesRouter({ client, notify: async payload => { notifications.push(payload); } }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/quotes`;
  try { await run(body => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), notifications); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}

test('explicit route contradictions and invalid contact/schedule values are rejected', () => {
  assert.equal(routeProblem('ADGM Abu Dhabi', 'Dubai'), true);
  assert.equal(routeProblem('DIFC', 'Abu Dhabi'), true);
  assert.equal(routeProblem('أبوظبي', 'Dubai'), true);
  assert.equal(routeProblem('DIFC, Dubai', 'Dubai'), false);
  assert.equal(routeProblem('Tower 12, Gate 3', 'Dubai'), false);
  assert.equal(validPhone('not a phone'), false);
  assert.equal(validPhone('+971 50 123 4567'), true);
  assert.equal(validFutureDate('2020-01-01T00:00:00Z'), false);
});

test('successful quote saves first, ignores injected privileged fields and notifies once on retry', async () => {
  const db = database();
  await withServer(db.client, async (post, notifications) => {
    const body = request({ status: 'completed', organization_id: randomUUID() });
    const response = await post(body); assert.equal(response.status, 201);
    const result = await response.json() as any;
    assert.equal(result.id, body.id);
    assert.equal(db.saved.get(body.id).status, 'pending');
    assert.equal(db.saved.get(body.id).organization_id, orgId);
    assert.equal(db.saved.get(body.id).whatsapp_opt_in, false);
    assert.equal(notifications.length, 1);
    assert.equal((await post(body)).status, 200);
    assert.equal((await post({ ...body, pickup_location: 'Downtown Dubai' })).status, 409);
    assert.equal(db.saved.size, 1); assert.equal(notifications.length, 1);
  });
});

test('failed persistence never reports success or sends a dispatcher alert', async () => {
  await withServer(database(true).client, async (post, notifications) => {
    assert.equal((await post(request())).status, 503);
    assert.equal(notifications.length, 0);
  });
});

test('missing server configuration fails closed', async () => {
  await withServer(null, async post => assert.equal((await post(request())).status, 503));
});

test('server rejects a contradictory route and scheduled request without a time', async () => {
  const db = database();
  await withServer(db.client, async post => {
    assert.equal((await post(request({ emirate: 'Dubai → Dubai' }))).status, 400);
    assert.equal((await post(request({ urgency: 'scheduled' }))).status, 400);
    assert.equal(db.saved.size, 0);
  });
});

test('scheduled request retains pickup time and deadline in saved instructions', async () => {
  const db = database();
  await withServer(db.client, async post => {
    const pickup_at = new Date(Date.now() + 86400000).toISOString();
    const deadline = new Date(Date.now() + 90000000).toISOString();
    const body = request({ urgency: 'scheduled', pickup_at, deadline });
    assert.equal((await post(body)).status, 201);
    assert.match(db.saved.get(body.id).notes, /Pickup \(UTC\):/);
    assert.ok(db.saved.get(body.id).notes.includes(deadline));
    assert.equal(db.saved.get(body.id).pickup_at, undefined);
  });
});

test('analytics queues one saved-lead event, keeps clicks separate and excludes personal data', () => {
  const source = readFileSync('src/lib/analytics.tsx', 'utf8');
  const code = transformSync(source, { loader: 'tsx', format: 'cjs' }).code;
  const values = new Map<string, string>();
  const sandbox: any = { exports: {}, module: { exports: {} }, window: { dataLayer: [] }, sessionStorage: { getItem: (k: string) => values.get(k), setItem: (k: string, v: string) => values.set(k, v) }, document: { title: 'Test' } };
  runInNewContext(code, sandbox);
  const analytics = sandbox.module.exports;
  analytics.trackSavedQuote('saved-lead-1'); analytics.trackSavedQuote('saved-lead-1');
  analytics.trackWhatsAppClick('test', { phone_number: 'PRIVATE' });
  analytics.trackFormSubmission({ email: 'PRIVATE' });
  const events = sandbox.window.dataLayer;
  assert.equal(events.filter((e: any) => e.event === 'generate_lead').length, 1);
  assert.equal(events.filter((e: any) => e.event === 'whatsapp_click').length, 1);
  assert.equal(events.filter((e: any) => e.event === 'sample_certificate_requested').length, 1);
  assert.ok(!JSON.stringify(events).includes('PRIVATE'));
});

test('a browser-shipped API key cannot authorize raw dispatcher messages', async () => {
  const app = express(); app.use(express.json()); app.use(createNotifyRouter());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/notify`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-nokael-key': 'public-browser-value' }, body: JSON.stringify({ message: 'test' }) });
    assert.ok([401, 503].includes(response.status));
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
