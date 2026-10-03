import React from 'react';
import { Building2, Copy, Check, MessageSquare, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { COUNTRY_PRESETS, findCountry, slugify } from '../../../lib/countries';
import {
  listCompanies, createCompany, resendCompanyLink, updateCompany,
  type CompanyRow, type CreateCompanyResult,
} from '../../../lib/onboarding';

/**
 * Platform admins only (Settings → Companies). One form creates a company:
 * org + country profile + owner invite + a setup link to send by WhatsApp.
 * The owner then finishes setup themselves at /onboarding.
 */
export function CompaniesPanel() {
  const [companies, setCompanies] = React.useState<CompanyRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [created, setCreated] = React.useState<CreateCompanyResult | null>(null);
  const [links, setLinks] = React.useState<Record<string, string>>({});

  const [name, setName] = React.useState('');
  const [country, setCountry] = React.useState('');
  const [ownerEmail, setOwnerEmail] = React.useState('');
  const [ownerName, setOwnerName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [plan, setPlan] = React.useState<'trial' | 'standard' | 'enterprise'>('trial');

  const load = React.useCallback(() => {
    listCompanies().then(setCompanies).catch(err => setError(err.message));
  }, []);
  React.useEffect(load, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const result = await createCompany({
        name: name.trim(), country, owner_email: ownerEmail.trim(), owner_name: ownerName.trim() || undefined,
        slug: slug || undefined, plan,
      });
      setCreated(result);
      setName(''); setCountry(''); setOwnerEmail(''); setOwnerName(''); setSlug(''); setSlugTouched(false);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async (c: CompanyRow) => {
    setError(null);
    try {
      const r = await resendCompanyLink(c.id);
      if (r.setup_link) setLinks(prev => ({ ...prev, [c.id]: r.setup_link! }));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleActive = async (c: CompanyRow) => {
    setError(null);
    try {
      await updateCompany(c.id, { is_active: !c.is_active });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const preset = findCountry(country);

  return (
    <>
      <div className="settings-section-heading">
        <div>
          <h2>Companies</h2>
          <p>Companies using the platform. Create one and send the owner their setup link — they finish the rest.</p>
        </div>
      </div>

      <div className="settings-form-card">
        <div className="settings-section-heading">
          <div>
            <h3>Add a company</h3>
            <p>Country sets their currency, time zone, phone format and regions. They can change these during setup.</p>
          </div>
        </div>
        <form onSubmit={submit}>
          <div className="settings-form-grid">
            <label className="field">
              <span>Company name</span>
              <input required value={name} onChange={e => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} />
            </label>
            <label className="field">
              <span>Country</span>
              <select required value={country} onChange={e => setCountry(e.target.value)}>
                <option value="">Choose…</option>
                {COUNTRY_PRESETS.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Owner email</span>
              <input required type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>Owner name</span>
              <input value={ownerName} onChange={e => setOwnerName(e.target.value)} />
            </label>
            <label className="field">
              <span>Booking link</span>
              <input value={slug} onChange={e => { setSlugTouched(true); setSlug(slugify(e.target.value)); }} placeholder="acme-couriers" />
              <small>{window.location.origin}/c/{slug || '…'}</small>
            </label>
            <label className="field">
              <span>Plan</span>
              <select value={plan} onChange={e => setPlan(e.target.value as typeof plan)}>
                <option value="trial">Trial</option>
                <option value="standard">Standard</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </label>
          </div>
          {preset && (
            <p className="onb-muted" style={{ marginTop: 12 }}>
              {preset.name}: {preset.currency} · {preset.timezone} · {preset.dial_code} · {preset.tax_label} {preset.tax_rate}%
            </p>
          )}
          {error && <p className="onb-error" role="alert">{error}</p>}
          <div className="settings-form-footer">
            <button className="primary" type="submit" disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Building2 size={15} />} Create company & invite owner
            </button>
          </div>
        </form>

        {created && (
          <div className="settings-audit-note" style={{ marginTop: 16 }}>
            <Check size={16} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{created.company.name} is set up</b>
              <p>
                {created.owner.existing
                  ? `${created.owner.email} already had a login — they sign in as usual and land in setup.`
                  : `Invite emailed to ${created.owner.email}. You can also send them this link:`}
              </p>
              {created.setup_link && <LinkRow value={created.setup_link} share={`Your ${created.company.name} dashboard is ready. Set your password here: ${created.setup_link}`} />}
              <LinkRow value={created.public_url} label="Their booking page" />
            </div>
          </div>
        )}
      </div>

      <div className="settings-form-card">
        <div className="settings-section-heading">
          <div><h3>All companies</h3></div>
          <button type="button" className="outline-button" onClick={load}><RefreshCw size={14} /> Refresh</button>
        </div>
        {!companies ? (
          <Loader2 className="animate-spin" />
        ) : (
          <div className="cmp-table-wrap">
            <table className="cmp-table">
              <thead>
                <tr><th>Company</th><th>Country</th><th>Plan</th><th>Setup</th><th>Domain</th><th>Team</th><th /></tr>
              </thead>
              <tbody>
                {companies.map(c => (
                  <React.Fragment key={c.id}>
                    <tr>
                      <td>
                        <b>{c.name}</b>
                        <div><a href={c.public_url} target="_blank" rel="noopener noreferrer" className="onb-link">/c/{c.slug} <ExternalLink size={11} /></a></div>
                      </td>
                      <td>{c.country ?? '—'} {c.currency ? `· ${c.currency}` : ''}</td>
                      <td>{c.plan}{!c.is_active && ' · paused'}</td>
                      <td>
                        <span className={c.onboarding_completed_at ? 'cmp-badge is-live' : 'cmp-badge'}>
                          {c.onboarding_completed_at ? 'Live' : 'In setup'}
                        </span>
                      </td>
                      <td>
                        {c.custom_domain ? (
                          <>
                            <div>{c.custom_domain}</div>
                            <span className={c.custom_domain_status === 'active' ? 'cmp-badge is-live' : 'cmp-badge'}>{c.custom_domain_status ?? 'pending'}</span>
                            {c.custom_domain_status !== 'active' && (
                              <>
                                {' '}
                                <button type="button" className="onb-link" title="Use after adding the hostname in Cloudflare → SSL/TLS → Custom Hostnames"
                                  onClick={() => updateCompany(c.id, { custom_domain_status: 'active' }).then(load).catch(err => setError(err.message))}>
                                  Mark live
                                </button>
                              </>
                            )}
                          </>
                        ) : '—'}
                      </td>
                      <td>{c.members}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {c.plan !== 'internal' && (
                          <>
                            <button type="button" className="onb-link" onClick={() => resend(c)}>Setup link</button>
                            {' · '}
                            <button type="button" className="onb-link" onClick={() => toggleActive(c)}>{c.is_active ? 'Pause' : 'Resume'}</button>
                          </>
                        )}
                      </td>
                    </tr>
                    {links[c.id] && (
                      <tr><td colSpan={7}><LinkRow value={links[c.id]} share={`Set your ${c.name} dashboard password here: ${links[c.id]}`} /></td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function LinkRow({ value, label, share }: { value: string; label?: string; share?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="onb-copy" style={{ marginTop: 8 }}>
      {label && <span>{label}</span>}
      <div>
        <code>{value}</code>
        <button type="button" aria-label="Copy" onClick={() => navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => undefined)}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
        {share && <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer" aria-label="Send on WhatsApp"><MessageSquare size={15} /></a>}
      </div>
    </div>
  );
}
