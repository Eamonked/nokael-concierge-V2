import React from 'react';

// Nokael Dispatch as an installable app (PWA). The public website shares this
// origin and index.html, so the manifest and home-screen tags are added only
// when a staff page (dashboard, login) is open: the marketing site is never
// offered for install. The service worker (/push-sw.js) also delivers push.

const SW_URL = '/push-sw.js';
const MANIFEST_URL = '/dashboard.webmanifest';

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

function ensureTag<K extends 'link' | 'meta'>(tag: K, key: string, value: string, attrs: Record<string, string>) {
  const selector = tag === 'link' ? `link[rel="${key}"]` : `meta[name="${key}"]`;
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = document.createElement(tag);
    if (tag === 'link') el.setAttribute('rel', key); else el.setAttribute('name', key);
    document.head.appendChild(el);
  }
  el.setAttribute(tag === 'link' ? 'href' : 'content', value);
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
}

export const isStandalone = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);

export const isIOS = (): boolean =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

let started = false;

/** Make this page installable as Nokael Dispatch. Safe to call more than once. */
export function initDispatchPwa(): void {
  if (started || typeof document === 'undefined') return;
  started = true;

  ensureTag('link', 'manifest', MANIFEST_URL, {});
  ensureTag('link', 'apple-touch-icon', '/icons/apple-touch-icon.png', {});
  ensureTag('meta', 'apple-mobile-web-app-capable', 'yes', {});
  ensureTag('meta', 'mobile-web-app-capable', 'yes', {});
  ensureTag('meta', 'apple-mobile-web-app-title', 'Dispatch', {});
  ensureTag('meta', 'apple-mobile-web-app-status-bar-style', 'default', {});

  // Let the layout reach the screen edges in the installed app; the phone
  // layout pads itself with env(safe-area-inset-*).
  const viewport = document.head.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (viewport && !viewport.content.includes('viewport-fit')) viewport.content += ', viewport-fit=cover';

  installed = isStandalone();

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register(SW_URL, { scope: '/' }).catch(err => console.warn('[pwa] service worker', err));
  }
}

/** The browser bar / status bar colour, matched to the dashboard theme. */
export function setThemeColor(color: string): void {
  if (typeof document === 'undefined') return;
  document.head.querySelectorAll('meta[name="theme-color"]').forEach(el => el.remove());
  ensureTag('meta', 'theme-color', color, {});
}

export type InstallState = {
  /** Android / desktop Chrome and Edge: the browser's own install dialog is ready. */
  canPrompt: boolean;
  /** iPhone / iPad Safari: no dialog, the user adds it from the Share menu. */
  iosManual: boolean;
  installed: boolean;
  install: () => Promise<boolean>;
};

export function useInstallState(): InstallState {
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    listeners.add(force);
    return () => { listeners.delete(force); };
  }, []);
  return {
    canPrompt: !!deferredPrompt && !installed,
    iosManual: isIOS() && !installed && !isStandalone(),
    installed: installed || isStandalone(),
    install: async () => {
      if (!deferredPrompt) return false;
      const prompt = deferredPrompt;
      deferredPrompt = null;
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      notify();
      return outcome === 'accepted';
    },
  };
}
