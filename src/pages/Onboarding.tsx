import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Palette, Tag, Users, Truck, Rocket, Check, Copy, Loader2, ArrowLeft, ArrowRight, MessageSquare, KeyRound, ExternalLink,
} from 'lucide-react';
import { supabase, getSafeSession } from '../lib/supabase';
import { COUNTRY_PRESETS, findCountry } from '../lib/countries';
import { inviteTeamMember, type OrgRole } from '../lib/team';
import { getOnboardingMe, type OnboardingMe } from '../lib/onboarding';
import { DomainCard } from './dashboard/components/DomainCard';
import { normalizeTenant, setActiveTenant, formatMoney, type TenantProfile } from '../lib/tenant';

// ==========================================
// Company onboarding wizard (/onboarding)
// ==========================================
// Where a new company's owner lands after setting their password. Six short
// steps, each saved as it's completed (organizations.settings.onboarding.step),
// so closing the tab and coming back resumes where they left off. Only the
// first step has required fields; everything else can be skipped and done
// later from Settings.

const DRIVER_APP_URL = import.meta.env.VITE_DRIVER_APP_URL || 'https://coc.nokael.com/android';

const STEPS = [
  { key: 'company', title: 'Company', icon: Building2 },
  { key: 'brand', title: 'Brand', icon: Palette },
  { key: 'pricing', title: 'Pricing', icon: Tag },
  { key: 'team', title: 'Team', icon: Users },
  { key: 'drivers', title: 'Drivers', icon: Truck },
  { key: 'live', title: 'Go live', icon: Rocket },
] as const;

type MeResponse = OnboardingMe;

const linesToList = (text: string) => text.split(/[\n,]/).map(s => s.trim()).filter(Boolean);

