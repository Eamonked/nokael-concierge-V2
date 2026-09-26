import React from 'react';
import {
  User, Loader2, UserPlus, Search, MoreVertical, Pencil, Send, KeyRound, Ban, RotateCcw, Trash2, ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import {
  getTeamMembers, updateTeamMemberRole, removeTeamMember, resendTeamInvite, sendTeamPasswordReset,
  setTeamMemberDisabled,
  type OrgMember, type OrgRole, type MemberStatus, type TeamResult,
} from '../../lib/team';
import { getRoleMeta } from './constants';
import { InviteModal } from './modals/InviteModal';
import { EditMemberModal } from './modals/EditMemberModal';

const ROLE_RANK: OrgRole[] = ['viewer', 'operator', 'admin', 'owner'];
const rankOf = (role: OrgRole | null | undefined) => (role ? ROLE_RANK.indexOf(role) : -1);

// Initials from the name when we have one, otherwise from the email.
const getInitials = (member: Pick<OrgMember, 'email' | 'full_name'>): string => {
  if (member.full_name) {
    const parts = member.full_name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  const name = member.email.split('@')[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

// Avatar component matching the Dashboard UI design
const Avatar = ({ initials, tone }: { initials: string; tone: number }) => {
  const colors = [
    'bg-[#e57373] text-[#1a1a1a]',
    'bg-[#64b5f6] text-[#1a1a1a]',
    'bg-[#81c784] text-[#1a1a1a]',
    'bg-[#ffb74d] text-[#1a1a1a]',
    'bg-[#ba68c8] text-[#1a1a1a]',
    'bg-[#4dd0e1] text-[#1a1a1a]',
  ];
  return (
    <div className={cn('avatar', colors[tone % colors.length])}>
      {initials}
    </div>
  );
};

// plain-status: default dot is green; 'pending' amber; 'inactive' red.
const STATUS_CLASS: Record<MemberStatus, string> = { active: '', invited: 'pending', disabled: 'inactive' };

type StatusFilter = 'all' | MemberStatus;
type RoleFilter = 'all' | OrgRole;

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

export const TeamPanel = ({ orgId, currentRole }: { orgId: string | null; currentRole: OrgRole | null }) => {
  const { t } = useTranslation('dashboard');
  const ROLE_META = getRoleMeta(t);
  const [members, setMembers] = React.useState<OrgMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [showInvite, setShowInvite] = React.useState(false);
  const [editing, setEditing] = React.useState<OrgMember | null>(null);
  const [busyUserIds, setBusyUserIds] = React.useState<string[]>([]);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  // The table scrolls, so the row menu is position:fixed next to its button.
  const [menuPos, setMenuPos] = React.useState<React.CSSProperties>({});
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>('all');
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [bulkRole, setBulkRole] = React.useState<'' | OrgRole>('');
  const searchRef = React.useRef<HTMLInputElement>(null);

  const canManage = currentRole === 'owner' || currentRole === 'admin';
  // Mirrors the server: you can act on members whose role is not above yours, never on yourself.
  const canActOn = (m: OrgMember) => canManage && !m.is_self && rankOf(m.role) <= rankOf(currentRole);

  // Keyboard shortcut for search
  React.useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (
        event.key === "/" ||
        (event.metaKey && event.key.toLowerCase() === "k")
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  // Close the row menu on any outside click / Escape.
  React.useEffect(() => {
    if (!menuFor) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e instanceof MouseEvent && (e.target as HTMLElement).closest('.team-row-menu')) return;
      setMenuFor(null);
    };
    // A fixed-position menu would drift away from its row on scroll; just close it.
    const onScroll = () => setMenuFor(null);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [menuFor]);

  const loadMembers = React.useCallback(() => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    getTeamMembers()
      .then((list) => {
        setMembers(list);
        setSelected((sel) => sel.filter((id) => list.some((m) => m.user_id === id)));
      })
      .catch((err: any) => setError(err.message || t('team.loadFailed')))
      .finally(() => setLoading(false));
  }, [orgId, t]);

  React.useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice((n) => (n === message ? null : n)), 4000);
  };

  // Runs one action for one or many members, then reports and reloads.
  const runFor = async (
    targets: OrgMember[],
    action: (m: OrgMember) => Promise<TeamResult>,
    successMessage: (count: number) => string,
    reload = true,
  ) => {
    if (targets.length === 0) return;
    setError(null);
    setMenuFor(null);
    setBusyUserIds(targets.map((m) => m.user_id));
    const failures: string[] = [];
    for (const m of targets) {
      const result = await action(m);
      if (!result.ok) failures.push(`${m.full_name || m.email}: ${result.error}`);
    }
    setBusyUserIds([]);
    const done = targets.length - failures.length;
    if (done > 0) flash(successMessage(done));
    if (failures.length) setError(failures.join(' · '));
    if (reload && done > 0) loadMembers();
  };

  const handleRoleChange = (member: OrgMember, role: OrgRole) =>
    runFor([member], (m) => updateTeamMemberRole(m.user_id, role),
      () => t('team.toast.roleUpdated', { defaultValue: 'Role updated' }));

  const handleResend = (targets: OrgMember[]) =>
    runFor(targets, (m) => resendTeamInvite(m.user_id),
      (n) => t('team.toast.inviteResent', { count: n, defaultValue: 'Invite re-sent to {{count}} member(s)' }), false);

  const handleReset = (member: OrgMember) =>
    runFor([member], (m) => sendTeamPasswordReset(m.user_id),
      () => t('team.toast.resetSent', { email: member.email, defaultValue: 'Password reset link sent to {{email}}' }), false);

  const handleDisable = (targets: OrgMember[], disabled: boolean) => {
    if (disabled && !window.confirm(t('team.disableConfirm', {
      count: targets.length,
      defaultValue: 'Disable sign-in for {{count}} member(s)? They keep their role and can be re-enabled later.',
    }))) return;
    return runFor(targets, (m) => setTeamMemberDisabled(m.user_id, disabled),
      (n) => disabled
        ? t('team.toast.disabled', { count: n, defaultValue: '{{count}} member(s) disabled' })
        : t('team.toast.enabled', { count: n, defaultValue: '{{count}} member(s) re-enabled' }));
  };

  const handleRemove = (targets: OrgMember[]) => {
    const message = targets.length === 1
      ? t('team.removeConfirm', { email: targets[0].email })
      : t('team.removeManyConfirm', { count: targets.length, defaultValue: 'Remove {{count}} members from the team?' });
    if (!window.confirm(message)) return;
    return runFor(targets, (m) => removeTeamMember(m.user_id),
      (n) => t('team.toast.removed', { count: n, defaultValue: '{{count}} member(s) removed' }));
  };

  // Filter members
  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesSearch = !q || `${member.full_name ?? ''} ${member.email} ${member.user_id}`.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;
      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [members, search, statusFilter, roleFilter]);

  const stats = React.useMemo(() => ({
    total: members.length,
    active: members.filter((m) => m.status === 'active').length,
    invited: members.filter((m) => m.status === 'invited').length,
    disabled: members.filter((m) => m.status === 'disabled').length,
  }), [members]);

  const selectedMembers = members.filter((m) => selected.includes(m.user_id));
  const actionable = selectedMembers.filter(canActOn);

  const toggleRow = (id: string) =>
    setSelected((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );

  const exportCsv = (rows: OrgMember[]) => {
    const header = ['Name', 'Email', 'Role', 'Status', 'Last sign-in', '2FA', 'Added'];
    const lines = rows.map((m) => [
      m.full_name ?? '', m.email, m.role, m.status,
      m.last_sign_in_at ? new Date(m.last_sign_in_at).toISOString() : '',
      m.mfa_enabled ? 'yes' : 'no',
      new Date(m.created_at).toISOString(),
    ].map(csvCell).join(','));
    const blob = new Blob([[header.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nokael-team-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusLabel = (status: MemberStatus) => ({
    active: t('team.status.active', { defaultValue: 'Active' }),
    invited: t('team.status.invited', { defaultValue: 'Invited (pending)' }),
    disabled: t('team.status.disabled', { defaultValue: 'Disabled' }),
  })[status];

  const lastActive = (m: OrgMember) => {
    if (m.status === 'invited') {
      const since = m.invited_at ?? m.created_at;
      return t('team.lastActive.invited', {
        when: formatDistanceToNow(new Date(since), { addSuffix: true }),
        defaultValue: 'Invited {{when}}',
      });
    }
    if (!m.last_sign_in_at) return t('team.lastActive.never', { defaultValue: 'Never signed in' });
    return t('team.lastActive.active', {
      when: formatDistanceToNow(new Date(m.last_sign_in_at), { addSuffix: true }),
      defaultValue: 'Active {{when}}',
    });
  };

  if (!orgId) {
    return (
      <div className="empty-state">
        <span>
          <User size={24} />
        </span>
        <h2>{t('team.title')}</h2>
        <p>{t('team.resolvingOrg')}</p>
      </div>
    );
  }

  if (loading && members.length === 0) {
    return (
      <div className="empty-state">
        <span>
          <Loader2 size={24} className="animate-spin" />
        </span>
        <h2>Loading team...</h2>
        <p>Please wait while we fetch your team members.</p>
      </div>
    );
  }

  return (
    <div className="page-body enterprise-page">
      <div className="enterprise-actions">
        <div>
          <span className="record-count">
            {stats.total} members · {Object.keys(ROLE_META).length} role groups
          </span>
        </div>
        <div>
          <button className="outline-button" onClick={() => exportCsv(visible)} disabled={visible.length === 0}>
            Export CSV
          </button>
          {canManage && (
            <button className="dark-button" onClick={() => setShowInvite(true)}>
              <UserPlus size={14} />
              {t('team.invite')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="m-5 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs">
          {error}
        </div>
      )}
      {notice && (
        <div className="m-5 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-600 text-xs">
          {notice}
        </div>
      )}

      <div className="metric-filters">
        {([
          ['all', t('team.filters.totalMembers', { defaultValue: 'Total Members' }), stats.total, t('team.filters.acrossRoles', { defaultValue: 'Across all roles' })],
          ['active', t('team.filters.active', { defaultValue: 'Active' }), stats.active, t('team.filters.canSignIn', { defaultValue: 'Accepted and can sign in' })],
          ['invited', t('team.filters.pendingInvites', { defaultValue: 'Pending Invites' }), stats.invited, t('team.filters.awaitingAcceptance', { defaultValue: 'Awaiting acceptance' })],
          ['disabled', t('team.filters.disabled', { defaultValue: 'Disabled' }), stats.disabled, t('team.filters.signInBlocked', { defaultValue: 'Sign-in blocked' })],
        ] as [StatusFilter, string, number, string][]).map(([key, label, value, hint]) => (
          <button
            key={key}
            className={statusFilter === key ? "selected" : ""}
            onClick={() => setStatusFilter(key)}
          >
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </button>
        ))}
      </div>

      <div className="operations-card">
        <div className="operations-toolbar">
          <label className="enterprise-search">
            <Search size={15} />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('team.searchPlaceholder', { defaultValue: 'Search name, email, or ID...' })}
            />
            <kbd>⌘K</kbd>
          </label>
          <div className="enterprise-tabs">
            {([['all', 'All'], ['owner', 'Owners'], ['admin', 'Admins'], ['operator', 'Operators'], ['viewer', 'Viewers']] as [RoleFilter, string][]).map(([key, label]) => (
              <button
                key={key}
                className={roleFilter === key ? "selected" : ""}
                onClick={() => setRoleFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={`bulk-actions ${selected.length ? "visible" : ""}`}>
            <b>{selected.length} selected</b>
            {canManage && actionable.length > 0 && (
              <>
                <select
                  value={bulkRole}
                  onChange={(e) => {
                    const role = e.target.value as OrgRole;
                    setBulkRole('');
                    if (role) {
                      runFor(actionable, (m) => updateTeamMemberRole(m.user_id, role),
                        (n) => t('team.toast.rolesUpdated', { count: n, defaultValue: 'Role updated for {{count}} member(s)' }));
                    }
                  }}
                  aria-label="Change role"
                >
                  <option value="">Change role…</option>
                  {ROLE_RANK.slice().reverse().filter((r) => rankOf(r) <= rankOf(currentRole)).map((r) => (
                    <option key={r} value={r}>{ROLE_META[r].label}</option>
                  ))}
                </select>
                {actionable.some((m) => m.status === 'invited') && (
                  <button onClick={() => handleResend(actionable.filter((m) => m.status === 'invited'))}>Resend invites</button>
                )}
                {actionable.some((m) => m.status !== 'disabled') && (
                  <button onClick={() => handleDisable(actionable.filter((m) => m.status !== 'disabled'), true)}>Disable</button>
                )}
                <button onClick={() => handleRemove(actionable)}>Revoke access</button>
              </>
            )}
            <button onClick={() => exportCsv(selectedMembers)}>Export</button>
          </div>
        </div>

        <div className="enterprise-table team-table">
          <div className="enterprise-head team-grid">
            <input
              type="checkbox"
              checked={selected.length === visible.length && visible.length > 0}
              onChange={() =>
                setSelected(
                  selected.length === visible.length
                    ? []
                    : visible.map((item) => item.user_id),
                )
              }
            />
            <span>{t('team.table.user', { defaultValue: 'Team member' })}</span>
            <span>{t('team.table.role', { defaultValue: 'Role' })}</span>
            <span>{t('team.table.accessStatus', { defaultValue: 'Access status' })}</span>
            <span>{t('team.table.lastActive', { defaultValue: 'Last active / context' })}</span>
            <span>{t('team.table.actions', { defaultValue: 'Action' })}</span>
          </div>
          {visible.map((member, index) => {
            const busy = busyUserIds.includes(member.user_id);
            const manageable = canActOn(member);

            return (
              <div
                className={cn(
                  "enterprise-row team-grid",
                  selected.includes(member.user_id) && "checked"
                )}
                key={member.user_id}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(member.user_id)}
                  onChange={() => toggleRow(member.user_id)}
                />
                <span className="enterprise-profile">
                  <Avatar initials={getInitials(member)} tone={index} />
                  <span>
                    <b>
                      {member.full_name || member.email.split('@')[0]}
                      {member.is_self && <em className="neutral-badge" style={{ marginInlineStart: 6 }}>You</em>}
                    </b>
                    <small>{member.email}</small>
                  </span>
                </span>
                <span>
                  {manageable && !busy ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member, e.target.value as OrgRole)}
                      className="neutral-badge cursor-pointer"
                      style={{ padding: '3px 6px', fontSize: '9px' }}
                    >
                      {ROLE_RANK.slice().reverse().filter((r) => rankOf(r) <= rankOf(currentRole)).map((r) => (
                        <option key={r} value={r}>{t(`roles.${r}`)}</option>
                      ))}
                    </select>
                  ) : (
                    <em className="neutral-badge">{ROLE_META[member.role]?.label || member.role}</em>
                  )}
                </span>
                <span className={cn("plain-status", STATUS_CLASS[member.status])}>
                  <i />
                  {statusLabel(member.status)}
                </span>
                <span className="context-cell" title={`Added ${format(new Date(member.created_at), 'PP')}`}>
                  {lastActive(member)}
                  <span style={{ marginInlineStart: 8, display: 'inline-flex', alignItems: 'center', gap: 3, opacity: member.mfa_enabled ? 1 : 0.6 }}>
                    <ShieldCheck size={11} />
                    {member.mfa_enabled ? '2FA on' : 'No 2FA'}
                  </span>
                </span>
                <span className="jw-menu-wrap team-row-menu">
                  {busy ? (
                    <button className="overflow-button" disabled>
                      <Loader2 size={14} className="animate-spin" />
                    </button>
                  ) : manageable ? (
                    <button
                      className="overflow-button"
                      onClick={(e) => {
                        if (menuFor === member.user_id) { setMenuFor(null); return; }
                        const r = e.currentTarget.getBoundingClientRect();
                        const openUp = window.innerHeight - r.bottom < 300;
                        const rtl = document.documentElement.dir === 'rtl' || !!e.currentTarget.closest('[dir="rtl"]');
                        setMenuPos({
                          position: 'fixed',
                          insetInlineEnd: 'auto',
                          ...(openUp ? { top: 'auto', bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
                          ...(rtl ? { left: r.left } : { right: window.innerWidth - r.right }),
                        });
                        setMenuFor(member.user_id);
                      }}
                      aria-haspopup="menu"
                      aria-expanded={menuFor === member.user_id}
                      title="Member actions"
                    >
                      <MoreVertical size={14} />
                    </button>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                  {menuFor === member.user_id && (
                    <div className="jw-menu" role="menu" style={menuPos}>
                      <button role="menuitem" onClick={() => { setMenuFor(null); setEditing(member); }}>
                        <Pencil size={14} />
                        <span>Edit name &amp; role<small>Change display name or access level</small></span>
                      </button>
                      {member.status === 'invited' && (
                        <button role="menuitem" onClick={() => handleResend([member])}>
                          <Send size={14} />
                          <span>Resend invite<small>Email a fresh invite link</small></span>
                        </button>
                      )}
                      {member.status !== 'invited' && (
                        <button role="menuitem" onClick={() => handleReset(member)}>
                          <KeyRound size={14} />
                          <span>Reset password<small>Email them a reset link</small></span>
                        </button>
                      )}
                      {member.status === 'disabled' ? (
                        <button role="menuitem" onClick={() => handleDisable([member], false)}>
                          <RotateCcw size={14} />
                          <span>Re-enable access<small>Allow sign-in again</small></span>
                        </button>
                      ) : (
                        <button role="menuitem" onClick={() => handleDisable([member], true)}>
                          <Ban size={14} />
                          <span>Disable access<small>Block sign-in, keep their role</small></span>
                        </button>
                      )}
                      <button role="menuitem" className="danger" onClick={() => handleRemove([member])}>
                        <Trash2 size={14} />
                        <span>Remove from team<small>Revoke access to this organisation</small></span>
                      </button>
                    </div>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {visible.length === 0 && (
          <div className="empty-state">
            <span>
              <User size={24} />
            </span>
            <h2>{t('team.noMembers')}</h2>
            <p>
              {search
                ? t('team.noResults', { defaultValue: 'No members match your search.' })
                : t('team.noMembersDesc', { defaultValue: 'Add team members to get started.' })}
            </p>
          </div>
        )}
      </div>

      {showInvite && orgId && (
        <InviteModal
          orgId={orgId}
          currentRole={currentRole}
          onClose={() => setShowInvite(false)}
          onSuccess={(message) => {
            setShowInvite(false);
            flash(message);
            loadMembers();
          }}
        />
      )}

      {editing && (
        <EditMemberModal
          member={editing}
          currentRole={currentRole}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            flash(t('team.toast.memberUpdated', { defaultValue: 'Member updated' }));
            loadMembers();
          }}
        />
      )}
    </div>
  );
};
