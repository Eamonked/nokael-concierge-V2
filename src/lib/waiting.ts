// Waiting time (supabase-waiting-time.sql): how long the driver waited for the
// client at a pickup / drop-off / stop. The server opens a job_waits row when
// the driver arrives and closes it at handover; this file is the same maths
// for the live clock between fetches, so every surface shows one number.
//
//   clock_start = max(arrival, window start)
//   minutes     = whole minutes since clock_start (15:50 → 15)
//   charge      = ceil(max(0, minutes - free) / block) × block amount

import type { Job, JobWait } from './supabase';
import { formatMoney, getActiveTenant, type TenantProfile } from './tenant';

export interface WaitingPolicy {
  enabled: boolean;
  free_min: number;
  block_min: number;
  block_aed: number;
}

export const DEFAULT_WAITING: WaitingPolicy = { enabled: true, free_min: 15, block_min: 15, block_aed: 25 };

export const waitingPolicy = (tenant: TenantProfile = getActiveTenant()): WaitingPolicy => ({
  ...DEFAULT_WAITING,
  ...(tenant.settings.waiting ?? {}),
});

export const waitMinutes = (start: string, end: number): number =>
  Math.max(0, Math.floor((end - new Date(start).getTime()) / 60000));

export const waitCharge = (minutes: number, free: number, block: number, amount: number): number =>
  Math.ceil(Math.max(0, minutes - free) / Math.max(block, 1)) * amount;

export interface WaitState {
  wait: JobWait;
  open: boolean;
  /** Whole minutes on the client's clock (0 before the window starts). */
  minutes: number;
  /** Free minutes still left (0 once charged waiting has started). */
  freeLeft: number;
  /** Clock hasn't started yet: driver arrived before the window. */
  early: boolean;
  overFree: boolean;
  /** Charge so far (open) or final charge after any dispatch adjustment. */
  charge: number;
  /** Charge before dispatch adjusted it (closed waits only). */
  computed: number;
  adjusted: boolean;
  waived: boolean;
}

export function waitState(wait: JobWait, now: number = Date.now()): WaitState {
  const open = !wait.ended_at;
  const end = open ? now : new Date(wait.ended_at!).getTime();
  const minutes = open ? waitMinutes(wait.clock_start, end) : (wait.wait_min ?? waitMinutes(wait.clock_start, end));
  const computed = open
    ? waitCharge(minutes, wait.free_min, wait.block_min, Number(wait.block_aed))
    : Number(wait.charge_aed ?? waitCharge(minutes, wait.free_min, wait.block_min, Number(wait.block_aed)));
  const adjusted = !open && wait.adjusted_charge_aed != null;
  const charge = adjusted ? Number(wait.adjusted_charge_aed) : computed;
  return {
    wait,
    open,
    minutes,
    freeLeft: Math.max(0, wait.free_min - minutes),
    early: open && new Date(wait.clock_start).getTime() > now,
    overFree: minutes > wait.free_min,
    charge,
    computed,
    adjusted,
    waived: adjusted && charge === 0 && computed > 0,
  };
}

/** The job's waits, in route order. */
export const jobWaits = (job: Pick<Job, 'waits'>): JobWait[] =>
  [...(job.waits ?? [])].sort((a, b) => a.seq - b.seq || a.arrived_at.localeCompare(b.arrived_at));

/** The wait running now, if the driver is waiting somewhere. */
export const openWait = (job: Pick<Job, 'waits' | 'status'>): JobWait | null =>
  ['completed', 'cancelled', 'returned'].includes(job.status as string)
    ? null
    : jobWaits(job).find(w => !w.ended_at) ?? null;

export const waitFor = (job: Pick<Job, 'waits'>, leg: JobWait['leg'], stopId?: string | null): JobWait | null =>
  (job.waits ?? []).find(w => (stopId ? w.stop_id === stopId : w.leg === leg && !w.stop_id)) ?? null;

export const waitLabel = (w: Pick<JobWait, 'leg' | 'seq'>): string =>
  w.leg === 'pickup' ? 'Pickup' : w.leg === 'dropoff' ? 'Drop-off' : `Stop ${w.seq}`;

export const money = (amount: number, currency?: string | null) => formatMoney(amount, { currency });

/** "15 min free, then AED 25 per 15 min" */
export const policyText = (p: WaitingPolicy = waitingPolicy(), currency?: string | null): string =>
  `${p.free_min} min free waiting, then ${money(p.block_aed, currency)} per ${p.block_min} min`;

/** One-line summary for lists, timelines and PDFs. */
export function waitSummary(s: WaitState): string {
  const cur = s.wait.currency;
  if (s.open) {
    if (s.early) return 'Driver early · clock starts at the window';
    return s.overFree
      ? `Waiting ${s.minutes} min · ${money(s.charge, cur)} so far`
      : `Waiting ${s.minutes} min · ${s.freeLeft} free min left`;
  }
  const base = `Waited ${s.minutes} min`;
  if (s.waived) return `${base} · waiting waived`;
  if (s.charge > 0) return `${base} · ${money(s.charge, cur)}${s.adjusted ? ' (adjusted)' : ''}`;
  return `${base} · free`;
}

/** Arrived far from the booked pin (dispatch should check before billing). */
export const FAR_ARRIVAL_M = 300;
export const arrivedFar = (w: JobWait): boolean => w.distance_m != null && w.distance_m > FAR_ARRIVAL_M;
