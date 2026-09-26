import React from 'react';
import { motion } from 'motion/react';
import { X, Loader2, UserPlus, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { inviteTeamMember, type OrgRole } from '../../../lib/team';

const ROLE_RANK: OrgRole[] = ['viewer', 'operator', 'admin', 'owner'];

/** What each role can do — shown under the role picker (invite + edit). */
export const useRolePermissions = () => {
  const { t } = useTranslation('dashboard');
  return (role: OrgRole): string[] => ({
    owner: [
      t('rolePermissions.owner.0', { defaultValue: 'Full access to jobs, drivers, quotes, businesses and settings' }),
      t('rolePermissions.owner.1', { defaultValue: 'Invite, edit, disable and remove any member, including other owners' }),
    ],
    admin: [
      t('rolePermissions.admin.0', { defaultValue: 'Full access to jobs, drivers, quotes, businesses and settings' }),
      t('rolePermissions.admin.1', { defaultValue: 'Invite, edit, disable and remove members (not owners)' }),
    ],
    operator: [
      t('rolePermissions.operator.0', { defaultValue: 'Create and dispatch jobs, manage drivers, quotes and businesses' }),
      t('rolePermissions.operator.1', { defaultValue: 'Cannot manage the team' }),
    ],
    viewer: [
      t('rolePermissions.viewer.0', { defaultValue: 'View jobs, drivers, quotes and the live map' }),
      t('rolePermissions.viewer.1', { defaultValue: 'Cannot manage the team' }),
    ],
  })[role];
};

export const RolePermissionHint = ({ role }: { role: OrgRole }) => {
  const permissions = useRolePermissions()(role);
  return (
    <ul className="mt-2 space-y-1">
      {permissions.map((p) => (
        <li key={p} className="flex items-start gap-1.5 text-[11px] text-brand-muted leading-snug">
          <ShieldCheck className="w-3 h-3 mt-0.5 shrink-0 text-brand-neon" />
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
};

export const InviteModal = ({ orgId, currentRole, onClose, onSuccess }: {
  orgId: string;
  currentRole: OrgRole | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) => {
  const { t } = useTranslation('dashboard');
  const [email, setEmail] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [role, setRole] = React.useState<OrgRole>('operator');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  // You can only grant roles up to your own (the server enforces this too).
  const grantable = ROLE_RANK.filter((r) => ROLE_RANK.indexOf(r) <= ROLE_RANK.indexOf(currentRole ?? 'viewer')).reverse();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await inviteTeamMember(email.trim(), role, fullName);
    setLoading(false);
    if (!result.ok) {
      setError(result.error || t('invite.sendFailed'));
      return;
    }
    onSuccess(result.existing
      ? t('invite.addedExisting', { email: email.trim(), defaultValue: '{{email}} already has an account and was added to the team. They sign in with their existing password.' })
      : t('invite.sent', { email: email.trim(), defaultValue: 'Invite sent to {{email}}' }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-org={orgId}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-brand-bg/90 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-brand-bg border border-brand-border rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-brand-border flex justify-between items-center">
          <h2 className="text-lg font-display font-medium tracking-tight">{t('invite.title')}</h2>
          <button onClick={onClose} className="p-2 bg-brand-input rounded-full text-brand-muted hover:text-brand-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-[11px] font-semibold text-brand-muted uppercase mb-2">
              {t('invite.nameLabel', { defaultValue: 'Full name' })}{' '}
              <span className="normal-case font-normal">({t('invite.optional', { defaultValue: 'optional' })})</span>
            </label>
            <input
              type="text"
              value={fullName}
              maxLength={100}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('invite.namePlaceholder', { defaultValue: 'e.g. Sara Ahmed' })}
              className="w-full bg-brand-input border border-brand-input-border rounded-xl px-4 py-3 text-sm focus:border-brand-neon/50 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-brand-muted uppercase mb-2">{t('invite.emailLabel')}</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('invite.emailPlaceholder')}
              className="w-full bg-brand-input border border-brand-input-border rounded-xl px-4 py-3 text-sm focus:border-brand-neon/50 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-brand-muted uppercase mb-2">{t('invite.roleLabel')}</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as OrgRole)}
              className="w-full bg-brand-input border border-brand-input-border rounded-xl px-4 py-3 text-sm outline-none"
            >
              {grantable.map((r) => (
                <option key={r} value={r}>{t(`invite.roles.${r}`)}</option>
              ))}
            </select>
            <RolePermissionHint role={role} />
          </div>
          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3.5 text-xs"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {t('invite.send')}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
