import { motion } from 'motion/react';
import { MessageSquare } from 'lucide-react';
import { WHATSAPP_NUMBER } from '../../constants';
import { trackWhatsAppClick } from '../../lib/analytics';
import type { QuoteRequest } from '../../lib/supabase';

interface TrackQuoteResultProps {
  activeQuote: QuoteRequest;
}

export default function TrackQuoteResult({ activeQuote }: TrackQuoteResultProps) {
  return (
    <motion.div
      key={`quote-${activeQuote.id || activeQuote.tracking_id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-6"
    >
      <div className="dispatch-card border border-brand-border bg-brand-surface/70 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-brand-border/60">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted block">
              Quote Manifest ID
            </span>
            <p className="text-2xl font-display font-medium tracking-tight text-brand-text">
              {activeQuote.tracking_id}
            </p>
          </div>
          <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">
            Dispatch Pending Allocation
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-brand-input/50 border border-brand-input-border mb-6">
          <h3 className="text-base font-display font-medium text-brand-text mb-1">
            Manifest Under Dispatch Review
          </h3>
          <p className="text-xs text-brand-muted leading-relaxed">
            Your quote request has been registered. Our operations control team is coordinating the nearest available driver on the <b>{activeQuote.emirate}</b> corridor.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-6">
          <div className="p-4 rounded-xl bg-brand-input/30 border border-brand-input-border">
            <span className="text-[9px] uppercase tracking-widest font-black text-brand-muted block mb-1">Pickup</span>
            <p className="font-semibold text-brand-text">{activeQuote.pickup_location}</p>
          </div>
          <div className="p-4 rounded-xl bg-brand-input/30 border border-brand-input-border">
            <span className="text-[9px] uppercase tracking-widest font-black text-brand-muted block mb-1">Delivery</span>
            <p className="font-semibold text-brand-text">{activeQuote.delivery_location}</p>
          </div>
        </div>

        {/* ⚠ Follow-up message goes to Nokael's own dispatch number, not the
            customer — decision (A) "keep fixed" applies, left as a plain
            template literal, not wired to t(). */}
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi Nokael, I am following up on quote manifest ${activeQuote.tracking_id} for ${activeQuote.item_type} from ${activeQuote.pickup_location} to ${activeQuote.delivery_location}.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppClick('track_quote_followup')}
          className="btn-primary w-full py-3.5 text-xs uppercase tracking-wider font-bold"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Fast-Track with Operations on WhatsApp</span>
        </a>
      </div>
    </motion.div>
  );
}
