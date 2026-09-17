import React from 'react';
import { motion } from 'motion/react';
import { User, X, MapPin, Loader2, XCircle } from 'lucide-react';
import { type QuoteRequest } from '../../../lib/supabase';

export const LostQuoteModal = ({ quote, onClose, onConfirm }: { quote: QuoteRequest; onClose: () => void; onConfirm: (reason: string) => void }) => {
  const [reason, setReason] = React.useState('');
  const [customReason, setCustomReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const COMMON_LOST_REASONS = [
    'Customer went with a competitor',
    'Price objection / Too expensive',
    'Customer stopped responding / Went dark',
    'Customer no longer needs the service',
    'Timing / Urgency mismatch',
    'Service area / Route not supported',
    'Corporate account setup required',
    'Custom reason (specify below)',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = reason === 'Custom reason (specify below)' 
      ? customReason.trim() 
      : reason;
    
    if (!finalReason) {
      alert('Please select or enter a reason');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(finalReason);
      onClose();
    } catch (error) {
      console.error('Error marking quote as lost:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-brand-bg/90 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-brand-bg border border-brand-border rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-brand-border flex justify-between items-start">
          <div>
            <h2 className="text-lg font-display font-medium tracking-tight flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Mark Quote as Lost
            </h2>
            <p className="text-xs text-brand-muted mt-1">
              Document why this quote never converted to a job
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-brand-input rounded-full text-brand-muted hover:text-brand-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Quote summary */}
          <div className="p-4 bg-brand-surface border border-brand-border rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-3.5 h-3.5 text-brand-neon" />
              <span className="text-sm font-medium">{quote.name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-brand-muted">
              <MapPin className="w-3 h-3" />
              <span>{quote.pickup_location} → {quote.delivery_location}</span>
            </div>
          </div>

          {/* Reason selection */}
          <div>
            <label className="block text-[11px] font-semibold text-brand-muted uppercase mb-2">
              Why didn't this quote convert?
            </label>
            <select
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-brand-input border border-brand-input-border rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-neon/50"
            >
              <option value="">Select a reason...</option>
              {COMMON_LOST_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Custom reason textarea */}
          {reason === 'Custom reason (specify below)' && (
            <div>
              <label className="block text-[11px] font-semibold text-brand-muted uppercase mb-2">
                Custom Reason
              </label>
              <textarea
                required
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter specific details..."
                className="w-full bg-brand-input border border-brand-input-border rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-neon/50 min-h-[100px] resize-none"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-brand-input border border-brand-input-border text-brand-text text-xs font-medium uppercase tracking-wide rounded-xl hover:bg-brand-surface transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason}
              className="flex-1 py-3 bg-red-500 text-white text-xs font-medium uppercase tracking-wide rounded-xl hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  Mark as Lost
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};