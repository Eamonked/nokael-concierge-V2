import { AlertTriangle, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import type { JobWithDriver } from '../../lib/supabase';
import type { StatusConfig } from './statusConfig';
import { computeCustodyMilestones } from './custodyMilestones';

interface TrackMilestoneTimelineProps {
  activeJob: JobWithDriver;
  statusConfig: StatusConfig;
}

export default function TrackMilestoneTimeline({ activeJob, statusConfig }: TrackMilestoneTimelineProps) {
  const { t } = useTranslation('tracking');
  const hasDriver = !!(activeJob.driver || activeJob.driver_id);
  const m = computeCustodyMilestones(activeJob);
  const { ts1, ts2, ts3, ts4, ts5, tsInterrupt, isReturned, isInterrupted, step2Done, step3Done, step4Done, step5Done, lastCompletedStep } = m;

  // Shared "journey stopped here" node for cancelled and returned jobs.
  // The return reason is deliberately not shown: this page is public.
  const renderInterruptionNode = () => {
    const tone = isReturned
      ? { box: 'bg-amber-500/10 border-amber-500/30 text-amber-300', dot: 'bg-amber-500 shadow-[0_0_14px_rgba(245,158,11,0.9)]', accent: 'text-amber-400', time: 'text-amber-400/80', body: 'text-amber-300/90' }
      : { box: 'bg-red-500/10 border-red-500/30 text-red-300', dot: 'bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.9)]', accent: 'text-red-400', time: 'text-red-400/80', body: 'text-red-300/90' };
    return (
      <div className={cn("relative p-4 rounded-2xl border", tone.box)}>
        <div className={cn("absolute -left-[31px] sm:-left-[39px] top-4 w-4 h-4 rounded-full border-4 border-brand-bg flex items-center justify-center", tone.dot)} />
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn("w-3.5 h-3.5", tone.accent)} />
            <p className={cn("text-xs font-black uppercase tracking-wider", tone.accent)}>
              {isReturned ? t('milestones.returnedNodeLabel') : t('milestones.cancelledNodeLabel')}
            </p>
          </div>
          {tsInterrupt && (
            <span className={cn("text-[11px] font-mono font-bold", tone.time)}>
              {tsInterrupt.time} · {tsInterrupt.date}
            </span>
          )}
        </div>
        <p className={cn("text-xs leading-relaxed font-medium", tone.body)}>
          {isReturned ? (
            t('milestones.returnedFallback')
          ) : activeJob.cancellation_reason ? (
            <span><b>{t('milestones.cancelledReason')}</b> {activeJob.cancellation_reason}</span>
          ) : (
            t('milestones.cancelledFallback')
          )}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6 mb-8">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-brand-muted">
          {t('milestones.sectionLabel')}
        </h3>
        {isInterrupted && (
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border", isReturned ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-red-500/10 text-red-400 border-red-500/30")}>
            <AlertTriangle className={cn("w-3 h-3", isReturned ? "text-amber-400" : "text-red-400")} />
            {isReturned ? t('milestones.returnedBadge') : t('milestones.interruptedBadge')}
          </span>
        )}
      </div>

      <div className="relative pl-6 sm:pl-8 border-l-2 border-brand-input-border space-y-8 ml-2 sm:ml-4">
        {/* Step 1: Corridor Manifest Booked */}
        <div className="relative">
          <div className={cn(
            "absolute -left-[31px] sm:-left-[39px] top-0 w-4 h-4 rounded-full border-4 border-brand-bg transition-all flex items-center justify-center",
            !isInterrupted && statusConfig.stepIndex === 0 ? "bg-brand-neon shadow-[0_0_12px_rgba(57,255,20,0.8)]" : "bg-brand-neon shadow-[0_0_8px_rgba(57,255,20,0.4)]"
          )} />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-text flex items-center gap-1.5">
              <span>{t('milestones.step1.label')}</span>
              <Check className="w-3 h-3 text-brand-neon" />
            </p>
            {ts1 && <span className="text-[11px] text-brand-muted font-mono">{ts1.time} · {ts1.date}</span>}
          </div>
          <p className="text-xs text-brand-muted mt-0.5">
            {t('milestones.step1.desc')} <b>{activeJob.pickup_emirate}</b>
          </p>
        </div>

        {/* If cancelled right after Step 1 */}
        {isInterrupted && lastCompletedStep === 1 && renderInterruptionNode()}

        {/* Step 2: Pilot Arrival & Sender Handover */}
        <div className={cn("relative", isInterrupted && !step2Done && "opacity-40")}>
          <div className={cn(
            "absolute -left-[31px] sm:-left-[39px] top-0 w-4 h-4 rounded-full border-4 border-brand-bg transition-all",
            step2Done ? "bg-brand-neon shadow-[0_0_8px_rgba(57,255,20,0.4)]" :
              !isInterrupted && statusConfig.stepIndex === 1 ? "bg-brand-neon shadow-[0_0_12px_rgba(57,255,20,0.8)]" :
                "bg-brand-input-border"
          )} />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-text flex items-center gap-1.5">
              <span>{t('milestones.step2.label')}</span>
              {step2Done && <Check className="w-3 h-3 text-brand-neon" />}
              {isInterrupted && !step2Done && (
                <span className="text-[9px] px-1.5 py-0.2 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-mono">{t('milestones.aborted')}</span>
              )}
            </p>
            {ts2 && <span className="text-[11px] text-brand-muted font-mono">{ts2.time} · {ts2.date}</span>}
          </div>
          <p className="text-xs text-brand-muted mt-0.5">
            {hasDriver
              ? t('milestones.step2.descAssigned')
              : t('milestones.step2.descPending')}
          </p>
        </div>

        {/* If cancelled right after Step 2 */}
        {isInterrupted && lastCompletedStep === 2 && renderInterruptionNode()}

        {/* Step 3: Picked Up & In Dedicated Transit */}
        <div className={cn("relative", isInterrupted && !step3Done && "opacity-40")}>
          <div className={cn(
            "absolute -left-[31px] sm:-left-[39px] top-0 w-4 h-4 rounded-full border-4 border-brand-bg transition-all",
            step3Done ? "bg-brand-neon shadow-[0_0_8px_rgba(57,255,20,0.4)]" :
              !isInterrupted && statusConfig.stepIndex === 2 ? "bg-brand-neon shadow-[0_0_12px_rgba(57,255,20,0.8)]" :
                "bg-brand-input-border"
          )} />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-text flex items-center gap-1.5">
              <span>{t('milestones.step3.label')}</span>
              {step3Done && <Check className="w-3 h-3 text-brand-neon" />}
              {isInterrupted && !step3Done && (
                <span className="text-[9px] px-1.5 py-0.2 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-mono">{t('milestones.aborted')}</span>
              )}
            </p>
            {ts3 && <span className="text-[11px] text-brand-muted font-mono">{ts3.time} · {ts3.date}</span>}
          </div>
          <p className="text-xs text-brand-muted mt-0.5">
            {t('milestones.step3.desc')} <b>{activeJob.pickup_emirate}</b> {t('milestones.step3DescAnd')} <b>{activeJob.delivery_emirate}</b>.
          </p>
        </div>

        {/* If cancelled right after Step 3 */}
        {isInterrupted && lastCompletedStep === 3 && renderInterruptionNode()}

        {/* Step 4: Destination Arrival */}
        <div className={cn("relative", isInterrupted && !step4Done && "opacity-40")}>
          <div className={cn(
            "absolute -left-[31px] sm:-left-[39px] top-0 w-4 h-4 rounded-full border-4 border-brand-bg transition-all",
            step4Done ? "bg-brand-neon shadow-[0_0_8px_rgba(57,255,20,0.4)]" :
              !isInterrupted && statusConfig.stepIndex === 3 ? "bg-brand-neon shadow-[0_0_12px_rgba(57,255,20,0.8)]" :
                "bg-brand-input-border"
          )} />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-text flex items-center gap-1.5">
              <span>{t('milestones.step4.label')}</span>
              {step4Done && <Check className="w-3 h-3 text-brand-neon" />}
              {isInterrupted && !step4Done && (
                <span className="text-[9px] px-1.5 py-0.2 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-mono">{t('milestones.aborted')}</span>
              )}
            </p>
            {ts4 && <span className="text-[11px] text-brand-muted font-mono">{ts4.time} · {ts4.date}</span>}
          </div>
          <p className="text-xs text-brand-muted mt-0.5">
            {t('milestones.step4.descTemplate', { location: activeJob.delivery_location, emirate: activeJob.delivery_emirate })}
          </p>
        </div>

        {/* If cancelled right after Step 4 */}
        {isInterrupted && lastCompletedStep === 4 && renderInterruptionNode()}

        {/* Step 5: Final Delivery Handover */}
        <div className={cn("relative", isInterrupted && !step5Done && "opacity-40")}>
          <div className={cn(
            "absolute -left-[31px] sm:-left-[39px] top-0 w-4 h-4 rounded-full border-4 border-brand-bg transition-all",
            step5Done ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" :
              !isInterrupted && statusConfig.stepIndex === 4 ? "bg-brand-neon shadow-[0_0_12px_rgba(57,255,20,0.8)]" :
                "bg-brand-input-border"
          )} />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-text flex items-center gap-1.5">
              <span>{t('milestones.step5.label')}</span>
              {step5Done && <Check className="w-3 h-3 text-emerald-400" />}
              {isInterrupted && !step5Done && (
                <span className="text-[9px] px-1.5 py-0.2 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-mono">{t('milestones.unfulfilled')}</span>
              )}
            </p>
            {ts5 && <span className="text-[11px] text-emerald-400 font-mono font-bold">{ts5.time} · {ts5.date}</span>}
          </div>
          <p className="text-xs text-brand-muted mt-0.5">
            {step5Done
              ? t('milestones.step5.descDone')
              : isInterrupted
                ? (isReturned ? t('milestones.step5.descReturned') : t('milestones.step5.descCancelled'))
                : t('milestones.step5.descPending')}
          </p>
        </div>
      </div>
    </div>
  );
}
