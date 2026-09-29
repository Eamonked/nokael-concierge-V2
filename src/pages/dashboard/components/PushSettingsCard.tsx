import React from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  disableStaffPush,
  enableStaffPush,
  getPushState,
  needsHomeScreenInstall,
  showTestNotification,
  type PushState,
} from '../../../lib/push';

/**
 * Turns push notifications on or off for this browser. What gets sent (new
 * quotes, signups, critical alerts, job milestones) is decided on the server.
 */
export function PushSettingsCard({ orgId }: { orgId?: string | null }) {
  const { t } = useTranslation('dashboard');
  const [state, setState] = React.useState<PushState | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getPushState().then(setState).catch(() => setState('unsupported'));
  }, []);

  const toggle = async () => {
    if (!orgId || busy) return;
    setBusy(true);
    setError(null);
    try {
      setState(state === 'on' ? await disableStaffPush() : await enableStaffPush(orgId));
    } catch (err: any) {
      console.error('[push]', err);
      setError(t('settings.push.failed', { defaultValue: 'Couldn’t update push notifications. Try again.' }));
    } finally {
      setBusy(false);
    }
  };

  const status =
    state === 'on' ? t('settings.push.statusOn', { defaultValue: 'On for this browser.' })
    : state === 'denied' ? t('settings.push.statusDenied', { defaultValue: 'Blocked. Allow notifications for this site in your browser settings, then reload.' })
    : state === 'unsupported'
      ? needsHomeScreenInstall()
        ? t('settings.push.statusIos', { defaultValue: 'On iPhone or iPad, add the dashboard to your Home Screen (Share → Add to Home Screen), open it from there, then turn this on.' })
        : t('settings.push.statusUnsupported', { defaultValue: 'This browser doesn’t support push notifications.' })
    : t('settings.push.statusOff', { defaultValue: 'Off for this browser.' });

  return (
    <div className="settings-form-card">
      <div className="settings-section-heading">
        <div>
          <h3>{t('settings.push.title', { defaultValue: 'Push notifications on this device' })}</h3>
          <p>{t('settings.push.desc', { defaultValue: 'New quotes, driver and business signups, critical alerts, and job milestones, even when the dashboard is closed.' })}</p>
        </div>
      </div>
      <div className="push-settings-row">
        <BellRing className="w-4 h-4" aria-hidden="true" />
        <span role="status">{state == null ? '…' : status}</span>
        {state === 'on' && (
          <button
            type="button"
            className="outline-button"
            onClick={() => showTestNotification(
              t('settings.push.testTitle', { defaultValue: 'Nokael test' }),
              t('settings.push.testBody', { defaultValue: 'Push notifications work on this device.' }),
            )}
          >
            {t('settings.push.test', { defaultValue: 'Test on this device' })}
          </button>
        )}
        {(state === 'on' || state === 'off') && (
          <button type="button" className={state === 'on' ? 'outline-button' : 'dark-button'} onClick={toggle} disabled={busy || !orgId}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {state === 'on'
              ? t('settings.push.turnOff', { defaultValue: 'Turn off' })
              : t('settings.push.turnOn', { defaultValue: 'Turn on' })}
          </button>
        )}
      </div>
      {error && <p className="push-settings-error" role="alert">{error}</p>}
    </div>
  );
}
