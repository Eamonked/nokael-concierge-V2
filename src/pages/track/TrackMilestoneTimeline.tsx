import { AlertTriangle, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { JobWithDriver } from '../../lib/supabase';
import type { StatusConfig } from './statusConfig';
import { computeCustodyMilestones } from './custodyMilestones';

interface TrackMilestoneTimelineProps {
  activeJob: JobWithDriver;
  statusConfig: StatusConfig;
}

export default function TrackMilestoneTimeline({ activeJob, statusConfig }: TrackMilestoneTimelineProps) {
  const hasDriver = !!(activeJob.driver || activeJob.driver_id);
  const m = computeCustodyMilestones(activeJob);
  const { ts1, ts2, ts3, ts4, ts5, tsCancel, isCancelled, step2Done, step3Done, step4Done, step5Done, lastCompletedStep } = m;

  const renderCancellationNode = () => (
    <div className="relative p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300">
      <div className="absolute -left-[31px] sm:-left-[39px] top-4 w-4 h-4 rounded-full border-4 border-brand-bg bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.9)] flex items-center justify-center" />
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          <p className="text-xs font-black uppercase tracking-wider text-red-400">
            Mission Interrupted / Dispatch Cancelled
          </p>
        </div>
        {tsCancel && (
          <span className="text-[11px] text-red-400/80 font-mono font-bold">
            {tsCancel.time} · {tsCancel.date}
          </span>
        )}
      </div>
      <p className="text-xs text-red-300/90 leading-relaxed font-medium">
        {activeJob.cancellation_reason ? (
          <span><b>Reason:</b> {activeJob.cancellation_reason}</span>
        ) : (
          'Dispatch operations terminated before final handover completion.'
        )}
      </p>
    </div>
  );

  return (
    <div className="space-y-6 mb-8">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-brand-muted">
          Chain of Custody Milestones
        </h3>
        {activeJob.status === 'cancelled' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/30">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            Execution Interrupted
          </span>
        )}
      </div>

      <div className="relative pl-6 sm:pl-8 border-l-2 border-brand-input-border space-y-8 ml-2 sm:ml-4">
        {/* Step 1: Corridor Manifest Booked */}
        <div className="relative">
          <div className={cn(
            "absolute -left-[31px] sm:-left-[39px] top-0 w-4 h-4 rounded-full border-4 border-brand-bg transition-all flex items-center justify-center",
            !isCancelled && statusConfig.stepIndex === 0 ? "bg-brand-neon shadow-[0_0_12px_rgba(57,255,20,0.8)]" : "bg-brand-neon shadow-[0_0_8px_rgba(57,255,20,0.4)]"
          )} />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-text flex items-center gap-1.5">
              <span>1. Corridor Manifest Booked</span>
              <Check className="w-3 h-3 text-brand-neon" />
            </p>
            {ts1 && <span className="text-[11px] text-brand-muted font-mono">{ts1.time} · {ts1.date}</span>}
          </div>
          <p className="text-xs text-brand-muted mt-0.5">
            Logged into dispatch queue. Origin: <b>{activeJob.pickup_emirate}</b>
          </p>
        </div>

        {/* If cancelled right after Step 1 */}
        {isCancelled && lastCompletedStep === 1 && renderCancellationNode()}

        {/* Step 2: Pilot Arrival & Sender Handover */}
        <div className={cn("relative", isCancelled && !step2Done && "opacity-40")}>
          <div className={cn(
            "absolute -left-[31px] sm:-left-[39px] top-0 w-4 h-4 rounded-full border-4 border-brand-bg transition-all",
            step2Done ? "bg-brand-neon shadow-[0_0_8px_rgba(57,255,20,0.4)]" :
              !isCancelled && statusConfig.stepIndex === 1 ? "bg-brand-neon shadow-[0_0_12px_rgba(57,255,20,0.8)]" :
                "bg-brand-input-border"
          )} />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-text flex items-center gap-1.5">
              <span>2. Pilot Arrival & Sender Handover</span>
              {step2Done && <Check className="w-3 h-3 text-brand-neon" />}
              {isCancelled && !step2Done && (
                <span className="text-[9px] px-1.5 py-0.2 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-mono">Aborted</span>
              )}
            </p>
            {ts2 && <span className="text-[11px] text-brand-muted font-mono">{ts2.time} · {ts2.date}</span>}
          </div>
          <p className="text-xs text-brand-muted mt-0.5">
            {hasDriver
              ? 'Assigned pilot arriving at pickup point.'
              : 'Awaiting pilot dispatch arrival confirmation.'}
          </p>
        </div>

        {/* If cancelled right after Step 2 */}
        {isCancelled && lastCompletedStep === 2 && renderCancellationNode()}

        {/* Step 3: Picked Up & In Dedicated Transit */}
        <div className={cn("relative", isCancelled && !step3Done && "opacity-40")}>
          <div className={cn(
            "absolute -left-[31px] sm:-left-[39px] top-0 w-4 h-4 rounded-full border-4 border-brand-bg transition-all",
            step3Done ? "bg-brand-neon shadow-[0_0_8px_rgba(57,255,20,0.4)]" :
              !isCancelled && statusConfig.stepIndex === 2 ? "bg-brand-neon shadow-[0_0_12px_rgba(57,255,20,0.8)]" :
                "bg-brand-input-border"
          )} />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-text flex items-center gap-1.5">
              <span>3. Picked Up & In Dedicated Transit</span>
              {step3Done && <Check className="w-3 h-3 text-brand-neon" />}
              {isCancelled && !step3Done && (
                <span className="text-[9px] px-1.5 py-0.2 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-mono">Aborted</span>
              )}
            </p>
            {ts3 && <span className="text-[11px] text-brand-muted font-mono">{ts3.time} · {ts3.date}</span>}
          </div>
          <p className="text-xs text-brand-muted mt-0.5">
            Parcel secured. Direct non-stop transit between <b>{activeJob.pickup_emirate}</b> and <b>{activeJob.delivery_emirate}</b>.
          </p>
        </div>

        {/* If cancelled right after Step 3 */}
        {isCancelled && lastCompletedStep === 3 && renderCancellationNode()}

        {/* Step 4: Destination Arrival */}
        <div className={cn("relative", isCancelled && !step4Done && "opacity-40")}>
          <div className={cn(
            "absolute -left-[31px] sm:-left-[39px] top-0 w-4 h-4 rounded-full border-4 border-brand-bg transition-all",
            step4Done ? "bg-brand-neon shadow-[0_0_8px_rgba(57,255,20,0.4)]" :
              !isCancelled && statusConfig.stepIndex === 3 ? "bg-brand-neon shadow-[0_0_12px_rgba(57,255,20,0.8)]" :
                "bg-brand-input-border"
          )} />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-text flex items-center gap-1.5">
              <span>4. Destination Arrival</span>
              {step4Done && <Check className="w-3 h-3 text-brand-neon" />}
              {isCancelled && !step4Done && (
                <span className="text-[9px] px-1.5 py-0.2 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-mono">Aborted</span>
              )}
            </p>
            {ts4 && <span className="text-[11px] text-brand-muted font-mono">{ts4.time} · {ts4.date}</span>}
          </div>
          <p className="text-xs text-brand-muted mt-0.5">
            Pilot at {activeJob.delivery_location}, {activeJob.delivery_emirate}. Initiating recipient verification.
          </p>
        </div>

        {/* If cancelled right after Step 4 */}
        {isCancelled && lastCompletedStep === 4 && renderCancellationNode()}

        {/* Step 5: Final Delivery Handover */}
        <div className={cn("relative", isCancelled && !step5Done && "opacity-40")}>
          <div className={cn(
            "absolute -left-[31px] sm:-left-[39px] top-0 w-4 h-4 rounded-full border-4 border-brand-bg transition-all",
            step5Done ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" :
              !isCancelled && statusConfig.stepIndex === 4 ? "bg-brand-neon shadow-[0_0_12px_rgba(57,255,20,0.8)]" :
                "bg-brand-input-border"
          )} />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-text flex items-center gap-1.5">
              <span>5. Delivered & Handover Confirmed</span>
              {step5Done && <Check className="w-3 h-3 text-emerald-400" />}
              {isCancelled && !step5Done && (
                <span className="text-[9px] px-1.5 py-0.2 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-mono">Unfulfilled</span>
              )}
            </p>
            {ts5 && <span className="text-[11px] text-emerald-400 font-mono font-bold">{ts5.time} · {ts5.date}</span>}
          </div>
          <p className="text-xs text-brand-muted mt-0.5">
            {step5Done
              ? 'Final receipt validated. Complete Chain of Custody digitally signed.'
              : isCancelled
                ? 'Delivery handover was not completed due to cancellation.'
                : 'Final receipt validated. Complete Chain of Custody digitally signed.'}
          </p>
        </div>
      </div>
    </div>
  );
}
