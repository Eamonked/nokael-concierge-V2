import React from 'react';
import { Check, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase, type BusinessInquiry } from '../../../lib/supabase';
import { getActiveOrgId } from '../../../lib/tenant';
import './AccountPicker.css';

/**
 * Which business account a job belongs to. businessId is the only thing that
 * links a job to the client portal, POD reports and account billing;
 * companyName is kept as the free-text label for one-off jobs.
 */
export type AccountLink = { businessId: string | null; companyName: string };

const norm = (s: string) => s.trim().toLowerCase();

export const findAccountByName = (accounts: BusinessInquiry[] | undefined, name: string) =>
  (accounts || []).find(a => a.id && norm(a.company_name) === norm(name)) || null;

interface AccountPickerProps {
  accounts: BusinessInquiry[];
  value: AccountLink;
  onChange: (value: AccountLink) => void;
}

export const AccountPicker: React.FC<AccountPickerProps> = ({ accounts, value, onChange }) => {
  const { t } = useTranslation('dashboard');
  const listId = React.useId();
  const [created, setCreated] = React.useState<BusinessInquiry[]>([]);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [creating, setCreating] = React.useState(false);
  const [draft, setDraft] = React.useState({ company_name: '', contact_person: '', phone_whatsapp: '', email: '' });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const all = React.useMemo(
    () => [...created, ...accounts.filter(a => a.id && a.status !== 'archived' && !created.some(c => c.id === a.id))],
    [accounts, created],
  );
  const linked = value.businessId ? all.find(a => a.id === value.businessId) || null : null;
  const query = value.companyName;
  const q = norm(query);
  const exact = q ? all.find(a => norm(a.company_name) === q) : undefined;

  const matches = React.useMemo(() => {
    const list = q
      ? all.filter(a => norm(a.company_name).includes(q) || norm(a.corporate_code || '').includes(q))
      : all;
    return [...list]
      .sort((a, b) => Number(norm(b.company_name).startsWith(q)) - Number(norm(a.company_name).startsWith(q))
        || a.company_name.localeCompare(b.company_name))
      .slice(0, 8);
  }, [all, q]);

  type Option = { kind: 'account'; account: BusinessInquiry } | { kind: 'create' } | { kind: 'oneoff' };
  const options: Option[] = [
    ...matches.map(account => ({ kind: 'account' as const, account })),
    ...(q && !exact ? [{ kind: 'create' as const }] : []),
    ...(q && !linked ? [{ kind: 'oneoff' as const }] : []),
  ];

  const pick = (opt: Option) => {
    setOpen(false);
    if (opt.kind === 'account') {
      onChange({ businessId: opt.account.id!, companyName: opt.account.company_name });
    } else if (opt.kind === 'create') {
      setDraft({ company_name: query.trim(), contact_person: '', phone_whatsapp: '', email: '' });
      setError(null);
      setCreating(true);
    } else {
      onChange({ businessId: null, companyName: query });
    }
  };

  const onType = (text: string) => {
    // Typing an account's exact name still links it, as before; anything else unlinks.
    const match = findAccountByName(all, text);
    onChange({ businessId: match?.id || null, companyName: text });
    setOpen(true);
    setActive(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open && options[active]) { e.preventDefault(); pick(options[active]); } // never submit the job form from here
    else if (e.key === 'Escape') setOpen(false);
  };

  const createAccount = async () => {
    const d = {
      company_name: draft.company_name.trim(),
      contact_person: draft.contact_person.trim(),
      phone_whatsapp: draft.phone_whatsapp.trim(),
      email: draft.email.trim(),
    };
    if (!d.company_name || !d.contact_person || !d.phone_whatsapp) {
      setError(t('accountPicker.createRequired', { defaultValue: 'Company name, contact person and WhatsApp are required.' }));
      return;
    }
    if (findAccountByName(all, d.company_name)) {
      setError(t('accountPicker.createDuplicate', { defaultValue: 'An account with this name already exists. Pick it from the list instead.' }));
      return;
    }
    if (!supabase) return;
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('business_inquiries')
      .insert([{
        ...d,
        status: 'active',
        organization_id: getActiveOrgId(),
        corporate_code: `NOK-${Math.floor(1000 + Math.random() * 9000)}`,
      }])
      .select()
      .single();
    setSaving(false);
    if (err || !data) {
      setError(err?.message || t('accountPicker.createFailed', { defaultValue: 'Could not create the account.' }));
      return;
    }
    const account = data as BusinessInquiry;
    setCreated(prev => [account, ...prev]);
    onChange({ businessId: account.id!, companyName: account.company_name });
    setCreating(false);
  };

  // Enter inside the mini-form creates the account instead of submitting the whole job.
  const draftKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); void createAccount(); }
    if (e.key === 'Escape') setCreating(false);
  };
  const setD = (k: keyof typeof draft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="account-picker">
      <div className="account-picker-input">
      <input
        type="text"
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        value={query}
        onChange={e => onType(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={t('accountPicker.placeholder', { defaultValue: 'Search accounts or type a name' })}
        disabled={creating}
      />

      {open && !creating && options.length > 0 && (
        <ul className="account-picker-list" role="listbox" id={listId}>
          {options.map((opt, i) => (
            <li
              key={opt.kind === 'account' ? opt.account.id : opt.kind}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`${i === active ? 'active' : ''} ${opt.kind !== 'account' ? 'action' : ''}`}
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(opt)}
            >
              {opt.kind === 'account' && (
                <>
                  <b>{opt.account.company_name}</b>
                  <small>{[opt.account.contact_person, opt.account.corporate_code].filter(Boolean).join(', ')}</small>
                  {opt.account.id === value.businessId && <Check className="w-3.5 h-3.5" />}
                </>
              )}
              {opt.kind === 'create' && (
                <><Plus className="w-3.5 h-3.5" /><b>{t('accountPicker.createOption', { defaultValue: 'Create account “{{name}}”', name: query.trim() })}</b></>
              )}
              {opt.kind === 'oneoff' && (
                <b className="muted">{t('accountPicker.oneOffOption', { defaultValue: 'Use “{{name}}” as a one-off job', name: query.trim() })}</b>
              )}
            </li>
          ))}
        </ul>
      )}
      </div>

      {creating ? (
        <div className="account-picker-create" onKeyDown={draftKeyDown}>
          <p>{t('accountPicker.createTitle', { defaultValue: 'New business account. You can add billing details later in Business Accounts.' })}</p>
          <input value={draft.company_name} onChange={setD('company_name')} placeholder={t('accountPicker.companyName', { defaultValue: 'Company name' })} autoFocus />
          <input value={draft.contact_person} onChange={setD('contact_person')} placeholder={t('accountPicker.contactPerson', { defaultValue: 'Contact person' })} />
          <input type="tel" value={draft.phone_whatsapp} onChange={setD('phone_whatsapp')} placeholder={t('accountPicker.whatsapp', { defaultValue: 'WhatsApp number' })} />
          <input type="email" value={draft.email} onChange={setD('email')} placeholder={t('accountPicker.emailOptional', { defaultValue: 'Email (optional)' })} />
          {error && <span className="account-picker-error" role="alert">{error}</span>}
          <div className="account-picker-create-actions">
            <button type="button" className="outline-button" onClick={() => setCreating(false)} disabled={saving}>
              {t('accountPicker.cancel', { defaultValue: 'Cancel' })}
            </button>
            <button type="button" className="dark-button" onClick={createAccount} disabled={saving}>
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              {t('accountPicker.createAndLink', { defaultValue: 'Create and link' })}
            </button>
          </div>
        </div>
      ) : linked ? (
        <small className="account-picker-status linked">
          <Check className="w-3 h-3" />
          {t('accountPicker.linked', { defaultValue: 'Linked to {{name}}. Shows in their client portal and reports.', name: linked.company_name })}
        </small>
      ) : q ? (
        <small className="account-picker-status unlinked">
          <AlertTriangle className="w-3 h-3" />
          {t('accountPicker.unlinked', { defaultValue: 'One-off job. Not linked to an account, so the client won’t see it in their portal.' })}
        </small>
      ) : (
        <small className="account-picker-status">{t('accountPicker.empty', { defaultValue: 'Leave empty for individual customers.' })}</small>
      )}
    </div>
  );
};

