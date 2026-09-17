import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, MapPin, ChevronRight, Navigation, User } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../../lib/utils';
import type { Job, JobStatus } from '../../../lib/supabase';

export const KanbanColumn = ({ title, status, jobs, onJobClick }: { title: string, status: JobStatus | 'in_transit', jobs: Job[], onJobClick: (job: Job) => void }) => {
  return (
    <div className="flex flex-col h-full bg-brand-surface/30 rounded-3xl border border-brand-border/50 overflow-hidden">
      <div className="p-5 border-b border-brand-border flex justify-between items-center bg-brand-surface/50">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "w-2.5 h-2.5 rounded-full animate-pulse",
            status === 'pending' ? "bg-yellow-500" :
            status === 'client_pickup' || status === 'driver_pickup' ? "bg-blue-500" :
            status === 'driver_delivery' ? "bg-purple-500" : 
            status === 'cancelled' ? "bg-red-500" : "bg-brand-neon"
          )} />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-text">{title}</h3>
        </div>
        <span className={cn(
          "text-xs font-mono font-semibold px-2 py-0.5 rounded border",
          status === 'cancelled' && jobs.length > 0 ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-brand-bg text-brand-muted border-brand-border"
        )}>{jobs.length}</span>
      </div>
      <div className="p-3.5 flex-grow overflow-y-auto no-scrollbar space-y-3">
        {jobs.map((job) => (
          <motion.div
            layoutId={job.id}
            key={job.id}
            onClick={() => onJobClick(job)}
            className={cn(
              "dispatch-card p-4 cursor-pointer transition-all group relative",
              job.status === 'cancelled' 
                ? "border-red-500/30 hover:border-red-500/60 bg-red-950/10" 
                : "hover:border-brand-neon/50"
            )}
          >
            <div className="flex justify-between items-start mb-3">
              <span className={cn(
                "text-[11px] font-semibold font-mono px-2 py-0.5 rounded",
                job.status === 'cancelled' 
                  ? "text-red-400 bg-red-500/10" 
                  : "text-brand-neon bg-brand-neon/10"
              )}>
                #{job.job_ref?.toString().padStart(4, '0')}
              </span>
              <span className="text-[11px] font-medium text-brand-muted">{format(new Date(job.created_at || new Date()), 'HH:mm')}</span>
            </div>

            {job.status === 'cancelled' && (
              <div className="mb-3 px-2.5 py-1 bg-red-500/15 border border-red-500/30 rounded-lg flex items-center gap-1.5 text-red-400 text-xs font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{job.cancellation_reason || 'Failed / Cancelled'}</span>
              </div>
            )}

            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-brand-muted shrink-0" />
                <p className="text-xs font-medium truncate">{job.pickup_location}</p>
              </div>
              <ChevronRight className="w-3 h-3 text-brand-muted mx-auto" />
              <div className="flex items-center gap-2">
                <Navigation className="w-3 h-3 text-brand-muted shrink-0" />
                <p className="text-xs font-medium truncate">{job.delivery_location}</p>
              </div>
            </div>

            {/* COC Mini Progress Bar */}
            <div className="flex items-center gap-1 my-3 pt-2 border-t border-brand-border/60">
              {[
                { key: 'client_pickup_at', label: 'Sender' },
                { key: 'driver_pickup_at', label: 'Driver' },
                { key: 'driver_delivery_at', label: 'Arrive' },
                { key: 'client_delivery_at', label: 'Signed' }
              ].map((step, idx) => (
                <div 
                  key={step.key} 
                  title={step.label}
                  className={cn(
                    "flex-1 h-1.5 rounded-full transition-colors",
                    (job as any)[step.key] ? "bg-brand-neon" : "bg-brand-input"
                  )} 
                />
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-brand-border">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-5 h-5 rounded-full bg-brand-input flex items-center justify-center border border-brand-border shrink-0">
                  <User className="w-2.5 h-2.5 text-brand-muted" />
                </div>
                <span className="text-xs text-brand-muted font-medium truncate max-w-[90px]">{job.sender_name}</span>
              </div>
              <div className={cn(
                "px-2 py-0.5 rounded text-[11px] font-medium shrink-0",
                job.urgency === 'immediate' ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                job.urgency === 'today' ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" :
                "bg-blue-500/10 text-blue-500 border border-blue-500/20"
              )}>
                {job.urgency}
              </div>
            </div>
          </motion.div>
        ))}
        {jobs.length === 0 && (
          <div className="h-32 flex items-center justify-center border-2 border-dashed border-brand-border rounded-2xl opacity-30">
            <span className="text-xs font-medium">Clear</span>
          </div>
        )}
      </div>
    </div>
  );
};
