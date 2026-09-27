import React from 'react';
import type { JobWithDriver, Driver } from '../../lib/supabase';
import { assignDriverToJob, updateJob, overrideCocStep } from '../../lib/supabase';
import {
  jobStage, stageSteps, nextAction, noteLocalStageChange, STAGE_LABEL, STAGE_TONE, NEXT_ACTION_LABEL, type JobStage, type NextAction,
} from '../../lib/jobStage';
import { useCanWrite, READ_ONLY_MESSAGE } from './permissions';
import { generateJobPOC } from '../../lib/pdf-export';
import { formatDate } from './utils';
import { Zap, Clock, CheckCircle2, Users, Truck } from 'lucide-react';

const shortDate = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(value));
const clock = (value: string) =>
  new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
import { Icon } from './components/Icon';
import { Avatar } from './components/Avatar';
import { DateRangeSelector, useDateRange } from './components/DateRangeSelector';
import { Status, type StatusKind } from './components/StatusBadge';
import { StatCard } from './components/StatCard';
import { JobOperations, JOB_CONTROLS_ID } from './components/JobOperations';

/* ------------------------------------------------------------------ */
/* Jobs workspace — list + active card on the left, job detail on the  */
/* right (driver, corridor, route map, chain-of-custody timeline).     */
/* Ported from the Dashboard UI reference's jobs-patch layout, wired   */
/* to real Supabase jobs/drivers instead of mock data.                 */
/* ------------------------------------------------------------------ */

type JobFilter = 'All' | 'Pending' | 'In transit' | 'Completed' | 'Returned' | 'Cancelled';
const JOB_FILTERS: JobFilter[] = ['All', 'Pending', 'In transit', 'Completed', 'Returned', 'Cancelled'];

function matchesFilter(job: JobWithDriver, filter: JobFilter): boolean {
  if (filter === 'All') return true;
  if (filter === 'Pending') return job.status === 'pending';
  if (filter === 'In transit') return ['client_pickup', 'driver_pickup', 'driver_delivery'].includes(job.status);
  if (filter === 'Completed') return job.status === 'completed';
  if (filter === 'Returned') return job.status === 'returned';
  if (filter === 'Cancelled') return job.status === 'cancelled';
  return true;
}

function statusDotClass(stage: JobStage) {
  if (stage === 'completed' || stage === 'dropped_off') return 'completed';
  if (stage === 'cancelled') return 'cancelled';
  if (stage === 'returned') return 'returned';
  if (stage === 'unassigned') return '';
  return 'in-transit';
}

const TONE_KIND: Record<(typeof STAGE_TONE)[JobStage], StatusKind> = {
  neutral: 'neutral', moving: 'info', attention: 'warning', done: 'success', bad: 'danger',
};

export function StageBadge({ job }: { job: JobWithDriver }) {
  const stage = jobStage(job);
  return <Status kind={stage === 'cancelled' ? 'neutral' : TONE_KIND[STAGE_TONE[stage]]}>{STAGE_LABEL[stage]}</Status>;
}

// Rough emirate positions for the corridor sketch — the same static geography
// used by the reference mockup. Real GPS routing isn't in scope here; this is
// a visual corridor indicator, not a navigational map.
const emiratePoints: Record<string, { x: number; y: number }> = {
  'Abu Dhabi': { x: 78, y: 232 },
  Dubai: { x: 205, y: 132 },
  Sharjah: { x: 240, y: 108 },
  Ajman: { x: 258, y: 90 },
  RAK: { x: 314, y: 54 },
  'Ras Al Khaimah': { x: 314, y: 54 },
  Fujairah: { x: 340, y: 118 },
  'UMM Al Quwain': { x: 270, y: 76 },
};

