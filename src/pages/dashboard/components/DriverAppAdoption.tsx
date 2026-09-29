import React from 'react';
import { Smartphone, ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../../lib/supabase';

type Phone = {
  driver_id: string;
  driver_name: string | null;
  device: string | null;
  platform: 'android' | 'web';
  version: string | null;
  last_seen_at: string;
};

type Stats = {
  downloads_total: number;
  downloads_7d: number;
  latest_download_version: string | null;
  phones: Phone[];
};

/**
 * Driver app adoption: APK downloads (counted by the portal server) and the
 * phones currently signed in, with the build each one runs
 * (dispatch_driver_app_stats).
 */
export function DriverAppAdoption({ orgId }: { orgId?: string | null }) {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!orgId || !supabase) return;
    supabase.rpc('dispatch_driver_app_stats', { p_org: orgId }).then(({ data, error }) => {
      if (!error && data) setStats(data as Stats);
    });
  }, [orgId]);

  if (!stats) return null;
  const android = stats.phones.filter(p => p.platform === 'android');
  const web = stats.phones.filter(p => p.platform === 'web');
  const latest = stats.latest_download_version;
  const onLatest = latest ? android.filter(p => p.version === latest).length : 0;

  // Android builds before 1.0.3 didn't report their version.
  const versionLabel = (p: Phone) =>
    p.version ?? (p.platform === 'android' ? '1.0.2 or older' : '—');

  return (
    <div className="driver-app-strip">
      <button className="driver-app-summary" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <Smartphone className="w-4 h-4" aria-hidden="true" />
        <b>Driver app</b>
        <span>{stats.downloads_total} downloads ({stats.downloads_7d} this week)</span>
        <span>{android.length} Android phone{android.length === 1 ? '' : 's'} signed in</span>
        {latest && <span>{onLatest} on latest ({latest})</span>}
        <span>{web.length} web</span>
        <ChevronDown className={`w-4 h-4 driver-app-chevron${open ? ' open' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="driver-app-table" role="table">
          <div role="row" className="driver-app-head">
            <span role="columnheader">Driver</span>
            <span role="columnheader">Device</span>
            <span role="columnheader">App</span>
            <span role="columnheader">Version</span>
            <span role="columnheader">Last seen</span>
          </div>
          {stats.phones.map(p => (
            <div role="row" key={`${p.driver_id}-${p.device}`}>
              <span role="cell">{p.driver_name || '—'}</span>
              <span role="cell" title={p.device ?? ''}>{p.device || '—'}</span>
              <span role="cell">{p.platform === 'android' ? 'Android' : 'Web'}</span>
              <span role="cell" className={latest && p.platform === 'android' && p.version !== latest ? 'driver-app-outdated' : undefined}>
                {versionLabel(p)}
              </span>
              <span role="cell">{formatDistanceToNow(new Date(p.last_seen_at), { addSuffix: true })}</span>
            </div>
          ))}
          {stats.phones.length === 0 && <p className="table-empty">No drivers are signed in on any device.</p>}
        </div>
      )}
    </div>
  );
}