/**
 * Campaign / client reference. Suggests the references this account already
 * uses so one campaign isn't split by a typo ("Oct VIP" vs "October VIP").
 */
export const ClientReferenceInput: React.FC<{ businessId: string | null; value: string; onChange: (v: string) => void }> = ({ businessId, value, onChange }) => {
  const { t } = useTranslation('dashboard');
  const listId = React.useId();
  const [refs, setRefs] = React.useState<string[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    if (!businessId || !supabase) { setRefs([]); return; }
    supabase
      .from('jobs')
      .select('client_reference')
      .eq('business_id', businessId)
      .not('client_reference', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setRefs([...new Set(data.map(r => (r as { client_reference: string }).client_reference).filter(Boolean))]);
      });
    return () => { cancelled = true; };
  }, [businessId]);

  const nearMiss = value.trim() && !refs.includes(value.trim())
    ? refs.find(r => norm(r) === norm(value)) // same words, different case/spacing
    : undefined;

  return (
    <>
      <input
        type="text"
        list={listId}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={t('accountPicker.referencePlaceholder', { defaultValue: 'e.g. October VIP invitations' })}
        disabled={!businessId}
      />
      <datalist id={listId}>{refs.map(r => <option key={r} value={r} />)}</datalist>
      <small>
        {!businessId
          ? t('accountPicker.referenceNeedsAccount', { defaultValue: 'Link an account first. The client filters their portal by this.' })
          : nearMiss
            ? <button type="button" className="account-picker-fix" onClick={() => onChange(nearMiss)}>{t('accountPicker.referenceUseExisting', { defaultValue: 'Use existing “{{ref}}”', ref: nearMiss })}</button>
            : t('accountPicker.referenceHint', { defaultValue: 'Groups jobs into a campaign in the client’s portal.' })}
      </small>
    </>
  );
};
