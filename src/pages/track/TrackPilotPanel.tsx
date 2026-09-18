import {
  Zap,
  XCircle,
  ShieldCheck,
  Truck,
  MapPin,
  User,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { WHATSAPP_NUMBER } from '../../constants';
import { trackWhatsAppClick } from '../../lib/analytics';
import type { JobWithDriver } from '../../lib/supabase';
import { getItemMeta } from './statusConfig';

interface TrackPilotPanelProps {
  activeJob: JobWithDriver;
  currentTrackingId: string;
}

export default function TrackPilotPanel({ activeJob, currentTrackingId }: TrackPilotPanelProps) {
  const { t } = useTranslation('tracking');
  const hasDriver = !!(activeJob.driver || activeJob.driver_id);
  const isCancelled = activeJob.status === 'cancelled';
  const isCompleted = activeJob.status === 'completed';
  const isInTransit = activeJob.status === 'driver_pickup';
  const isAtPickup = activeJob.status === 'client_pickup';
  const isAtDelivery = activeJob.status === 'driver_delivery';

  // Dynamic Badge
  let badge = {
    text: t('pilotPanel.badge.awaiting'),
    bg: 'bg-brand-input',
    textCol: 'text-brand-muted',
    border: 'border-brand-input-border',
  };
  if (isCancelled) {
    badge = { text: t('pilotPanel.badge.cancelled'), bg: 'bg-red-500/10', textCol: 'text-red-400', border: 'border-red-500/30' };
  } else if (isCompleted) {
    badge = { text: t('pilotPanel.badge.verified'), bg: 'bg-emerald-500/10', textCol: 'text-emerald-400', border: 'border-emerald-500/30' };
  } else if (isInTransit) {
    badge = { text: t('pilotPanel.badge.inTransit'), bg: 'bg-brand-neon/10', textCol: 'text-brand-neon', border: 'border-brand-neon/30' };
  } else if (isAtDelivery) {
    badge = { text: t('pilotPanel.badge.atDestination'), bg: 'bg-purple-500/10', textCol: 'text-purple-400', border: 'border-purple-500/30' };
  } else if (isAtPickup) {
    badge = { text: t('pilotPanel.badge.atSender'), bg: 'bg-blue-500/10', textCol: 'text-blue-400', border: 'border-blue-500/30' };
  } else if (hasDriver) {
    badge = { text: t('pilotPanel.badge.mobilized'), bg: 'bg-yellow-500/10', textCol: 'text-yellow-400', border: 'border-yellow-500/30' };
  }

  // Dynamic Pilot/Desk Information
  // NOTE: deliberately never surfaces activeJob.driver?.full_name or
  // .rating here — this is the public tracking page, reachable with a
  // guessable job ref (no auth, no token). Personally-identifying pilot
  // details and live GPS only ever appear in the token-gated Chain of
  // Custody confirmation portal.
  let title = t('pilotPanel.profile.opsTitle');
  let subtitle = t('pilotPanel.profile.opsSubtitle');
  let iconElement = <Zap className="w-6 h-6 animate-pulse" />;
  let iconBg = 'bg-brand-input border-brand-input-border text-brand-neon';

  if (isCancelled) {
    title = t('pilotPanel.profile.cancelledTitle');
    subtitle = activeJob.cancellation_reason
      ? `${t('pilotPanel.profile.cancelledSubtitlePrefix')} ${activeJob.cancellation_reason}`
      : t('pilotPanel.profile.cancelledSubtitleFallback');
    iconElement = <XCircle className="w-6 h-6" />;
    iconBg = 'bg-red-500/10 border-red-500/30 text-red-400';
  } else if (isCompleted) {
    title = t('pilotPanel.profile.completedTitle');
    subtitle = activeJob.driver?.vehicle_type
      ? `${activeJob.driver.vehicle_type} ${t('pilotPanel.profile.completedSubtitleSuffix')}`
      : t('pilotPanel.profile.completedSubtitleFallback');
    iconElement = <ShieldCheck className="w-6 h-6" />;
    iconBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
  } else if (isInTransit) {
    title = t('pilotPanel.profile.transitTitle');
    subtitle = activeJob.driver?.vehicle_type
      ? `${activeJob.driver.vehicle_type} ${t('pilotPanel.profile.transitSubtitleSuffix')}`
      : t('pilotPanel.profile.transitSubtitleFallback');
    iconElement = <Truck className="w-6 h-6" />;
    iconBg = 'bg-brand-neon/10 border-brand-neon/40 text-brand-neon shadow-[0_0_15px_rgba(57,255,20,0.2)]';
  } else if (isAtDelivery) {
    title = t('pilotPanel.profile.deliveryTitle');
    subtitle = t('pilotPanel.profile.deliverySubtitleTemplate', { emirate: activeJob.delivery_emirate });
    iconElement = <MapPin className="w-6 h-6" />;
    iconBg = 'bg-purple-500/10 border-purple-500/30 text-purple-400';
  } else if (isAtPickup) {
    title = t('pilotPanel.profile.pickupTitle');
    subtitle = t('pilotPanel.profile.pickupSubtitleTemplate', { emirate: activeJob.pickup_emirate });
    iconElement = <User className="w-6 h-6" />;
    iconBg = 'bg-blue-500/10 border-blue-500/30 text-blue-400';
  } else if (hasDriver) {
    title = t('pilotPanel.profile.assignedTitle');
    subtitle = activeJob.driver?.vehicle_type
      ? `${activeJob.driver.vehicle_type} ${t('pilotPanel.profile.assignedSubtitleSuffix')}`
      : t('pilotPanel.profile.assignedSubtitleFallback');
    iconElement = <Truck className="w-6 h-6" />;
    iconBg = 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
  }

  // Contextual WhatsApp link
  // ⚠ contextualWaMsg is a WhatsApp message to Nokael's own dispatch number, not the
  // customer — decision (A) "keep fixed" applies, so this stays a plain template
  // literal and is NOT wired to t().
  let contextualWaMsg = `Hi Nokael Dispatch, I am tracking manifest ${currentTrackingId}${activeJob ? ` (${activeJob.pickup_emirate} ➔ ${activeJob.delivery_emirate})` : ''} and would like a live status update.`;
  if (isCancelled) {
    contextualWaMsg = `Hi Nokael Dispatch, I am inquiring regarding the cancelled manifest ${activeJob.job_ref || currentTrackingId} (${activeJob.pickup_emirate} to ${activeJob.delivery_emirate}). Reason cited: "${activeJob.cancellation_reason || 'Manual Cancellation'}". Please advise on parcel recovery or re-dispatch status.`;
  } else if (isCompleted) {
    contextualWaMsg = `Hi Nokael Dispatch, I am following up regarding completed manifest ${activeJob.job_ref || currentTrackingId} (${activeJob.pickup_emirate} to ${activeJob.delivery_emirate}).`;
  } else if (isInTransit) {
    contextualWaMsg = `Hi Nokael Dispatch, I am tracking live in-transit consignment ${activeJob.job_ref || currentTrackingId} between ${activeJob.pickup_emirate} and ${activeJob.delivery_emirate}.`;
  }

  const itemMeta = getItemMeta(activeJob.item_type);
  const ItemIcon = itemMeta.icon;

  return (
    <div className={cn(
      "dispatch-card border bg-brand-surface/60 space-y-4 transition-all",
      isCancelled ? "border-red-500/30 bg-red-950/10" : isCompleted ? "border-emerald-500/30 bg-emerald-950/10" : "border-brand-border"
    )}>
      {/* Header with Dynamic Badge */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-muted">
          {t('pilotPanel.sectionLabel')}
        </p>
        <span className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border", badge.bg, badge.textCol, badge.border)}>
          {badge.text}
        </span>
      </div>

      {/* Pilot Profile / Operations Info */}
      <div className="flex items-center gap-4">
        <div className={cn("w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 transition-colors", iconBg)}>
          {iconElement}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-display font-medium text-brand-text truncate">
            {title}
          </p>
          <p className="text-[11px] text-brand-muted truncate">
            {subtitle}
          </p>
          {isCancelled && activeJob.cancelled_at && (
            <p className="text-[10px] text-red-400/80 font-mono mt-0.5">
              {t('pilotPanel.terminatedOn', { date: format(new Date(activeJob.cancelled_at), 'dd MMM yyyy, hh:mm a') })}
            </p>
          )}
        </div>
      </div>

      {/* Item Specification & Dynamic Custody Status */}
      <div className="pt-3 border-t border-brand-border/60 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <ItemIcon className={cn("w-4 h-4", itemMeta.color)} />
          <span className="font-medium text-brand-text">{t(itemMeta.labelKey)}</span>
        </div>
        <div>
          {isCancelled ? (
            <span className="text-[10px] text-red-400 uppercase tracking-wider font-bold">
              {t('pilotPanel.custody.halted')}
            </span>
          ) : isCompleted ? (
            <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              {t('pilotPanel.custody.handoverSigned')}
            </span>
          ) : isInTransit ? (
            <span className="text-[10px] text-brand-neon uppercase tracking-wider font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-neon animate-pulse" />
              {t('pilotPanel.custody.activeCustody')}
            </span>
          ) : (
            <span className="text-[10px] text-brand-muted uppercase tracking-wider font-bold">
              {t('pilotPanel.custody.insuredTransit')}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons based on status */}
      {/* Chain of Custody PDF download intentionally lives only in the
          token-gated Confirmation Portal, not here — job refs on this
          public page are guessable, so this must never be a place
          anyone can pull a COC record (with pilot + GPS detail) from. */}
      <div className="pt-2 space-y-2">
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(contextualWaMsg)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppClick('track_support_click', {
            phone_number: activeJob.sender_phone,
            first_name: activeJob.sender_name
          })}
          className={cn(
            "w-full py-3 text-xs uppercase tracking-wider font-bold rounded-xl flex items-center justify-center gap-2 transition-all",
            isCancelled
              ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30"
              : isCompleted
                ? "bg-brand-input hover:bg-brand-border/60 text-brand-text border border-brand-input-border"
                : "btn-primary"
          )}
        >
          <MessageSquare className="w-4 h-4" />
          <span>
            {isCancelled
              ? t('pilotPanel.action.cancelled')
              : isCompleted
                ? t('pilotPanel.action.completed')
                : t('pilotPanel.action.default')}
          </span>
        </a>
      </div>
    </div>
  );
}