export default function Onboarding() {
  const navigate = useNavigate();
  const [me, setMe] = React.useState<MeResponse | null>(null);
  const [tenant, setTenant] = React.useState<TenantProfile | null>(null);
  const [step, setStep] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Step 1 — company
  const [name, setName] = React.useState('');
  const [country, setCountry] = React.useState('');
  const [currency, setCurrency] = React.useState('');
  const [timezone, setTimezone] = React.useState('');
  const [dialCode, setDialCode] = React.useState('');
  const [regionLabel, setRegionLabel] = React.useState('');
  const [regions, setRegions] = React.useState('');
  const [taxLabel, setTaxLabel] = React.useState('');
  const [taxRate, setTaxRate] = React.useState('');
  const [refPrefix, setRefPrefix] = React.useState('');
  const [supportPhone, setSupportPhone] = React.useState('');
  const [whatsapp, setWhatsapp] = React.useState('');
  const [supportEmail, setSupportEmail] = React.useState('');
  // Step 2 — brand
  const [displayName, setDisplayName] = React.useState('');
  const [logoUrl, setLogoUrl] = React.useState('');
  const [color, setColor] = React.useState('#00E08A');
  // Step 3 — pricing
  const [priceSameDay, setPriceSameDay] = React.useState('');
  const [priceDedicated, setPriceDedicated] = React.useState('');
  // Step 4 — team
  const [invites, setInvites] = React.useState([{ email: '', role: 'operator' as OrgRole }]);
  const [invited, setInvited] = React.useState<string[]>([]);
  // Step 6 — API key
  const [apiKey, setApiKey] = React.useState<string | null>(null);

  const hydrate = React.useCallback((data: MeResponse) => {
    const s = data.org.settings ?? {};
    const b = data.org.branding ?? {};
    setMe(data);
    const t = normalizeTenant(data.org);
    setTenant(t);
    setActiveTenant(t);
    setName(data.org.name ?? '');
    setCountry(s.country ?? '');
    setCurrency(s.currency ?? '');
    setTimezone(s.timezone ?? '');
    setDialCode(s.dial_code ?? '');
    setRegionLabel(s.region_label ?? '');
    setRegions((s.regions ?? []).join('\n'));
    setTaxLabel(s.tax_label ?? '');
    setTaxRate(s.tax_rate != null ? String(s.tax_rate) : '');
    setRefPrefix(s.job_ref_prefix ?? '');
    setSupportPhone(b.support_phone ?? '');
    setWhatsapp(b.whatsapp ?? '');
    setSupportEmail(b.support_email ?? '');
    setDisplayName(b.display_name ?? data.org.name ?? '');
    setLogoUrl(b.logo_url ?? '');
    setColor(b.primary_color ?? '#00E08A');
    setPriceSameDay(s.price_same_day != null ? String(s.price_same_day) : '');
    setPriceDedicated(s.price_dedicated != null ? String(s.price_dedicated) : '');
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabase) return setLoadError('Supabase is not configured.');
      const session = await getSafeSession().catch(() => null);
      if (!session) return navigate('/login');
      try {
        const data = await getOnboardingMe();
        if (!alive) return;
        if (data.role !== 'owner' && data.role !== 'admin') return navigate('/dashboard');
        hydrate(data);
        const saved = Number(data.org.settings?.onboarding?.step ?? 1);
        setStep(Math.min(Math.max(saved - 1, 0), STEPS.length - 1));
      } catch (err: any) {
        if (alive) setLoadError(err.message);
      }
    })();
    return () => { alive = false; };
  }, [navigate, hydrate]);

  const applyCountry = (code: string) => {
    setCountry(code);
    const p = findCountry(code);
    if (!p) return;
    setCurrency(p.currency);
    setTimezone(p.timezone);
    setDialCode(p.dial_code);
    setRegionLabel(p.region_label);
    setRegions(p.regions.join('\n'));
    setTaxLabel(p.tax_label);
    setTaxRate(String(p.tax_rate));
  };

  const save = async (settings: Record<string, unknown>, branding: Record<string, unknown> = {}, nextStep = step + 1) => {
    if (!me || !supabase) return false;
    setSaving(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('update_org_profile', {
      p_org: me.org.id,
      p_name: name.trim() || null,
      p_settings: { ...settings, onboarding: { ...((settings.onboarding as object) ?? {}), step: nextStep + 1 } },
      p_branding: branding,
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return false;
    }
    const t = normalizeTenant(data);
    setTenant(t);
    setActiveTenant(t);
    setMe(prev => (prev ? { ...prev, org: { ...prev.org, ...(data as any) } } : prev));
    return true;
  };

  const next = async () => {
    const key = STEPS[step].key;
    let ok = true;
    if (key === 'company') {
      if (!name.trim() || !country || !currency || !timezone) return setError('Company name, country, currency and time zone are required.');
      if (!supportPhone.trim() && !whatsapp.trim()) return setError('Add a phone or WhatsApp number — customers see it on your booking and tracking pages.');
      const preset = findCountry(country);
      ok = await save({
        country, currency: currency.toUpperCase(), timezone, dial_code: dialCode,
        locale: preset?.locale ?? 'en',
        map_center: preset?.map_center,
        region_label: regionLabel || 'Region',
        regions: linesToList(regions),
        tax_label: taxLabel, tax_rate: Number(taxRate) || 0,
        job_ref_prefix: refPrefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || undefined,
      }, {
        support_phone: supportPhone.trim(), whatsapp: whatsapp.replace(/\D/g, ''), support_email: supportEmail.trim(),
      });
    } else if (key === 'brand') {
      ok = await save({}, { display_name: displayName.trim() || name.trim(), logo_url: logoUrl.trim(), primary_color: color });
    } else if (key === 'pricing') {
      ok = await save({
        price_same_day: priceSameDay ? Number(priceSameDay) : null,
        price_dedicated: priceDedicated ? Number(priceDedicated) : null,
      });
    } else if (key === 'team') {
      const pending = invites.filter(i => i.email.trim() && !invited.includes(i.email.trim().toLowerCase()));
      for (const inv of pending) {
        const r = await inviteTeamMember(inv.email.trim(), inv.role);
        if (!r.ok) return setError(`${inv.email}: ${r.error}`);
        setInvited(prev => [...prev, inv.email.trim().toLowerCase()]);
      }
      ok = await save({});
    } else if (key === 'drivers') {
      ok = await save({});
    }
    if (ok) setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const finish = async () => {
    if (await save({ onboarding: { completed_at: new Date().toISOString() } }, {}, STEPS.length - 1)) navigate('/dashboard');
  };

  const createKey = async () => {
    if (!me || !supabase) return;
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('issue_api_key', { p_org: me.org.id, p_label: 'Onboarding' });
    if (rpcError) return setError(rpcError.message);
    setApiKey((data as any)?.key ?? null);
  };

  if (loadError) {
    return <div className="onb-shell"><div className="onb-card"><h1>Can’t open setup</h1><p className="onb-muted">{loadError}</p></div></div>;
  }
  if (!me || !tenant) {
    return <div className="onb-shell"><Loader2 className="animate-spin" /></div>;
  }

  const publicUrl = me.publicUrl;
  const current = STEPS[step];
  const preset = findCountry(country);

  return (
    <div className="onb-shell">
      <div className="onb-frame">
        <header className="onb-head">
          <div>
            <small>Setting up</small>
            <h1>{displayName || name}</h1>
          </div>
          <button
            type="button"
            className="onb-link"
            onClick={() => {
              // Lets the dashboard open this session instead of bouncing back here.
              try { sessionStorage.setItem('nk_onboarding_skipped', me.org.id); } catch { /* storage blocked */ }
              navigate('/dashboard');
            }}
          >
            Finish later
          </button>
        </header>

        <ol className="onb-steps" aria-label="Setup steps">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.key} className={i === step ? 'is-current' : i < step ? 'is-done' : ''}>
                <button type="button" onClick={() => i < step && setStep(i)} disabled={i > step}>
                  <span>{i < step ? <Check size={14} /> : <Icon size={14} />}</span>
                  {s.title}
                </button>
              </li>
            );
          })}
        </ol>

        <section className="onb-card">
          {current.key === 'company' && (
            <>
              <h2>Your company</h2>
              <p className="onb-muted">Pick your country and we fill in currency, time zone, phone format and regions. Change anything that doesn't fit.</p>
              <div className="onb-grid">
                <Field label="Company name *"><input value={name} onChange={e => setName(e.target.value)} /></Field>
                <Field label="Country *">
                  <select value={country} onChange={e => applyCountry(e.target.value)}>
                    <option value="">Choose…</option>
                    {COUNTRY_PRESETS.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Currency *"><input value={currency} maxLength={3} onChange={e => setCurrency(e.target.value.toUpperCase())} placeholder="GBP" /></Field>
                <Field label="Time zone *"><input value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="Europe/London" /></Field>
                <Field label="Phone country code"><input value={dialCode} onChange={e => setDialCode(e.target.value)} placeholder="+44" /></Field>
                <Field label="Job reference prefix" hint={`Jobs will read ${(refPrefix || 'ABC').toUpperCase()}-0001`}>
                  <input value={refPrefix} maxLength={5} onChange={e => setRefPrefix(e.target.value.toUpperCase())} />
                </Field>
                <Field label="Tax name"><input value={taxLabel} onChange={e => setTaxLabel(e.target.value)} placeholder="VAT" /></Field>
                <Field label="Tax rate (%)"><input value={taxRate} inputMode="decimal" onChange={e => setTaxRate(e.target.value)} /></Field>
                <Field label="What do you call an area?" hint="Shown as the label on pickup and delivery"><input value={regionLabel} onChange={e => setRegionLabel(e.target.value)} placeholder="City, State, County…" /></Field>
                <Field label={`${regionLabel || 'Region'}s you cover`} hint="One per line. Leave empty to let customers type it." wide>
                  <textarea rows={4} value={regions} onChange={e => setRegions(e.target.value)} />
                </Field>
              </div>
              <h3>How customers reach you</h3>
              <div className="onb-grid">
                <Field label="Support phone"><input value={supportPhone} onChange={e => setSupportPhone(e.target.value)} placeholder={`${dialCode || '+'} …`} /></Field>
                <Field label="WhatsApp number" hint="Digits with country code"><input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder={dialCode.replace('+', '') || '44…'} /></Field>
                <Field label="Support email"><input type="email" value={supportEmail} onChange={e => setSupportEmail(e.target.value)} /></Field>
              </div>
            </>
          )}

          {current.key === 'brand' && (
            <>
              <h2>Your brand</h2>
              <p className="onb-muted">Customers see this on your booking page, tracking links and delivery receipts.</p>
              <div className="onb-grid">
                <Field label="Name customers see"><input value={displayName} onChange={e => setDisplayName(e.target.value)} /></Field>
                <Field label="Brand colour">
                  <div className="onb-color"><input type="color" value={color} onChange={e => setColor(e.target.value)} /><input value={color} onChange={e => setColor(e.target.value)} /></div>
                </Field>
                <Field label="Logo URL" hint="A square PNG or SVG works best" wide><input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" /></Field>
              </div>
              <div className="onb-preview" style={{ ['--brand' as any]: color }}>
                {logoUrl ? <img src={logoUrl} alt="" referrerPolicy="no-referrer" /> : <span>{(displayName || name).slice(0, 1).toUpperCase()}</span>}
                <b>{displayName || name}</b>
                <em>Book</em>
              </div>
            </>
          )}

          {current.key === 'pricing' && (
            <>
              <h2>Starting prices <small>(optional)</small></h2>
              <p className="onb-muted">Shown as “from” prices on your booking form. Leave empty to quote every job yourself — you always set the final price per job.</p>
              <div className="onb-grid">
                <Field label={`Same-day (${currency})`}><input inputMode="decimal" value={priceSameDay} onChange={e => setPriceSameDay(e.target.value)} /></Field>
                <Field label={`Dedicated vehicle (${currency})`}><input inputMode="decimal" value={priceDedicated} onChange={e => setPriceDedicated(e.target.value)} /></Field>
              </div>
              {priceSameDay && <p className="onb-muted">Customers will see: <b>from {formatMoney(Number(priceSameDay), { currency, tenant })}</b></p>}
            </>
          )}

          {current.key === 'team' && (
            <>
              <h2>Invite your team</h2>
              <p className="onb-muted">Dispatchers get an email to set a password. You can add more people any time from Settings → Team.</p>
              {invites.map((inv, i) => (
                <div key={i} className="onb-invite">
                  <input type="email" placeholder="name@company.com" value={inv.email}
                    onChange={e => setInvites(list => list.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
                  <select value={inv.role} onChange={e => setInvites(list => list.map((x, j) => (j === i ? { ...x, role: e.target.value as OrgRole } : x)))}>
                    <option value="admin">Admin</option>
                    <option value="operator">Dispatcher</option>
                    <option value="viewer">View only</option>
                  </select>
                  {invited.includes(inv.email.trim().toLowerCase()) && <Check className="onb-ok" size={18} />}
                </div>
              ))}
              <button type="button" className="onb-link" onClick={() => setInvites(list => [...list, { email: '', role: 'operator' }])}>+ Add another</button>
            </>
          )}

          {current.key === 'drivers' && (
            <>
              <h2>Bring your drivers</h2>
              <p className="onb-muted">Send drivers these two links. Applications arrive in your dashboard under Drivers for you to approve; approved drivers sign in to the app with their phone number.</p>
              <CopyRow label="Driver sign-up form" value={`${publicUrl}/apply-driver`} share={`Apply to drive with ${displayName || name}: ${publicUrl}/apply-driver`} />
              <CopyRow label="Driver app (Android)" value={DRIVER_APP_URL} share={`Install the ${displayName || name} driver app: ${DRIVER_APP_URL}`} />
              <p className="onb-muted">Already have a driver list? Add them from Drivers → Add driver in the dashboard.</p>
            </>
          )}

          {current.key === 'live' && (
            <>
              <h2>You're ready to take bookings</h2>
              <p className="onb-muted">Share your booking page, or put the button on your own website.</p>
              <CopyRow label="Booking page" value={publicUrl} share={`Book a delivery with ${displayName || name}: ${publicUrl}`} open />
              <CopyRow label="Tracking page" value={`${publicUrl}/track`} />
              <CopyRow label="Button for your website" value={`<a href="${publicUrl}/get-quote" style="background:${color};color:#111;padding:12px 20px;border-radius:10px;font-weight:600;text-decoration:none">Book a delivery</a>`} />
              <h3>Use your own domain <small>(optional)</small></h3>
              <p className="onb-muted">Put your booking and tracking pages on an address like <code>book.{(displayName || name).toLowerCase().replace(/[^a-z0-9]+/g, '') || 'yourcompany'}.com</code>. You can also do this later from Settings.</p>
              <DomainCard canEdit />
              <h3>Connect your own systems <small>(optional)</small></h3>
              <p className="onb-muted">An API key lets your website or ERP create jobs directly (<code>POST /api/pool/jobs</code>, header <code>x-nokael-pool-key</code>).</p>
              {apiKey ? (
                <>
                  <CopyRow label="API key — copy it now, it won't be shown again" value={apiKey} />
                </>
              ) : (
                <button type="button" className="onb-secondary" onClick={createKey}><KeyRound size={16} /> Create API key</button>
              )}
              <ul className="onb-summary">
                <li><Check size={14} /> {preset?.name ?? country} · {currency} · {timezone}</li>
                <li><Check size={14} /> Jobs numbered {(refPrefix || tenant.settings.job_ref_prefix)}-0001 onwards</li>
                {invited.length > 0 && <li><Check size={14} /> {invited.length} teammate{invited.length > 1 ? 's' : ''} invited</li>}
              </ul>
            </>
          )}

          {error && <p className="onb-error" role="alert">{error}</p>}

          <footer className="onb-actions">
            {step > 0 ? (
              <button type="button" className="onb-secondary" onClick={() => setStep(s => s - 1)} disabled={saving}><ArrowLeft size={16} /> Back</button>
            ) : <span />}
            {current.key === 'live' ? (
              <button type="button" className="onb-primary" onClick={finish} disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />} Open my dashboard
              </button>
            ) : (
              <button type="button" className="onb-primary" onClick={next} disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                {['pricing', 'team', 'drivers'].includes(current.key) ? 'Save & continue' : 'Continue'} <ArrowRight size={16} />
              </button>
            )}
          </footer>
        </section>
      </div>
    </div>
  );
}

function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={wide ? 'onb-field is-wide' : 'onb-field'}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function CopyRow({ label, value, share, open }: { label: string; value: string; share?: string; open?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — the value is still selectable */ }
  };
  return (
    <div className="onb-copy">
      <span>{label}</span>
      <div>
        <code>{value}</code>
        <button type="button" onClick={copy} aria-label={`Copy ${label}`}>{copied ? <Check size={15} /> : <Copy size={15} />}</button>
        {share && (
          <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"><MessageSquare size={15} /></a>
        )}
        {open && <a href={value} target="_blank" rel="noopener noreferrer" aria-label="Open"><ExternalLink size={15} /></a>}
      </div>
    </div>
  );
}
