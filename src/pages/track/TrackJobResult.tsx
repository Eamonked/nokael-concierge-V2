import { Truck, RefreshCw, Copy, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import type { JobWithDriver, TrackingResult } from '../../lib/supabase';
import type { StatusConfig } from './statusConfig';
import TrackStatusBanner from './TrackStatusBanner';
import TrackMilestoneTimeline from './TrackMilestoneTimeline';
import TrackRoutePanel from './TrackRoutePanel';
import TrackPilotPanel from './TrackPilotPanel';

interface TrackJobResultProps {
  activeJob: JobWithDriver;
  statusConfig: StatusConfig;
  result: TrackingResult;
  realtimeConnected: boolean;
  isRefreshing: boolean;
  copiedLink: boolean;
  onRefresh: () => void;
  onCopyLink: () => void;
  currentTrackingId: string;
}

export default function TrackJobResult({
  activeJob,
  statusConfig,
  result,
  realtimeConnected,
  isRefreshing,
  copiedLink,
  onRefresh,
  onCopyLink,
  currentTrackingId,
}: TrackJobResultProps) {
  return (
    <motion.div
      key={`job-${activeJob.id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-6"
    >
      {/* Primary Status Card */}
      <div className="dispatch-card relative overflow-hidden border border-brand-border bg-brand-surface/70 shadow-2xl">

        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-brand-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-input border border-brand-input-border flex items-center justify-center text-brand-neon">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">
                  Dispatch Reference
                </span>
                {realtimeConnected && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-bold border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Sync
                  </span>
                )}
              </div>
              <p className="text-2xl font-display font-medium tracking-tight text-brand-text">
                {activeJob.job_ref || result.trackingId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-brand-input border border-brand-input-border text-brand-muted hover:text-brand-text hover:border-brand-border transition-all disabled:opacity-50"
              title="Refresh State"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin text-brand-neon")} />
            </button>
            <button
              type="button"
              onClick={onCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-input border border-brand-input-border text-xs font-semibold text-brand-text hover:border-brand-neon/40 transition-all"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-brand-muted" />}
              <span>{copiedLink ? 'Copied' : 'Share Link'}</span>
            </button>
          </div>
        </div>

        <TrackStatusBanner statusConfig={statusConfig} activeJob={activeJob} />
        <TrackMilestoneTimeline activeJob={activeJob} statusConfig={statusConfig} />
      </div>

      {/* Route & Manifest Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TrackRoutePanel activeJob={activeJob} />
        <TrackPilotPanel activeJob={activeJob} currentTrackingId={currentTrackingId} />
      </div>
    </motion.div>
  );
}
