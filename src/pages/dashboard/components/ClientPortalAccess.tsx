import React from 'react';
import type { BusinessContact } from '../../../lib/supabase';
import {
  type ClientMember,
  getClientMembers,
  inviteClient,
  sendClientLink,
  removeClientAccess,
} from '../../../lib/clientAccess';

const STATUS_LABEL: Record<ClientMember['status'], string> = {
  active: 'Active',
  invited: 'Invite sent',
  disabled: 'Disabled',
};

const seenText = (m: ClientMember) => {
  if (m.status === 'invited') return 'Hasn’t set a password yet';
  if (!m.last_seen_at) return 'Not opened the portal yet';
  return `Last opened ${new Date(m.last_seen_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
};

/**
 * "Client portal access" section of the business drawer: who at this company
 * can sign in to coc.nokael.com/portal, and a one-step way to add someone.
 */
export const ClientPortalAccess: React.FC<{
  businessId: string;
  contacts: BusinessContact[];
  /** Change to force a reload (e.g. after a contact was invited elsewhere). */
  version?: number;
}> = ({ businessId, contacts, version = 0 }) => {
  const [members, setMembers] = React.useState<ClientMember[] | null>(null);
  const [portalUrl, setPortalUrl] = React.useState('https://coc.nokael.com/portal/');
  const [email, setEmail] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null); // email or user_id being worked on
  const [notice, setNotice] = React.useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await getClientMembers(businessId);
      setMembers(res.members);
      setPortalUrl(res.portal_url);
    } catch (err) {
      setMembers([]);
      setNotice({ tone: 'error', text: (err as Error).message });
    }
  }, [businessId]);

  React.useEffect(() => { load(); }, [load, version]);

  const hasAccess = (addr: string) =>
    !!members?.some((m) => m.email.toLowerCase() === addr.trim().toLowerCase());

  // Contacts on file with an email who can't sign in yet — one click each.
  const suggestions = contacts.filter((c) => c.email && !hasAccess(c.email));

  const grant = async (addr: string, name?: string | null) => {
    const clean = addr.trim();
    if (!clean) return;
    setBusy(clean);
    setNotice(null);
    try {
      const res = await inviteClient(businessId, clean, 'viewer', name ?? undefined);
      setNotice({
        tone: 'success',
        text: res.existing
          ? `${clean} already had a Nokael login. They can sign in at ${res.portal_url} with their current password.`
          : `Invite emailed to ${clean}. The link lets them set a password and opens their deliveries.`,
      });
      if (clean === email.trim()) setEmail('');
      await load();
    } catch (err) {
      setNotice({ tone: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const resend = async (m: ClientMember) => {
    setBusy(m.user_id);
    setNotice(null);
    try {
      const res = await sendClientLink(businessId, m.user_id);
      setNotice({
        tone: 'success',
        text: res.kind === 'invite' ? `New invite emailed to ${m.email}.` : `Password reset link emailed to ${m.email}.`,
      });
    } catch (err) {
      setNotice({ tone: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (m: ClientMember) => {
    if (!window.confirm(`Remove portal access for ${m.email}? They will no longer see this company's deliveries.`)) return;
    setBusy(m.user_id);
    setNotice(null);
    try {
      await removeClientAccess(businessId, m.user_id);
      await load();
    } catch (err) {
      setNotice({ tone: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setNotice({ tone: 'success', text: 'Portal link copied.' });
    } catch {
      window.prompt('Copy the portal link:', portalUrl);
    }
  };

  return (
    <div className="client-access">
      <div className="drawer-section-title">
        <div>
          <h3>Client portal access</h3>
          <p>People at this company who can track their deliveries online</p>
        </div>
        <button type="button" className="text-action" onClick={copyLink}>
          Copy portal link
        </button>
      </div>

      <form
        className="client-access-form"
        onSubmit={(e) => { e.preventDefault(); grant(email); }}
      >
        <input
          type="email"
          required
          placeholder="client@company.com"
          aria-label="Client email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="client-access-primary" disabled={!!busy || !email.trim()}>
          {busy && busy === email.trim() ? 'Sending…' : 'Give access'}
        </button>
      </form>

      {notice && (
        <p className={`client-access-notice ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="client-access-suggest">
          <span>From contacts:</span>
          {suggestions.map((c) => (
            <button
              type="button"
              key={c.id ?? c.email!}
              className="icon-action"
              disabled={!!busy}
              onClick={() => grant(c.email!, c.name)}
              title={`Give ${c.email} portal access`}
            >
              + {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="client-access-list">
        {members === null ? (
          <p className="client-access-empty">Loading…</p>
        ) : members.length === 0 ? (
          <p className="client-access-empty">Nobody at this company can sign in yet.</p>
        ) : (
          members.map((m) => (
            <div key={m.user_id}>
              <span>
                <b>{m.full_name || m.email}</b>
                <small>{m.full_name ? `${m.email} · ` : ''}{seenText(m)}</small>
              </span>
              <span className={`status-badge ${m.status === 'active' ? 'success' : 'warning'}`}>
                <span className="status-badge-dot" />
                {STATUS_LABEL[m.status]}
              </span>
              <button type="button" className="icon-action" disabled={!!busy} onClick={() => resend(m)}>
                {busy === m.user_id ? '…' : m.status === 'invited' ? 'Resend invite' : 'Send reset link'}
              </button>
              <button type="button" className="icon-action" disabled={!!busy} onClick={() => remove(m)}>
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
