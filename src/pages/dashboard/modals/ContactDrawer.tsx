import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { type BusinessContact, addBusinessContact } from '../../../lib/supabase';
import { inviteClient } from '../../../lib/clientAccess';

const DEPARTMENTS = ['Operations', 'Finance', 'Management', 'Procurement', 'Logistics'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContactDrawerProps {
  businessId: string;
  companyName: string;
  onClose: () => void;
  /** invited = the contact was also given client portal access. */
  onSaved: (contact: BusinessContact, invited: boolean) => void;
}

/**
 * Secondary drawer that slides in over the business account drawer to add
 * one contact — all fields in a single form instead of a chain of prompts.
 */
export const ContactDrawer: React.FC<ContactDrawerProps> = ({ businessId, companyName, onClose, onSaved }) => {
  const [form, setForm] = React.useState({ name: '', role: '', department: '', phone: '', email: '' });
  const [giveAccess, setGiveAccess] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const nameRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const email = form.email.trim();
  const emailValid = EMAIL_RE.test(email);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError('Add their name.');
    if (!form.phone.trim() && !email) return setError('Add a phone number or email so the team can reach them.');
    if (email && !emailValid) return setError('That email address doesn’t look right.');

    setSaving(true);
    try {
      const contact = await addBusinessContact({
        business_id: businessId,
        name: form.name.trim(),
        role: form.role.trim() || null,
        department: form.department.trim() || null,
        phone: form.phone.trim() || null,
        email: email || null,
      });

      let invited = false;
      if (giveAccess && emailValid) {
        try {
          await inviteClient(businessId, email, 'viewer', form.name.trim());
          invited = true;
        } catch (err) {
          // The contact is saved; only the invite failed. Keep the drawer open to say so.
          onSaved(contact, false);
          setSaving(false);
          return setError(`Contact saved, but the portal invite failed: ${(err as Error).message}`);
        }
      }
      onSaved(contact, invited);
      onClose();
    } catch (err) {
      console.error('[Nokael] Error adding business contact:', err);
      setError((err as Error).message || 'Could not save the contact. Please try again.');
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <div className="modal-backdrop contact-drawer-backdrop" onClick={() => !saving && onClose()} />
      <form className="account-drawer contact-drawer" onSubmit={submit} aria-label="Add contact">
        <div className="drawer-header">
          <div>
            <div className="business-eyebrow">{companyName.toUpperCase()}</div>
            <h2>Add contact</h2>
          </div>
          <button type="button" className="drawer-close-button" onClick={onClose} aria-label="Close" disabled={saving}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="drawer-body contact-drawer-body">
          <label>
            Full name <span aria-hidden>*</span>
            <input ref={nameRef} required autoComplete="off" value={form.name} onChange={set('name')} placeholder="Sara Khan" />
          </label>

          <div className="contact-drawer-row">
            <label>
              Job title
              <input value={form.role} onChange={set('role')} placeholder="Operations Manager" />
            </label>
            <label>
              Department
              <input list="contact-departments" value={form.department} onChange={set('department')} placeholder="Operations" />
              <datalist id="contact-departments">
                {DEPARTMENTS.map((d) => <option key={d} value={d} />)}
              </datalist>
            </label>
          </div>

          <label>
            Phone
            <input type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="+971 50 123 4567" />
          </label>

          <label>
            Email
            <input type="email" value={form.email} onChange={set('email')} placeholder="sara@company.com" />
          </label>

          <label className={`contact-drawer-check${emailValid ? '' : ' disabled'}`}>
            <input
              type="checkbox"
              checked={giveAccess && emailValid}
              disabled={!emailValid}
              onChange={(e) => setGiveAccess(e.target.checked)}
            />
            <span>
              <b>Give client portal access</b>
              <small>
                {emailValid
                  ? `Emails ${email} an invite to track ${companyName}’s deliveries online.`
                  : 'Add an email address to invite them to the client portal.'}
              </small>
            </span>
          </label>

          {error && <p className="client-access-notice error" role="alert">{error}</p>}
        </div>

        <div className="contact-drawer-footer">
          <button type="button" className="icon-action" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="client-access-primary" disabled={saving}>
            {saving ? 'Saving…' : giveAccess && emailValid ? 'Save and send invite' : 'Save contact'}
          </button>
        </div>
      </form>
    </>,
    document.body
  );
};