function useClickAway(ref: React.RefObject<HTMLElement | null>, active: boolean, onAway: () => void) {
  React.useEffect(() => {
    if (!active) return;
    const handle = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onAway();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [ref, active, onAway]);
}

function RouteMap({ from, to, onExpand }: { from: string; to: string; onExpand: () => void }) {
  const a = emiratePoints[from] ?? emiratePoints.Dubai;
  const b = emiratePoints[to] ?? emiratePoints['Abu Dhabi'];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const bow = Math.min(26, length / 4);
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const nx = -dy / length;
  const ny = dx / length;
  const route = `M${a.x} ${a.y} Q${midX + nx * bow} ${midY + ny * bow} ${b.x} ${b.y}`;

  return (
    <div className="jw-map">
      <svg viewBox="0 0 400 280" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Route from ${from} to ${to}`}>
        <rect width="400" height="280" fill="#ecedef" />
        <path d="M0 0H330L318 34L272 74L226 108L178 138L120 190L60 222L0 224Z" fill="#d5dde5" />
        <path d="M360 80L400 70V210L352 190Z" fill="#d5dde5" />
        <path
          d="M78 232L205 132L240 108L258 90L314 54"
          stroke="#ffffff" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round"
        />
        <path d="M205 132L272 128L340 118" stroke="#ffffff" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d={route} stroke="#b8d62b" strokeWidth="5" fill="none" strokeLinecap="round" />
        {Object.entries(emiratePoints)
          .filter(([name]) => name !== 'Ras Al Khaimah') // avoid drawing the RAK duplicate twice
          .map(([name, point]) => {
            const active = name === from || name === to;
            return (
              <g key={name}>
                <circle cx={point.x} cy={point.y} r={active ? 6 : 3.5} fill={active ? '#ffffff' : '#8b8f96'} stroke={active ? '#171719' : 'none'} strokeWidth="2.5" />
                <text x={point.x + 10} y={point.y + 4} fontSize={active ? 12 : 10} fontWeight={active ? 700 : 500} fill={active ? '#171719' : '#6b6f76'}>
                  {name}
                </text>
              </g>
            );
          })}
      </svg>
      <button className="jw-map-expand" onClick={onExpand} aria-label="Open live map" title="Open live map">
        <Icon name="expand" size={16} />
      </button>
    </div>
  );
}

function JobList({
  jobs, selectedRef, filter, setFilter, search, setSearch, dateRange, onSelect, onNew,
}: {
  jobs: JobWithDriver[];
  selectedRef: string | null;
  filter: JobFilter;
  setFilter: (f: JobFilter) => void;
  search: string;
  setSearch: (v: string) => void;
  dateRange: ReturnType<typeof useDateRange>;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <section className="jw-card jw-list">
      <header className="jw-list-head">
        <h2>
          Jobs <span className="jw-count">{jobs.length}</span>
        </h2>
        <button className="jw-round jw-accent" onClick={onNew} aria-label="New job" title="New job">
          <Icon name="plus" size={18} />
        </button>
      </header>
      <div className="jw-search-row">
        <label className="jw-search">
          <Icon name="search" size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search job, customer or route" />
        </label>
        <DateRangeSelector range={dateRange} />
      </div>
      <div className="jw-filters">
        {JOB_FILTERS.map((item) => (
          <button key={item} className={filter === item ? 'selected' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="jw-table-head">
        <span>ID</span>
        <span>Route</span>
        <span>Pickup</span>
        <span>Urgency</span>
      </div>
      <div className="jw-rows">
        {jobs.map((job) => (
          <button key={job.id} className={`jw-row ${selectedRef === job.id ? 'selected' : ''}`} onClick={() => onSelect(job.id!)}>
            <span className="jw-id">
              <i className={`jw-dot ${statusDotClass(jobStage(job))}`} title={STAGE_LABEL[jobStage(job)]} />
              {job.job_ref || job.id?.slice(0, 8)}
            </span>
            <span className="jw-route" title={`${job.pickup_location} → ${job.delivery_location}`}>
              {job.pickup_emirate} – {job.delivery_emirate}
            </span>
            <span className="jw-when">{job.scheduled_pickup_at ? formatDate(job.scheduled_pickup_at) : job.created_at ? formatDate(job.created_at) : '—'}</span>
            <strong className="jw-tier">{job.urgency}</strong>
          </button>
        ))}
        {!jobs.length && <div className="jw-empty">No jobs match these filters</div>}
      </div>
    </section>
  );
}

function JobDetailPanel({
  job, drivers, onOpenMap, onAdvance, onAssign, onEdit, onDuplicate, onUpdate, canCancel,
}: {
  job: JobWithDriver;
  drivers: Driver[];
  onOpenMap: () => void;
  onAdvance: () => void;
  onAssign: (driverId: string | null) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onUpdate: () => void | Promise<void>;
  /** False for viewers: explains why instead of opening the dialog. */
  canCancel: () => boolean;
  key?: React.Key;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const pickerRef = React.useRef<HTMLDivElement>(null);
  useClickAway(menuRef, menuOpen, () => setMenuOpen(false));
  useClickAway(pickerRef, pickerOpen, () => setPickerOpen(false));

  const next = nextAction(job);
  const closed = ['completed', 'cancelled', 'returned'].includes(jobStage(job));

  // Same steps, in the same words, as the driver app's progress tracker.
  const pickupSide = new Set(['heading', 'at_pickup', 'picked_up']);
  const steps = stageSteps(job).map(step => ({
    ...step,
    place: step.key === 'booked' ? null : pickupSide.has(step.key) ? job.pickup_emirate : job.delivery_emirate,
  }));

  const copyRef = () => {
    navigator.clipboard?.writeText(job.job_ref || job.id || '').catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const choose = (action: () => void) => () => {
    setMenuOpen(false);
    action();
  };

  const driverPhoneDigits = job.driver?.phone ? job.driver.phone.replace(/\D/g, '') : '';

  return (
    <section className="jw-card jw-detail">
      <header className="jw-detail-head">
        <div>
          <span className="jw-label">Job ID</span>
          <div className="jw-idline">
            <h2>{job.job_ref || job.id?.slice(0, 8)}</h2>
            <button className="jw-copy" onClick={copyRef} aria-label="Copy job ID" title="Copy job ID">
              <Icon name={copied ? 'check' : 'copy'} size={17} />
            </button>
            <StageBadge job={job} />
          </div>
        </div>
        <div className="jw-head-actions">
          <button className="jw-ghost" onClick={onEdit}>Edit details</button>
          <button className="jw-primary" disabled={!next} onClick={onAdvance}
            title={next ? 'Record this step for the driver (use only if they can\'t do it in the app)' : undefined}>
            {next ? NEXT_ACTION_LABEL[next] : closed ? 'Job closed' : 'Waiting for driver'}
          </button>
          <div className="jw-menu-wrap" ref={menuRef}>
            <button className="jw-round" onClick={() => setMenuOpen((o) => !o)} aria-label={`More actions for ${job.job_ref}`} aria-expanded={menuOpen}>
              <Icon name="more" size={17} />
            </button>
            {menuOpen && (
              <div className="jw-menu" role="menu">
                <button role="menuitem" onClick={choose(() => setPickerOpen(true))}>
                  <Icon name="agents" size={15} />
                  Reassign driver
                </button>
                <button role="menuitem" onClick={choose(onDuplicate)}>
                  <Icon name="copy" size={15} />
                  Duplicate job
                </button>
                <button role="menuitem" onClick={choose(() => document.getElementById(JOB_CONTROLS_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))}>
                  <Icon name="settings" size={15} />
                  <span>
                    Dispatch controls
                    <small>Stage override &amp; audit notes</small>
                  </span>
                </button>
                {(job.status === 'completed' || !!job.client_delivery_at) && (
                  <button role="menuitem" onClick={choose(() => generateJobPOC(job))}>
                    <Icon name="download" size={15} />
                    <span>
                      Download proof of delivery
                      <small>PDF</small>
                    </span>
                  </button>
                )}
                {job.status !== 'cancelled' && job.status !== 'returned' && (
                  <button role="menuitem" className="danger" onClick={choose(() => { if (canCancel()) setCancelOpen(true); })}>
                    <Icon name="close" size={15} />
                    Cancel job
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="jw-agent" ref={pickerRef}>
        {job.driver?.full_name ? (
          <>
            <Avatar initials={job.driver.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()} tone={0} />
            <div className="jw-agent-name">
              <b>{job.driver.full_name}</b>
              <small>{job.driver.vehicle_type || '—'} · {job.driver.vehicle_plate || job.driver.phone}</small>
            </div>
            <div className="jw-contact">
              {driverPhoneDigits && (
                <a className="jw-circle chat" href={`https://wa.me/${driverPhoneDigits}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${job.driver.full_name}`} title="WhatsApp">
                  <Icon name="chat" size={18} />
                </a>
              )}
              {driverPhoneDigits && (
                <a className="jw-circle call" href={`tel:${driverPhoneDigits}`} aria-label={`Call ${job.driver.full_name}`} title="Call">
                  <Icon name="phone" size={17} />
                </a>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="jw-avatar-empty">
              <Icon name="plus" size={16} />
            </span>
            <div className="jw-agent-name">
              <b>Unassigned</b>
              <small>No driver on this job yet</small>
            </div>
            <button className="jw-primary small" onClick={() => setPickerOpen((o) => !o)}>Assign driver</button>
          </>
        )}
        {pickerOpen && (
          <div className="jw-picker">
            <div className="jw-picker-title">
              <b>Assign driver</b>
              <small>{job.job_ref} · pickup in {job.pickup_emirate}</small>
            </div>
            <button className={!job.driver_id ? 'selected' : ''} onClick={() => { onAssign(null); setPickerOpen(false); }}>
              <span className="jw-avatar-empty"><Icon name="close" size={14} /></span>
              <span><b>Unassigned</b></span>
            </button>
            {drivers.map((d, index) => (
              <button key={d.id} className={d.id === job.driver_id ? 'selected' : ''} onClick={() => { onAssign(d.id!); setPickerOpen(false); }}>
                <Avatar initials={d.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()} tone={index} />
                <span>
                  <b>{d.full_name}</b>
                  <small>{d.vehicle_type} · Tier {d.tier || 'D'}</small>
                </span>
                <em>{d.status}</em>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="jw-route-head">
        <div>
          <h3>Route</h3>
          <span className="jw-tag">{job.confirmation_mode === 'driver_only' ? 'Driver-only handoff' : 'Four-step handoff'}</span>
        </div>
      </div>

      <div className="jw-corridor">
        <div>
          <small>{job.scheduled_pickup_at ? formatDate(job.scheduled_pickup_at) : job.created_at ? formatDate(job.created_at) : '—'}</small>
          <b>{job.pickup_emirate}</b>
        </div>
        <span className="jw-duration">{job.price_aed != null ? `AED ${job.price_aed}` : job.item_type}</span>
        <div className="end">
          <small>{job.client_delivery_at ? formatDate(job.client_delivery_at) : '—'}</small>
          <b>{job.delivery_emirate}</b>
        </div>
      </div>

      <div className="jw-route-body">
        <RouteMap from={job.pickup_emirate} to={job.delivery_emirate} onExpand={onOpenMap} />
        <ol className="jw-timeline" aria-label="Chain of custody">
          {steps.map((step, index) => {
            const reached = step.done;
            const current = !closed && !reached && index === steps.findIndex((s) => !s.done);
            const body = (
              <>
                <div className="jw-stop-time">
                  {step.at ? (
                    <>
                      {shortDate(step.at)}
                      <span>{clock(step.at)}</span>
                    </>
                  ) : reached ? (
                    'Done'
                  ) : current ? (
                    'Next'
                  ) : (
                    'Pending'
                  )}
                </div>
                <div className="jw-stop-place">
                  <b>{step.label}</b>
                  {step.place && <span>{step.place}</span>}
                </div>
              </>
            );
            return (
              <li key={step.key} className={`jw-stop ${reached ? 'reached' : ''} ${current ? 'current' : ''}`}>
                <i className="jw-stop-dot" />
                {current ? (
                  <div className="jw-stop-card">
                    <div>{body}</div>
                    <span className="jw-radio" />
                  </div>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <JobOperations job={job} onUpdate={onUpdate} cancelOpen={cancelOpen} onCancelClose={() => setCancelOpen(false)} />
    </section>
  );
}

export function JobsView({
  jobs, drivers, onUpdate, onNewJob, onOpenMap, onEditJob, onDuplicateJob, selectedId, onSelectJob,
}: {
  jobs: JobWithDriver[];
  drivers: Driver[];
  onUpdate: () => void | Promise<void>;
  onNewJob: () => void;
  onOpenMap: () => void;
  onEditJob: (job: JobWithDriver) => void;
  onDuplicateJob: (job: JobWithDriver) => void;
  /** Owned by the dashboard so the map, alerts and geofence toasts can open a job here. */
  selectedId: string | null;
  onSelectJob: (id: string) => void;
}) {
  const [filter, setFilter] = React.useState<JobFilter>('All');
  const [search, setSearch] = React.useState('');
  const dateRange = useDateRange();

  const query = search.trim().toLowerCase();
  const visible = jobs
    .filter((job) => !job.created_at || dateRange.includes(job.created_at, job.scheduled_pickup_at || job.created_at))
    .filter((job) => matchesFilter(job, filter))
    .filter((job) => {
      if (!query) return true;
      const haystack = `${job.job_ref} ${job.sender_name} ${job.pickup_location} ${job.delivery_location} ${job.driver?.full_name || ''}`.toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  const selected = jobs.find((j) => j.id === selectedId) ?? visible[0] ?? null;

  const activeJobs = jobs.filter((j) => ['pending', 'client_pickup', 'driver_pickup', 'driver_delivery'].includes(j.status));
  const pendingJobs = jobs.filter((j) => j.status === 'pending');
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const roadDriverIds = new Set(
    activeJobs.filter((j) => ['client_pickup', 'driver_pickup', 'driver_delivery'].includes(j.status) && j.driver_id).map((j) => j.driver_id as string)
  );
  const roadDrivers = drivers.filter((d) => d.id && roadDriverIds.has(d.id));

  // Viewers are read-only (RLS enforces it; this keeps the UI from trying).
  const canWrite = useCanWrite();
  const denyIfViewer = () => {
    if (canWrite) return false;
    alert(READ_ONLY_MESSAGE);
    return true;
  };

  /** Records the driver's next step for them — the same columns the driver apps write. */
  const handleAdvance = async (job: JobWithDriver) => {
    if (denyIfViewer()) return;
    const action = nextAction(job);
    if (!action) return;
    if (!window.confirm(`${NEXT_ACTION_LABEL[action]} for ${job.job_ref}?\n\nOnly do this if the driver can't record it in the app.`)) return;
    const now = new Date().toISOString();
    const entry = `[${clock(now)}] ${NEXT_ACTION_LABEL[action]} by dispatch`;
    const notes = job.operator_notes ? `${job.operator_notes}\n${entry}` : entry;
    const run: Record<NextAction, () => Promise<unknown>> = {
      arrive_pickup: () => updateJob(job.id!, { driver_arrived_pickup_at: now, operator_notes: notes }),
      collect: async () => {
        // Four-step jobs also record the sender's own hand-over first.
        if (job.confirmation_mode !== 'driver_only' && !job.client_pickup_at) {
          await overrideCocStep(job.id!, 'client_pickup_at', true, undefined, job.confirmation_mode);
        }
        await overrideCocStep(job.id!, 'driver_pickup_at', true, notes, job.confirmation_mode);
      },
      arrive_dropoff: () => updateJob(job.id!, { driver_arrived_delivery_at: now, operator_notes: notes }),
      deliver: () => overrideCocStep(job.id!, 'driver_delivery_at', true, notes, job.confirmation_mode),
      recipient_confirm: () => overrideCocStep(job.id!, 'client_delivery_at', true, notes, job.confirmation_mode),
    };
    noteLocalStageChange(job.id!);
    try {
      await run[action]();
      onUpdate();
    } catch (err: any) {
      alert(`Could not update job: ${err.message || err}`);
    }
  };

  const handleAssign = async (job: JobWithDriver, driverId: string | null) => {
    if (denyIfViewer()) return;
    try {
      await assignDriverToJob(job.id!, driverId);
      onUpdate();
    } catch (err: any) {
      alert(`Could not assign driver: ${err.message || err}`);
    }
  };

  return (
    <>
      {/* Metric Cards Row */}
      <div className="stats mb-6">
        <StatCard 
          title="Active" 
          value={activeJobs.length} 
          icon={Zap} 
          tone={activeJobs.length > 0 ? 'attention' : 'neutral'} 
        />
        <StatCard 
          title="Pending" 
          value={pendingJobs.length} 
          icon={Clock} 
          tone={pendingJobs.length > 0 ? 'pending' : 'neutral'} 
        />
        <StatCard 
          title="Completed" 
          value={completedJobs.length} 
          icon={CheckCircle2} 
          tone={completedJobs.length > 0 ? 'complete' : 'neutral'} 
        />
        <StatCard 
          title="Drivers on Road" 
          value={roadDrivers.length} 
          icon={Truck} 
          tone="neutral" 
        />
      </div>

      {/* Jobs Workspace */}
      <div className="jw-shell">
        <div className="jw">
          <div className="jw-left">
            <JobList
              jobs={visible}
              selectedRef={selected?.id ?? null}
              filter={filter}
              setFilter={setFilter}
              search={search}
              setSearch={setSearch}
              dateRange={dateRange}
              onSelect={onSelectJob}
              onNew={onNewJob}
            />
          </div>
          {selected ? (
            <JobDetailPanel
              key={selected.id}
              job={selected}
              drivers={drivers}
              onOpenMap={onOpenMap}
              onAdvance={() => handleAdvance(selected)}
              onAssign={(driverId) => handleAssign(selected, driverId)}
              onEdit={() => onEditJob(selected)}
              onDuplicate={() => onDuplicateJob(selected)}
              onUpdate={onUpdate}
              canCancel={() => !denyIfViewer()}
            />
          ) : (
            <section className="jw-card jw-detail jw-detail-empty">
              <p>Select a job to see its route and chain of custody.</p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
