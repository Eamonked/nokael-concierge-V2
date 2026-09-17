import React from 'react';
import { motion } from 'motion/react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Truck,
  Navigation,
  Clock,
  FileText,
  ExternalLink,
  Copy,
  X,
  CheckCircle2,
  Trash2,
  Loader2,
} from 'lucide-react';
import { setDriverPin, type Driver, type DriverDocument } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';

interface DriverProfileModalProps {
  driver: Driver & { documents: DriverDocument[] };
  onClose: () => void;
  onDriverStatusUpdate: (id: string, updates: Partial<Driver>) => Promise<void>;
}

export function DriverProfileModal({ driver, onClose, onDriverStatusUpdate }: DriverProfileModalProps) {
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [pinDraft, setPinDraft] = React.useState('');
  const [copiedDriverLink, setCopiedDriverLink] = React.useState(false);

  const handleUpdate = async (updates: Partial<Driver>) => {
    setIsUpdating(true);
    try {
      await onDriverStatusUpdate(driver.id!, updates);
    } finally {
      setIsUpdating(false);
    }
  };

  const cocDomain = (import.meta.env.VITE_COC_URL || 'https://nokael.ae').replace(/\/$/, '');
  const statusUrl = `${cocDomain}/driver/${driver.id}/status`;

  const statusMap: Record<string, { label: string; dot: string; text: string }> = {
    available: { label: 'Available now', dot: 'bg-emerald-400', text: 'text-emerald-400' },
    on_job:    { label: 'On a job',       dot: 'bg-amber-400',  text: 'text-amber-400'  },
    offline:   { label: 'Offline',        dot: 'bg-brand-muted', text: 'text-brand-muted' },
  };
  const dispatchStatus = statusMap[driver.status || 'offline'] || statusMap.offline;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-brand-bg/90 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-4xl bg-brand-bg border border-brand-border rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-8 border-b border-brand-border flex justify-between items-center bg-brand-surface/30">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-brand-neon/10 flex items-center justify-center border border-brand-neon/20">
              <User className="w-8 h-8 text-brand-neon" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-medium tracking-tighter mb-1">{driver.full_name}</h2>
              <div className="flex items-center gap-3">
                <p className="text-xs text-brand-muted uppercase tracking-wide font-medium">
                  Driver ID: {driver.id?.substring(0, 8)}
                </p>
                <div className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium border",
                  driver.onboarding_status === 'approved'
                    ? "bg-brand-neon/10 text-brand-neon border-brand-neon/20"
                    : driver.onboarding_status === 'rejected'
                    ? "bg-red-500/10 text-red-500 border-red-500/20"
                    : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                )}>
                  {driver.onboarding_status || 'pending'}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-brand-muted hover:text-brand-text transition-colors bg-brand-input rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-grow overflow-y-auto p-8 no-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">

            {/* Contact */}
            <div className="space-y-6">
              <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted border-b border-brand-border pb-2">
                Contact Details
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-brand-input rounded-lg"><Phone className="w-4 h-4 text-brand-neon" /></div>
                  <span className="text-sm font-mono tracking-tight">{driver.phone}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-brand-input rounded-lg"><Mail className="w-4 h-4 text-brand-neon" /></div>
                  <span className="text-sm truncate">{driver.email}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-brand-input rounded-lg"><MapPin className="w-4 h-4 text-brand-neon" /></div>
                  <span className="text-sm">{driver.base_location}</span>
                </div>
              </div>
            </div>

            {/* Vehicle */}
            <div className="space-y-6">
              <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted border-b border-brand-border pb-2">
                Vehicle & Logistics
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-brand-input rounded-lg"><Truck className="w-4 h-4 text-brand-neon" /></div>
                  <span className="text-sm">{driver.vehicle_type}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-brand-input rounded-lg"><Navigation className="w-4 h-4 text-brand-neon" /></div>
                  <span className="text-sm">Inter-Emirate: {driver.inter_emirate ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-brand-input rounded-lg"><Clock className="w-4 h-4 text-brand-neon" /></div>
                  <span className="text-xs text-brand-muted">{driver.availability_hours}</span>
                </div>
              </div>
            </div>

            {/* Internal Management */}
            <div className="space-y-6">
              <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted border-b border-brand-border pb-2">
                Internal Management
              </h3>
              <div className="space-y-4">

                {/* Tier */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-medium text-brand-muted">Tiering Strategy</label>
                  <select
                    value={driver.tier || 'D'}
                    onChange={(e) => handleUpdate({ tier: e.target.value as any })}
                    className="w-full bg-brand-input border border-brand-input-border rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-brand-neon/50 transition-all font-mono"
                  >
                    <option value="A">Elite Rank (A)</option>
                    <option value="B">Priority Rank (B)</option>
                    <option value="C">Standard Rank (C)</option>
                    <option value="D">New Arrival (D)</option>
                  </select>
                </div>

                {/* Reliability score */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-medium text-brand-muted">Reliability Score (1-10)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={isNaN(driver.reliability_score!) ? 0 : (driver.reliability_score || 0)}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        handleUpdate({ reliability_score: isNaN(val) ? 0 : val });
                      }}
                      className="w-16 bg-brand-input border border-brand-input-border rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-brand-neon transition-all font-mono"
                    />
                    <div className="flex-1 bg-brand-input h-2 rounded-full overflow-hidden border border-brand-border">
                      <div
                        className="h-full bg-brand-neon transition-all"
                        style={{ width: `${(isNaN(driver.reliability_score!) ? 0 : (driver.reliability_score || 0)) * 10}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Dispatch pool status */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-medium text-brand-muted">Dispatch Pool Status</label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-brand-input border border-brand-input-border rounded-lg w-fit">
                    <span className={`w-2 h-2 rounded-full ${dispatchStatus.dot}`} />
                    <span className={`text-xs font-medium ${dispatchStatus.text}`}>{dispatchStatus.label}</span>
                  </div>
                  <p className="text-[10px] text-brand-muted">
                    Set by the driver in their app, or automatically when a job is assigned or completed.
                  </p>
                </div>

                {/* PIN management */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-medium text-brand-muted">Driver App PIN</label>
                  <p className="text-[10px] text-brand-muted mb-1">
                    Set a 4-6 digit PIN so this driver can log into the status app and toggle their own
                    availability. Share it with them over WhatsApp along with their status link.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="e.g. 4821"
                      value={pinDraft}
                      onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ''))}
                      className="w-28 bg-brand-input border border-brand-input-border rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-brand-neon transition-all font-mono"
                    />
                    <button
                      type="button"
                      disabled={!/^[0-9]{4,6}$/.test(pinDraft) || isUpdating}
                      onClick={async () => {
                        try {
                          await setDriverPin(driver.id!, pinDraft);
                          setPinDraft('');
                          alert(`PIN set. Send ${driver.full_name} their status link + this PIN over WhatsApp.`);
                        } catch (err: any) {
                          alert(`Failed to set PIN: ${err.message || err}`);
                        }
                      }}
                      className="px-4 py-2 bg-brand-neon/10 border border-brand-neon/20 text-brand-neon rounded-lg text-[11px] font-medium uppercase tracking-wide hover:bg-brand-neon/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Set PIN
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(statusUrl);
                        setCopiedDriverLink(true);
                        setTimeout(() => setCopiedDriverLink(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-input hover:bg-brand-border rounded-lg border border-brand-border text-xs font-semibold text-brand-neon tracking-wider uppercase transition-all hover:scale-105"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedDriverLink ? 'Copied' : 'Copy status link'}
                    </button>
                    <a
                      href={statusUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-input hover:bg-brand-border rounded-lg border border-brand-border text-xs font-semibold text-brand-muted hover:text-brand-text tracking-wider uppercase transition-all hover:scale-105"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open link
                    </a>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="mb-8">
            <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted border-b border-brand-border pb-4 mb-6">
              Uploaded Documents (Google Drive)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {driver.documents?.map((doc) => (
                <div
                  key={doc.id}
                  className="p-6 bg-brand-input border border-brand-input-border rounded-2xl flex items-center justify-between group hover:border-brand-neon/30 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-brand-bg flex items-center justify-center text-brand-muted group-hover:text-brand-neon transition-all">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-brand-text mb-1">
                        {doc.document_type.replace('_', ' ')}
                      </div>
                      <div className="text-[11px] text-brand-muted">Status: {doc.verification_status}</div>
                    </div>
                  </div>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-lg border border-brand-border flex items-center justify-center text-brand-muted hover:bg-brand-neon hover:text-brand-bg hover:border-brand-neon transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
              {(!driver.documents || driver.documents.length === 0) && (
                <div className="col-span-2 p-8 bg-brand-input rounded-3xl border border-dashed border-brand-border text-center opacity-50">
                  <FileText className="w-10 h-10 text-brand-muted mx-auto mb-4" />
                  <p className="text-xs font-medium text-brand-muted">No documents found</p>
                </div>
              )}
            </div>
          </div>

          {/* Internal notes */}
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted mb-6">Internal Audit Notes</h3>
            <textarea
              className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-6 text-sm outline-none focus:border-brand-neon/50 transition-all min-h-[150px] font-mono text-[11px]"
              placeholder="Record verification results or history..."
              value={driver.internal_notes || ''}
              onChange={(e) => handleUpdate({ internal_notes: e.target.value })}
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-8 border-t border-brand-border bg-brand-surface/50 flex gap-4">
          <button
            disabled={isUpdating}
            onClick={() => handleUpdate({ onboarding_status: 'approved' })}
            className="flex-1 py-5 bg-brand-neon text-brand-bg text-xs font-medium uppercase tracking-wide rounded-2xl hover:bg-white disabled:opacity-50 transition-all flex items-center justify-center gap-3 group shadow-lg shadow-brand-neon/10"
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin text-brand-bg" />
            ) : (
              <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
            )}
            {driver.onboarding_status === 'approved' ? 'Update & Re-Approve' : 'Approve Driver'}
          </button>
          <button
            disabled={isUpdating}
            onClick={() => handleUpdate({ onboarding_status: 'rejected' })}
            className="flex-1 py-5 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium uppercase tracking-wide rounded-2xl hover:bg-red-500 hover:text-white disabled:opacity-50 transition-all flex items-center justify-center gap-3 group"
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
            )}
            Reject Application
          </button>
        </div>
      </motion.div>
    </div>
  );
}
