import React from 'react';
import { Hourglass, MapPinOff, MessageSquare } from 'lucide-react';
import type { JobWithDriver, JobWait } from '../../../lib/supabase';
import { adjustJobWait } from '../../../lib/supabase';
import {
  arrivedFar, jobWaits, money, openWait, policyText, waitLabel, waitState, waitSummary, waitingPolicy,
} from '../../../lib/waiting';
import { WriteGuard } from '../permissions';
import { formatDateTime } from '../../../lib/tenant';

/** Re-render on a clock while something is ticking (local, no refetch). */
export function useNow(active: boolean, ms = 30000): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}

/** Job list chip: "Waiting 12m", amber once the free time is over. */
export function WaitChip({ job }: { job: JobWithDriver }) {
  const w = openWait(job);
  const now = useNow(!!w);
  if (!w) return null;
  const s = waitState(w, now);
  if (s.early) {
    // Driver is there before the window: show it, the clock starts later.
    return (
      <em className="jw-wait-chip" title={`Driver arrived early · waiting clock starts ${formatDateTime(w.clock_start, { timeStyle: 'short' })}${w.leg === 'pickup' ? ', or when the sender marks the package ready' : ''}`}>
        <Hourglass aria-hidden /> early
      </em>
    );
  }
  return (
    <em className={`jw-wait-chip ${s.overFree ? 'charged' : ''}`} title={waitSummary(s)}>
      <Hourglass aria-hidden /> {s.minutes}m
    </em>
  );
}

/** Live map badge while the driver waits: "Waiting 7 min", amber with the charge once it's charged. */
export function WaitBadge({ job }: { job: JobWithDriver }) {
  const w = openWait(job);
  const now = useNow(!!w);
  if (!w) return null;
  const s = waitState(w, now);
  const text = s.early ? 'Arrived early'
    : s.overFree ? `Waiting ${s.minutes} min · ${money(s.charge, w.currency || job.currency)}`
    : `Waiting ${s.minutes} min`;
  return (
    <span className={`dm-badge ${s.overFree ? 'warn' : 'waiting'}`} title={`${waitLabel(w)}: ${waitSummary(s)}`}>
      ⌛ {text}
    </span>
  );
}

/** One line for a timeline step ("Waited 22 min · AED 25"). */
export function WaitLine({ wait }: { wait: JobWait | null }) {
  const now = useNow(!!wait && !wait.ended_at);
  if (!wait) return null;
  const s = waitState(wait, now);
  return <span className={`jw-wait-line ${s.overFree && s.charge > 0 ? 'charged' : ''}`}>{waitSummary(s)}</span>;
}

/**
 * Job detail: every wait on the job, the running clock, waive / adjust for
 * closed waits (reason required, logged in operator notes), and a WhatsApp
 * nudge to the person keeping the driver waiting.
 */
export function WaitingSection({ job, onUpdate }: { job: JobWithDriver; onUpdate: () => void }) {
  const waits = jobWaits(job);
  const running = openWait(job);
  const now = useNow(!!running);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const policy = waitingPolicy();

  if (!waits.length) return null;

  const total = waits.reduce((sum, w) => sum + (w.ended_at ? waitState(w, now).charge : 0), 0);
  const currency = waits[0].currency || job.currency;

  const startEdit = (w: JobWait, waive: boolean) => {
    setEditing(w.id);
    setAmount(waive ? '0' : String(waitState(w, now).charge));
    setReason('');
    setError(null);
  };

  const save = async (w: JobWait) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) { setError('Enter an amount of 0 or more.'); return; }
    if (!reason.trim()) { setError('Add a reason; it goes in the job notes.'); return; }
    setBusy(true);
    setError(null);
    try {
      await adjustJobWait(job.id!, w.id, value, reason.trim());
      setEditing(null);
      onUpdate();
    } catch (e: any) {
      setError(e?.message === 'wait_still_running' ? 'The driver is still waiting; adjust after the handover.' : 'Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  // Who is keeping the driver waiting right now, for the WhatsApp nudge.
  const nudge = (w: JobWait) => {
    const stop = w.stop_id ? job.stops?.find(s => s.id === w.stop_id) : null;
    const phone = stop ? stop.contact_phone : w.leg === 'pickup' ? job.sender_phone : job.recipient_phone;
    const name = stop ? stop.contact_name : w.leg === 'pickup' ? job.sender_name : job.recipient_name;
    if (!phone) return null;
    const s = waitState(w, now);
    const text = [
      `Hi ${name || 'there'}, your Nokael driver has been waiting for you for ${s.minutes} min (Job #${job.job_ref}).`,
      s.overFree
        ? `The ${w.free_min} free minutes are over; waiting is charged at ${money(Number(w.block_aed), w.currency)} per ${w.block_min} min.`
        : `${s.freeLeft} free min left, then ${money(Number(w.block_aed), w.currency)} per ${w.block_min} min.`,
      'Please meet the driver as soon as you can.',
    ].join('\n');
    return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  };

  return (
    <section className="jo-section jo-waiting">
      <div className="jo-section-head">
        <h3>Waiting time</h3>
        <span className="jw-tag">{policyText(policy, currency)}</span>
      </div>
      <ul className="jo-wait-list">
        {waits.map(w => {
          const s = waitState(w, now);
          const href = s.open ? nudge(w) : null;
          return (
            <li key={w.id} className={`jo-wait ${s.open ? 'open' : ''} ${s.overFree && s.charge > 0 ? 'charged' : ''}`}>
              <div className="jo-wait-main">
                <b>{waitLabel(w)}</b>
                <span>{waitSummary(s)}</span>
                {w.adjust_reason && !s.open && <small>Dispatch: {w.adjust_reason}</small>}
                {arrivedFar(w) && (
                  <small className="jo-hint warn"><MapPinOff className="jo-inline-icon" aria-hidden /> Arrival logged {Math.round(w.distance_m!)} m from the booked pin; check before billing.</small>
                )}
              </div>
              <div className="jo-wait-actions">
                {href && (
                  <a className="jo-btn" href={href} target="_blank" rel="noopener noreferrer"><MessageSquare aria-hidden /> Send waiting notice</a>
                )}
                {!s.open && (s.computed > 0 || s.adjusted) && editing !== w.id && (
                  <WriteGuard>
                    {s.charge > 0 && <button type="button" className="jo-btn" onClick={() => startEdit(w, true)}>Waive</button>}
                    <button type="button" className="jo-btn" onClick={() => startEdit(w, false)}>Adjust</button>
                  </WriteGuard>
                )}
              </div>
              {editing === w.id && (
                <div className="jo-wait-edit">
                  <label>
                    <small>Charge ({w.currency})</small>
                    <input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
                  </label>
                  <label className="grow">
                    <small>Reason (logged)</small>
                    <input type="text" value={reason} maxLength={200} onChange={e => setReason(e.target.value)} placeholder="e.g. Building security delay, not the client" />
                  </label>
                  <div className="jo-inline">
                    <button type="button" className="jo-btn" disabled={busy} onClick={() => save(w)}>Save</button>
                    <button type="button" className="jo-btn ghost" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                  {error && <em className="jo-hint warn">{error}</em>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {total > 0 && <p className="jo-wait-total">Waiting charge on this job: <b>{money(total, currency)}</b></p>}
    </section>
  );
}
