import React from 'react';
import { LayoutDashboard, Activity, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { KanbanColumn } from './components/KanbanColumn';
import type { JobWithDriver } from '../../lib/supabase';
import type { JobStatusFilter } from './selectors';

interface PipelineViewProps {
  jobs: JobWithDriver[];
  filteredJobs: JobWithDriver[];
  jobViewMode: 'kanban' | 'list';
  setJobViewMode: (mode: 'kanban' | 'list') => void;
  jobStatusFilter: JobStatusFilter;
  setJobStatusFilter: (filter: JobStatusFilter) => void;
  onNewJob: () => void;
  onJobClick: (job: JobWithDriver) => void;
}

export function PipelineView({
  jobs,
  filteredJobs,
  jobViewMode,
  setJobViewMode,
  jobStatusFilter,
  setJobStatusFilter,
  onNewJob,
  onJobClick,
}: PipelineViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-brand-surface border border-brand-border rounded-xl p-1">
            <button 
              onClick={() => setJobViewMode('kanban')}
              className={cn(
                "flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-all",
                jobViewMode === 'kanban' ? "bg-brand-neon/10 text-brand-neon" : "text-brand-muted hover:text-brand-text"
              )}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Board
            </button>
            <button 
              onClick={() => setJobViewMode('list')}
              className={cn(
                "flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-all",
                jobViewMode === 'list' ? "bg-brand-neon/10 text-brand-neon" : "text-brand-muted hover:text-brand-text"
              )}
            >
              <Activity className="w-3.5 h-3.5" />
              List
            </button>
          </div>

          <div className="flex items-center gap-1 bg-brand-surface border border-brand-border rounded-xl p-1">
            {[
              { key: 'all', label: 'All', count: jobs.length },
              { key: 'pending', label: 'Pending', count: jobs.filter(j => j.status === 'pending').length },
              { key: 'in_transit', label: 'In Transit', count: jobs.filter(j => ['client_pickup', 'driver_pickup', 'driver_delivery'].includes(j.status)).length },
              { key: 'completed', label: 'Completed', count: jobs.filter(j => j.status === 'completed').length },
              { key: 'cancelled', label: 'Cancelled', count: jobs.filter(j => j.status === 'cancelled').length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setJobStatusFilter(tab.key as any)}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-all",
                  jobStatusFilter === tab.key 
                    ? tab.key === 'cancelled' ? "bg-red-500/10 text-red-400 font-semibold" : "bg-brand-neon/10 text-brand-neon font-semibold"
                    : "text-brand-muted hover:text-brand-text"
                )}
              >
                {tab.label}
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                  jobStatusFilter === tab.key 
                    ? tab.key === 'cancelled' ? "bg-red-500/20 text-red-400" : "bg-brand-neon/20 text-brand-neon" 
                    : "bg-brand-input text-brand-muted"
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={onNewJob}
          className="flex items-center gap-2 bg-brand-neon text-brand-bg px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90 active:scale-95 transition-all self-end sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          New Job
        </button>
      </div>

      {jobViewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-[calc(100vh-320px)] min-h-[560px]">
          <KanbanColumn 
            title="Pending" 
            status="pending" 
            jobs={filteredJobs.filter(j => j.status === 'pending')} 
            onJobClick={onJobClick} 
          />
          <KanbanColumn 
            title="In Transit" 
            status="in_transit" 
            jobs={filteredJobs.filter(j => ['client_pickup', 'driver_pickup', 'driver_delivery'].includes(j.status))} 
            onJobClick={onJobClick} 
          />
          <KanbanColumn 
            title="Completed" 
            status="completed" 
            jobs={filteredJobs.filter(j => j.status === 'completed')} 
            onJobClick={onJobClick} 
          />
          <KanbanColumn 
            title="Cancelled" 
            status="cancelled" 
            jobs={filteredJobs.filter(j => j.status === 'cancelled')} 
            onJobClick={onJobClick} 
          />
        </div>
      ) : (
        <div className="dispatch-card p-0 overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] font-medium text-brand-muted border-b border-brand-border">
                  <th className="pl-6 pr-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Corridor</th>
                  <th className="px-4 py-3 font-medium">Driver</th>
                  <th className="px-4 py-3 font-medium w-[160px]">Custody</th>
                  <th className="pl-4 pr-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => {
                  const stageColor =
                    job.status === 'completed' ? 'var(--color-stage-complete)' :
                    job.status === 'cancelled' ? 'var(--color-stage-cancelled)' :
                    job.status === 'pending' ? 'var(--color-stage-pending)' :
                    'var(--color-stage-transit)';
                  const custodySteps = [
                    { key: 'client_pickup_at', label: 'Sender handover' },
                    { key: 'driver_pickup_at', label: 'Driver pickup' },
                    { key: 'driver_delivery_at', label: 'Inbound' },
                    { key: 'client_delivery_at', label: 'Delivered' }
                  ];
                  return (
                    <tr
                      key={job.id}
                      className="manifest-row border-b border-brand-border last:border-0 hover:bg-brand-surface/40 cursor-pointer"
                      style={{ '--row-spine': stageColor } as React.CSSProperties}
                      onClick={() => onJobClick(job)}
                    >
                      <td className="pl-6 pr-4 py-4 relative">
                          <div className="manifest-ref text-sm font-medium text-brand-text mb-1.5">{job.job_ref?.toString().padStart(4, '0')}</div>
                          <div className="flex items-center gap-1.5">
                            <span className="stage-dot" style={{ '--dot-color': stageColor } as React.CSSProperties} />
                            <span className="text-xs text-brand-muted capitalize">{job.status?.replace('_', ' ')}</span>
                          </div>
                          {job.status === 'cancelled' && job.cancellation_reason && (
                            <p className="text-[10px] text-brand-muted/70 mt-1 line-clamp-1 max-w-[160px]">
                              {job.cancellation_reason}
                            </p>
                          )}
                      </td>
                      <td className="px-4 py-4">
                          <div className="manifest-corridor text-sm font-medium text-brand-text mb-1">
                            {(job.pickup_emirate || '').slice(0, 3).toUpperCase() || 'DXB'} → {(job.delivery_emirate || '').slice(0, 3).toUpperCase() || 'AUH'}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-brand-muted">
                            <span className="truncate max-w-[110px]">{job.pickup_location}</span>
                            <span className="opacity-40">–</span>
                            <span className="truncate max-w-[110px]">{job.delivery_location}</span>
                          </div>
                      </td>
                      <td className="px-4 py-4">
                          {job.driver ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full border border-brand-input-border flex items-center justify-center shrink-0 text-[10px] font-mono text-brand-muted">
                                {job.driver.full_name?.charAt(0) || '?'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-brand-text truncate">{job.driver.full_name}</p>
                                <p className="text-[10px] text-brand-muted font-mono">{job.driver.phone}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-brand-muted">Unassigned</span>
                          )}
                      </td>
                      <td className="px-4 py-4">
                          <div className="custody-strip" style={{ '--seg-color': stageColor } as React.CSSProperties}>
                            {custodySteps.map((step) => (
                              <span key={step.key} title={step.label} data-done={Boolean((job as any)[step.key])} />
                            ))}
                          </div>
                      </td>
                      <td className="pl-4 pr-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onJobClick(job);
                          }}
                          className="text-xs font-medium text-brand-muted hover:text-brand-text transition-colors underline decoration-brand-border hover:decoration-brand-text underline-offset-4"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
