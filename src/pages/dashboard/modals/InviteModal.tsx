import React from 'react';
import { motion } from 'motion/react';
import { X, Loader2, Send, UserPlus } from 'lucide-react';
import { inviteTeamMember, type OrgRole } from '../../../lib/team';

export const InviteModal = ({ orgId, onClose, onSuccess }: { orgId: string; onClose: () => void; onSuccess: () => void }) => {
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<OrgRole>('operator');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await inviteTeamMember(email.trim(), role);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to send invite');
    } finally {
      setLoading(false);
    }
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
          <h2 className="text-lg font-display font-medium tracking-tight">Invite team member</h2>
          <button onClick={onClose} className="p-2 bg-brand-input rounded-full text-brand-muted hover:text-brand-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-[11px] font-semibold text-brand-muted uppercase mb-2">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full bg-brand-input border border-brand-input-border rounded-xl px-4 py-3 text-sm focus:border-brand-neon/50 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-brand-muted uppercase mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as OrgRole)}
              className="w-full bg-brand-input border border-brand-input-border rounded-xl px-4 py-3 text-sm outline-none"
            >
              <option value="admin">Admin — full access, can manage team</option>
              <option value="operator">Operator — dispatch and driver management</option>
              <option value="viewer">Viewer — read-only</option>
              <option value="owner">Owner — full access, org ownership</option>
            </select>
          </div>
          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3.5 text-xs"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Send Invite
          </button>
        </form>
      </motion.div>
    </div>
  );
};
