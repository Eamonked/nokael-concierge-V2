import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Loader2, MessageSquare } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { trackFormSubmission } from '../lib/analytics';
import { WHATSAPP_NUMBER } from '../constants';

/**
 * ThankYou.tsx
 *
 * This page exists for one critical reason: Google Ads conversion tracking
 * requires a stable URL to fire a conversion pixel on. The previous approach
 * (inline state change in GetQuote) had no URL, so Google Ads couldn't
 * detect the conversion at all.
 *
 * Flow:
 *  1. GetQuote submits to Supabase → navigates to /thank-you?wa=<encoded message>
 *  2. This page mounts → fires trackFormSubmission() once via useEffect
 *  3. After 2.5s → redirects to WhatsApp with the pre-filled message
 *
 * Google Ads setup:
 *  Option A (recommended): In Google Ads → Conversions, create a
 *  "Page load" conversion action pointing to nokael.com/thank-you
 *  This works without any code changes.
 *
 *  Option B: Use the gtag event fired by trackFormSubmission() with
 *  an "Event" conversion action (requires VITE_GADS_CONVERSION_ID etc.)
 *
 *  Both options can run simultaneously for redundancy.
 */
export default function ThankYou() {
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = React.useState(3);
  const hasFired = React.useRef(false);

  const waMessage = searchParams.get('wa') || '';
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}${waMessage ? `?text=${waMessage}` : ''}`;

  // Fire conversion pixel exactly once on mount
  React.useEffect(() => {
    if (!hasFired.current) {
      hasFired.current = true;
      trackFormSubmission();
    }
  }, []);

  // Countdown + redirect
  React.useEffect(() => {
    if (countdown <= 0) {
      window.location.href = waUrl;
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, waUrl]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full dispatch-card text-center py-16"
      >
        <div className="w-20 h-20 bg-brand-neon/10 rounded-full flex items-center justify-center mx-auto mb-10">
          <CheckCircle2 className="w-10 h-10 text-brand-neon" />
        </div>

        <h2 className="text-3xl font-display font-medium tracking-tighter mb-4">
          Request Logged.
        </h2>

        <p className="text-brand-muted mb-10 leading-relaxed text-sm">
          Your dispatch request has been entered into the system. Connecting you to a live dispatcher on WhatsApp...
        </p>

        <div className="flex items-center justify-center gap-3 text-brand-neon font-bold uppercase tracking-[0.3em] text-[10px] mb-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Redirecting in {countdown}s...</span>
        </div>

        {/* Manual fallback in case redirect is blocked */}
        <a
          href={waUrl}
          className="btn-primary w-full py-4 mt-4"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Open WhatsApp Now</span>
        </a>

        <p className="mt-8 text-[9px] text-brand-muted uppercase tracking-[0.3em] font-bold leading-relaxed">
          A dispatcher will respond within 2–5 minutes.
        </p>
      </motion.div>
    </div>
  );
}