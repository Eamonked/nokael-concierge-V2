import React from 'react';
import { Trash2, User, Loader2, UserPlus, Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import {
  getTeamMembers, updateTeamMemberRole, removeTeamMember,
  type OrgMember, type OrgRole
} from '../../lib/team';
import { getRoleMeta } from './constants';
import { InviteModal } from './modals/InviteModal';

export const TeamPanel = ({ orgId, currentRole }: { orgId: string | null; currentRole: OrgRole | null }) => {
  const { t } = useTranslation('dashboard');
  const ROLE_META = getRoleMeta(t);
  const [members, setMembers] = React.useState<OrgMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showInvite, setShowInvite] = React.useState(false);
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null);

  const canManage = currentRole === 'owner' || currentRole === 'admin';

  const loadMembers = React.useCallback(() => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    getTeamMembers()
      .then(setMembers)
      .catch((err: any) => setError(err.message || t('team.loadFailed')))
      .finally(() => setLoading(false));
  }, [orgId]);

  React.useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRoleChange = async (userId: string, role: OrgRole) => {
    if (!orgId) return;
    setBusyUserId(userId);
    try {
      await updateTeamMemberRole(userId, role);
      loadMembers();
    } catch (err: any) {
      alert(err.message || t('team.updateRoleFailed'));
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRemove = async (userId: string, email: string) => {
    if (!orgId) return;
    if (!window.confirm(t('team.removeConfirm', { email }))) return;
    setBusyUserId(userId);
    try {
      await removeTeamMember(userId);
      loadMembers();
    } catch (err: any) {
      alert(err.message || t('team.removeFailed'));
    } finally {
      setBusyUserId(null);
    }
  };

  if (!orgId) {
    return (
      <div className="dispatch-card p-8 text-center text-brand-muted text-sm">
        {t('team.resolvingOrg')}
      </div>
    );
  }

  return (
    <div className="dispatch-card overflow-hidden p-0">
      <div className="p-5 border-b border-brand-border flex justify-between items-center">
        <div>
          <h2 className="text-base font-display font-medium tracking-tight">{t('team.title')}</h2>
          <p className="text-xs text-brand-muted">{t('team.subtitle')}</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 bg-brand-neon text-brand-bg px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90 active:scale-95 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            {t('team.invite')}
          </button>
        )}
      </div>

      {error && (
        <div className="m-5 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-10 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-brand-neon" />
        </div>
      ) : (
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-brand-input text-[11px] uppercase tracking-wide font-medium text-brand-muted">
                <th className="px-6 py-3">{t('team.table.user')}</th>
                <th className="px-6 py-3">{t('team.table.role')}</th>
                <th className="px-6 py-3">{t('team.table.memberSince')}</th>
                {canManage && <th className="px-6 py-3 text-right">{t('team.table.actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-brand-input transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {m.role === 'owner' && <Crown className="w-3.5 h-3.5 text-brand-neon shrink-0" />}
                      <span className="text-sm font-medium text-brand-text truncate">{m.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {canManage ? (
                      <select
                        value={m.role}
                        disabled={busyUserId === m.user_id}
                        onChange={(e) => handleRoleChange(m.user_id, e.target.value as OrgRole)}
                        className={cn(
                          'text-[11px] font-medium uppercase tracking-wide px-3 py-1.5 rounded-lg border outline-none transition-all',
                          ROLE_META[m.role].color
                        )}
                      >
                        <option value="owner">{t('roles.owner')}</option>
                        <option value="admin">{t('roles.admin')}</option>
                        <option value="operator">{t('roles.operator')}</option>
                        <option value="viewer">{t('roles.viewer')}</option>
                      </select>
                    ) : (
                      <span className={cn('px-3 py-1.5 rounded-lg text-[11px] font-medium uppercase tracking-wide border inline-block', ROLE_META[m.role].color)}>
                        {ROLE_META[m.role].label}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-brand-muted">
                    {format(new Date(m.created_at), 'PP')}
                  </td>
                  {canManage && (
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRemove(m.user_id, m.email)}
                        disabled={busyUserId === m.user_id}
                        className="w-9 h-9 bg-red-500/10 text-red-500 rounded-lg items-center justify-center hover:bg-red-500 hover:text-white transition-all disabled:opacity-40 inline-flex"
                      >
                        {busyUserId === m.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {members.length === 0 && (
            <div className="p-10 text-center text-brand-muted text-xs">{t('team.noMembers')}</div>
          )}
        </div>
      )}

      {showInvite && orgId && (
        <InviteModal
          orgId={orgId}
          onClose={() => setShowInvite(false)}
          onSuccess={() => {
            setShowInvite(false);
            loadMembers();
          }}
        />
      )}
    </div>
  );
};
