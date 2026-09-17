import React from 'react';
import { motion } from 'motion/react';
import {
  User,
  Phone,
  Mail,
  Navigation,
  Package,
  Activity,
  MessageSquare,
  X,
} from 'lucide-react';
import { type BusinessInquiry } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';

interface BusinessDetailsModalProps {
  business: BusinessInquiry;
  onClose: () => void;
  onBusinessUpdate: (id: string, updates: Partial<BusinessInquiry>) => Promise<void>;
}

export function BusinessDetailsModal({ business, onClose, onBusinessUpdate }: BusinessDetailsModalProps) {
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
        <div className="p-8 border-b border-brand-border flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-display font-medium tracking-tighter mb-1">{business.company_name}</h2>
            <p className="text-xs text-brand-muted uppercase tracking-wide font-medium">Business Entity</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-brand-muted hover:text-brand-text transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-grow overflow-y-auto p-8 no-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">

            {/* Point of Contact */}
            <div className="space-y-6">
              <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted">Point of Contact</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-brand-neon" />
                  <span>{business.contact_person}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-brand-neon" />
                  <span>{business.phone_whatsapp}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-brand-neon" />
                  <span>{business.email}</span>
                </div>
              </div>
            </div>

            {/* Operational Scope */}
            <div className="space-y-6">
              <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted">Operational Scope</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <Navigation className="w-4 h-4 text-brand-neon" />
                  <span className="text-xs">{business.typical_routes}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Package className="w-4 h-4 text-brand-neon" />
                  <span>{business.item_types}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Activity className="w-4 h-4 text-brand-neon" />
                  <span>{business.estimated_monthly_volume} Jobs/mo</span>
                </div>
              </div>
            </div>

            {/* Contract Admin */}
            <div className="space-y-6">
              <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted">Contract Admin</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-brand-muted">Status</label>
                  <select
                    value={business.status}
                    onChange={(e) => onBusinessUpdate(business.id!, { status: e.target.value as any })}
                    className="bg-brand-input border border-brand-input-border rounded-lg px-3 py-1.5 text-xs font-medium outline-none"
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-3 h-3 rounded-full",
                    business.invoicing_required ? "bg-brand-neon" : "bg-brand-muted"
                  )} />
                  <span className="text-xs font-medium text-brand-text">
                    {business.invoicing_required ? 'Monthly Invoicing' : 'Standard Payment'}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* CRM Notes */}
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted mb-6">CRM & Follow-up Notes</h3>
            <textarea
              className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-6 text-sm outline-none focus:border-brand-neon/50 transition-all min-h-[150px]"
              placeholder="Logs, pre-agreed rates, contract details..."
              value={business.follow_up_notes || ''}
              onChange={(e) => onBusinessUpdate(business.id!, { follow_up_notes: e.target.value })}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-brand-border bg-brand-surface/50 flex gap-4">
          <a
            href={`https://wa.me/${business.phone_whatsapp.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-4 bg-brand-neon text-brand-bg text-xs font-medium uppercase tracking-wide rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-3"
          >
            <MessageSquare className="w-4 h-4" />
            Contact Decision Maker
          </a>
          <button
            onClick={onClose}
            className="px-8 py-4 bg-brand-input border border-brand-input-border text-brand-text text-xs font-medium uppercase tracking-wide rounded-xl hover:bg-brand-surface transition-all"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
