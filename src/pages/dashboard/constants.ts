import { Clock, Package, Truck, Navigation, CheckCircle2, Ban } from 'lucide-react';
import type { JobStatus } from '../../lib/supabase';
import type { OrgRole } from '../../lib/team';

export type StatTone = 'attention' | 'pending' | 'complete' | 'neutral';

export const STAT_TONE_COLOR: Record<StatTone, string> = {
  attention: 'var(--color-signal)',
  pending: 'var(--color-stage-pending)',
  complete: 'var(--color-stage-complete)',
  neutral: 'var(--color-brand-border)',
};

export const STAGE_ORDER: JobStatus[] = ['pending', 'client_pickup', 'driver_pickup', 'driver_delivery', 'completed'];

export const STAGE_CONFIG: Record<JobStatus, { label: string; short: string; color: string; desc: string; icon: any }> = {
  pending: {
    label: 'Waiting for Driver',
    short: 'Pending',
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    desc: 'Job created, need to assign a driver for pickup.',
    icon: Clock
  },
  client_pickup: {
    label: 'Driver Collecting from Sender',
    short: 'Pickup',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    desc: 'Driver is picking up the package from sender.',
    icon: Package
  },
  driver_pickup: {
    label: 'Driver Has Package - In Transit',
    short: 'In Transit',
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    desc: 'Driver confirmed they have the package and are delivering it.',
    icon: Truck
  },
  driver_delivery: {
    label: 'Driver Arrived at Recipient',
    short: 'Arrived',
    color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    desc: 'Driver is at the delivery location with the package.',
    icon: Navigation
  },
  completed: {
    label: 'Delivered Successfully ✓',
    short: 'Completed',
    color: 'bg-brand-neon/10 text-brand-neon border-brand-neon/20',
    desc: 'Recipient confirmed they received the package. Job complete!',
    icon: CheckCircle2
  },
  cancelled: {
    label: 'Cancelled',
    short: 'Cancelled',
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
    desc: 'Job could not be completed.',
    icon: Ban
  }
};

export const COMMON_FAILURE_REASONS = [
  'Client / Sender unavailable (No-Show)',
  'Recipient refused to accept package',
  'Building / Gate security denied entry',
  'Incorrect / Non-existent address',
  'Damaged or prohibited item',
  'Client cancelled shipment request',
  'Pilot / Vehicle mechanical breakdown',
  'Corridor weather / road closure'
];

export const ROLE_META: Record<OrgRole, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-brand-neon/10 text-brand-neon border-brand-neon/20' },
  admin: { label: 'Admin', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  operator: { label: 'Operator', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  viewer: { label: 'Viewer', color: 'bg-brand-input text-brand-muted border-brand-border' },
};
