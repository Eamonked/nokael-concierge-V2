import React from 'react';
import { Globe, Loader2, Check, Copy, RefreshCw, AlertTriangle } from 'lucide-react';
import { getDomain, setDomain, removeDomain, type DomainState } from '../../../lib/onboarding';
import { customDomainProblem, cleanDomain } from '../../../lib/hosts';

/**
 * "Use your own domain" — shown in onboarding (Go live) and Settings.
 * The company adds one CNAME record; Cloudflare issues the certificate.
 * While pending it re-checks every 20 s so the owner sees it go live.
 */
export function DomainCard({ canEdit }: { canEdit: boolean }) {
  const [state, setState] = React.useState<DomainState | null>(null);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    getDomain().then(s => { setState(s); if (s.domain) setInput(s.domain); }).catch(err => setError(err.message));
  }, []);
  React.useEffect(refresh, [refresh]);

  React.useEffect(() => {
    if (state?.status !== 'pending') return;
    const id = window.setInterval(refresh, 20_000);
    return () => window.clearInterval(id);
  }, [state?.status, refresh]);

  const save = async () => {
    const problem = customDomainProblem(input);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      setState(await setDomain(cleanDomain(input)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Stop using this domain? Your booking page stays available on the Nokael link.')) return;
    setBusy(true);
    try {
      setState(await removeDomain());
      setInput('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!state) return <Loader2 className="animate-spin" size={18} />;
  const host = state.domain ? state.domain.split('.')[0] : 'book';

  return (
    <div className="onb-domain">
      <div className="onb-domain-row">
        <Globe size={16} />
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="book.yourcompany.com"
          disabled={!canEdit || busy}
          aria-label="Your domain"
        />
        {canEdit && (!state.domain || cleanDomain(input) !== state.domain) && (
          <button type="button" className="onb-secondary" onClick={save} disabled={busy || !input.trim()}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} Connect
          </button>
        )}
      </div>

      {state.domain && (
        <>
          <p className={`onb-domain-status is-${state.status}`}>
            {state.status === 'active' && <><Check size={14} /> Live — customers can use https://{state.domain}</>}
            {state.status === 'pending' && <><RefreshCw size={14} /> Waiting: {state.detail ?? 'add the DNS record below'}</>}
            {state.status === 'error' && <><AlertTriangle size={14} /> {state.detail ?? 'Cloudflare could not verify this domain'}</>}
          </p>
          {state.status !== 'active' && (
            <>
              <p className="onb-muted">Add this record where your domain's DNS is managed. It usually goes live within 30 minutes; the HTTPS certificate is set up for you.</p>
              <table className="cmp-table onb-dns">
                <thead><tr><th>Type</th><th>Name</th><th>Target</th><th /></tr></thead>
                <tbody>
                  <tr>
                    <td>CNAME</td>
                    <td><code>{host}</code></td>
                    <td><code>{state.cname_target}</code></td>
                    <td>
                      <button type="button" className="onb-link" aria-label="Copy target"
                        onClick={() => navigator.clipboard.writeText(state.cname_target).catch(() => undefined)}>
                        <Copy size={14} />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="onb-muted">If your DNS is on Cloudflare too, set the record to <b>DNS only</b> (grey cloud).</p>
            </>
          )}
          {canEdit && <button type="button" className="onb-link" onClick={remove} disabled={busy}>Remove domain</button>}
        </>
      )}
      {error && <p className="onb-error" role="alert">{error}</p>}
    </div>
  );
}
