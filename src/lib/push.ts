import { supabase } from './supabase';

// Web Push for the dispatch dashboard. Notifications are queued by database
// triggers and delivered by the push-dispatch Edge Function; this file only
// registers (or removes) this browser as a staff device for an organisation.

/** VAPID public key (the private half lives in Supabase Vault). Safe to ship. */
export const VAPID_PUBLIC_KEY = 'BA1nn2YRPAoidJowKNHKYhv1a7o7IaI8fVDdraQrhryI75qMynwJmA8gkLPEPbCO3oPm7eEQk6rrw-ZjF8jg2MM';

const SW_URL = '/push-sw.js';

export type PushState = 'unsupported' | 'denied' | 'off' | 'on';

export const pushSupported = (): boolean =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** iPhone/iPad Safari only allows web push from a site added to the Home Screen. */
export const needsHomeScreenInstall = (): boolean =>
  typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !window.matchMedia?.('(display-mode: standalone)').matches;

function keyBytes(base64url: string): Uint8Array {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.permission === 'granted' && (await currentSubscription()) ? 'on' : 'off';
}

async function register(orgId: string, sub: PushSubscription): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const keys = sub.toJSON().keys ?? {};
  const { data, error } = await supabase.rpc('staff_push_subscribe', {
    p_org: orgId,
    p_endpoint: sub.endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'subscribe_failed');
}

/** Ask for permission (must run from a click), subscribe this browser, and register it. */
export async function enableStaffPush(orgId: string): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const reg = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  await register(orgId, sub);
  return 'on';
}

export async function disableStaffPush(): Promise<PushState> {
  const sub = await currentSubscription();
  if (sub) {
    await supabase?.rpc('push_unsubscribe', { p_endpoint: sub.endpoint, p_audience: 'staff' });
    await sub.unsubscribe();
  }
  return pushSupported() ? 'off' : 'unsupported';
}

/**
 * On each dashboard visit: if this browser already has push on, register it
 * again (keeps it current after a sign-in or org change). Never prompts.
 */
export async function syncStaffPush(orgId: string): Promise<void> {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return;
    const sub = await currentSubscription();
    if (sub) await register(orgId, sub);
  } catch (err) {
    console.warn('[push] sync failed', err);
  }
}

/** Show a local notification through the service worker, to check this device displays them. */
export async function showTestNotification(title: string, body: string): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  await reg?.showNotification(title, { body, tag: 'nokael-test', icon: '/logo.png' });
}
