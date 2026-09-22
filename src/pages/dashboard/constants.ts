import { Clock, Package, Truck, Navigation, CheckCircle2, Ban, Undo2 } from 'lucide-react';
import type { TFunction } from 'i18next';
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

// A job never leaves these. 'returned' means the driver had the package but couldn't deliver it
// (set by the driver app); 'cancelled' is dispatch's exit before pickup.
export const TERMINAL_STATUSES: JobStatus[] = ['completed', 'cancelled', 'returned'];

const STAGE_COLOR: Record<JobStatus, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  client_pickup: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  driver_pickup: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  driver_delivery: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  completed: 'bg-brand-neon/10 text-brand-neon border-brand-neon/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  returned: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const STAGE_ICON: Record<JobStatus, any> = {
  pending: Clock,
  client_pickup: Package,
  driver_pickup: Truck,
  driver_delivery: Navigation,
  completed: CheckCircle2,
  cancelled: Ban,
  returned: Undo2,
};

// t must be scoped to the 'dashboard' namespace (useTranslation('dashboard')).
export function getStageConfig(t: TFunction): Record<JobStatus, { label: string; short: string; color: string; desc: string; icon: any }> {
  return (Object.keys(STAGE_COLOR) as JobStatus[]).reduce((acc, status) => {
    acc[status] = {
      label: t(`stageConfig.${status}.label`),
      short: t(`stageConfig.${status}.short`),
      desc: t(`stageConfig.${status}.desc`),
      color: STAGE_COLOR[status],
      icon: STAGE_ICON[status],
    };
    return acc;
  }, {} as Record<JobStatus, { label: string; short: string; color: string; desc: string; icon: any }>);
}

// Language-independent keys for the cancellation reasons. UI code should track the
// selected KEY and only translate it for display; the value written to the database
// (cancellation_reason) should be the English label so it stays consistent across
// operators using different languages.
export const FAILURE_REASON_KEYS = [
  'clientUnavailable',
  'recipientRefused',
  'securityDenied',
  'badAddress',
  'damagedOrProhibited',
  'clientCancelled',
  'vehicleBreakdown',
  'roadClosure',
] as const;

export type FailureReasonKey = typeof FAILURE_REASON_KEYS[number];

// t must be scoped to the 'dashboard' namespace (useTranslation('dashboard')).
export function getCommonFailureReasons(t: TFunction): string[] {
  return FAILURE_REASON_KEYS.map((key) => t(`failureReasons.${key}`));
}

const ROLE_COLOR: Record<OrgRole, string> = {
  owner: 'bg-brand-neon/10 text-brand-neon border-brand-neon/20',
  admin: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  operator: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  viewer: 'bg-brand-input text-brand-muted border-brand-border',
};

// t must be scoped to the 'dashboard' namespace (useTranslation('dashboard')).
export function getRoleMeta(t: TFunction): Record<OrgRole, { label: string; color: string }> {
  return {
    owner: { label: t('roles.owner'), color: ROLE_COLOR.owner },
    admin: { label: t('roles.admin'), color: ROLE_COLOR.admin },
    operator: { label: t('roles.operator'), color: ROLE_COLOR.operator },
    viewer: { label: t('roles.viewer'), color: ROLE_COLOR.viewer },
  };
}
