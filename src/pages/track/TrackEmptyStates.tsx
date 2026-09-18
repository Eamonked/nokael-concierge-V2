import { motion } from 'motion/react';
import { AlertCircle, Loader2, MessageSquare } from 'lucide-react';
import { WHATSAPP_NUMBER } from '../../constants';
import { trackWhatsAppClick } from '../../lib/analytics';

interface TrackSearchingStateProps {
  queryInput: string;
}

export function TrackSearchingState({ queryInput }: TrackSearchingStateProps) {
  return (
    <motion.div
      key="searching"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="dispatch-card text-center py-20 border border-brand-border bg-brand-surface/40"
    >
      <div className="relative w-16 h-16 mx-auto mb-6">
        <div className="absolute inset-0 rounded-full bg-brand-neon/10 animate-ping" />
        <div className="relative w-16 h-16 rounded-full bg-brand-surface border border-brand-neon/40 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-neon animate-spin" />
        </div>
      </div>
      <p className="text-sm font-bold uppercase tracking-[0.25em] text-brand-text mb-2">
        Querying Live Dispatch System...
      </p>
      <p className="text-xs text-brand-muted max-w-sm mx-auto">
        Retrieving dispatch status and Chain of Custody records for ID <b>{queryInput}</b>.
      </p>
    </motion.div>
  );
}

interface TrackNotFoundStateProps {
  queryInput: string;
  waSupportText: string;
}

export function TrackNotFoundState({ queryInput, waSupportText }: TrackNotFoundStateProps) {
  return (
    <motion.div
      key="not_found"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="dispatch-card border-red-500/20 text-center py-14 bg-red-500/[0.02]"
    >
      <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-red-500/20">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <h3 className="text-xl font-display font-medium mb-2 text-brand-text">
        Dispatch Record Not Found
      </h3>
      <p className="text-brand-muted text-sm mb-6 max-w-md mx-auto leading-relaxed">
        We could not locate an active job or quote matching <b>"{queryInput}"</b>. Please double-check your tracking ID or contact central dispatch for direct assistance.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waSupportText}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppClick('track_not_found')}
          className="btn-primary py-3 px-6 text-xs uppercase tracking-wider font-bold"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Verify with Dispatch Desk</span>
        </a>
      </div>
    </motion.div>
  );
}
