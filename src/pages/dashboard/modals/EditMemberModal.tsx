import React from 'react';
import { motion } from 'motion/react';
import { X, Loader2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { updateTeamMemberName, updateTeamMemberRole, type OrgMember, type OrgRole } from '../../../lib/team';
import { RolePermissionHint } from './InviteModal';

const ROLE_RANK: OrgRole[] = ['viewer', 'operator', 'admin', 'owner'];

/** Edit a member's display name and role (Team → ⋯ → Edit name & role). */
export const EditMemberModal = ({ member, currentRole, onClose, onSaved }: {
  member: OrgMember;
  currentRole: OrgRole | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const { t } = useTranslation('dashboard');
  const [fullName, setFullName] = React.useState(member.full_name ?? '');
  const [role, setRole] = React.useState<OrgRole>(member.role);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const grantable = ROLE_RANK.filter((r) => ROLE_RANK.indexOf(r) <= ROLE_RANK.indexOf(currentRole ?? 'viewer')).reverse();
  const nameChanged = fullName.trim() !== (member.full_name ?? '');
  const roleChanged = role !== member.role;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    if (nameChanged) {
      const r = await updateTeamMemberName(member.user_id, fullName);
      if (!r.ok) { setSaving(false); setError(r.error || 'Could not update name.'); return; }
    }
    if (roleChanged) {
      const r = await updateTeamMemberRole(member.user_id, role);
      if (!r.ok) { setSaving(false); setError(r.error || 'Could not update role.'); return; }
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
          <div>
            <h2 className="text-lg font-display font-medium tracking-tight">{t('team.edit.title', { defaultValue: 'Edit team member' })}</h2>
            <p className="text-xs text-brand-muted">{member.email}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-brand-input rounded-full text-brand-muted hover:text-brand-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-[11px] font-semibold text-brand-muted uppercase mb-2">{t('invite.nameLabel', { defaultValue: 'Full name' })}</label>
            <input
              type="text"
              value={fullName}
              maxLength={100}
              onChange={(e) => setFullName(e.target.value)}
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
            disabled={saving || (!nameChanged && !roleChanged)}
            className="btn-primary w-full py-3.5 text-xs disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {t('team.edit.save', { defaultValue: 'Save changes' })}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
