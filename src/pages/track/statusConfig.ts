import { FileText, Wrench, Package } from 'lucide-react';
import type { JobStatus } from '../../lib/supabase';

// Map Item types to labels and icons
// Phase 5: labels are now i18n keys, resolved by consumers via t(labelKey).
export const getItemMeta = (itemType?: string) => {
  switch (itemType) {
    case 'document':
      return { labelKey: 'itemType.document', icon: FileText, color: 'text-blue-400' };
    case 'spare_part':
      return { labelKey: 'itemType.sparePart', icon: Wrench, color: 'text-amber-400' };
    case 'parcel':
      return { labelKey: 'itemType.parcel', icon: Package, color: 'text-emerald-400' };
    default:
      return { labelKey: 'itemType.default', icon: Package, color: 'text-brand-neon' };
  }
};

// Map Urgency types
export const getUrgencyMeta = (urgency?: string) => {
  switch (urgency) {
    case 'immediate':
      return { labelKey: 'urgency.immediate', color: 'bg-brand-neon/10 text-brand-neon border-brand-neon/30' };
    case 'today':
      return { labelKey: 'urgency.today', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    case 'scheduled':
      return { labelKey: 'urgency.scheduled', color: 'bg-white/10 text-brand-muted border-white/20' };
    default:
      return { labelKey: 'urgency.default', color: 'bg-brand-neon/10 text-brand-neon border-brand-neon/30' };
  }
};

// Map exact DB JobStatus to UI step & descriptor
export interface StatusConfig {
  titleKey: string;
  badgeKey: string;
  subtextKey: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  stepIndex: number; // 0 to 4
}

export const getJobStatusConfig = (status: JobStatus, hasDriver: boolean): StatusConfig => {
  switch (status) {
    case 'pending':
      return {
        titleKey: hasDriver ? 'status.pendingAssigned.title' : 'status.pending.title',
        badgeKey: hasDriver ? 'status.pendingAssigned.badge' : 'status.pending.badge',
        subtextKey: hasDriver ? 'status.pendingAssigned.subtext' : 'status.pending.subtext',
        badgeBg: 'bg-blue-500/10 border-blue-500/30',
        badgeText: 'text-blue-400',
        dotColor: 'bg-blue-500',
        stepIndex: 0,
      };
    case 'client_pickup':
      return {
        titleKey: 'status.clientPickup.title',
        badgeKey: 'status.clientPickup.badge',
        subtextKey: 'status.clientPickup.subtext',
        badgeBg: 'bg-amber-500/10 border-amber-500/30',
        badgeText: 'text-amber-400',
        dotColor: 'bg-amber-500',
        stepIndex: 1,
      };
    case 'driver_pickup':
      return {
        titleKey: 'status.driverPickup.title',
        badgeKey: 'status.driverPickup.badge',
        subtextKey: 'status.driverPickup.subtext',
        badgeBg: 'bg-brand-neon/10 border-brand-neon/30',
        badgeText: 'text-brand-neon',
        dotColor: 'bg-brand-neon',
        stepIndex: 2,
      };
    case 'driver_delivery':
      return {
        titleKey: 'status.driverDelivery.title',
        badgeKey: 'status.driverDelivery.badge',
        subtextKey: 'status.driverDelivery.subtext',
        badgeBg: 'bg-purple-500/10 border-purple-500/30',
        badgeText: 'text-purple-400',
        dotColor: 'bg-purple-400',
        stepIndex: 3,
      };
    case 'completed':
      return {
        titleKey: 'status.completed.title',
        badgeKey: 'status.completed.badge',
        subtextKey: 'status.completed.subtext',
        badgeBg: 'bg-emerald-500/10 border-emerald-500/30',
        badgeText: 'text-emerald-400',
        dotColor: 'bg-emerald-400',
        stepIndex: 4,
      };
    case 'cancelled':
      return {
        titleKey: 'status.cancelled.title',
        badgeKey: 'status.cancelled.badge',
        subtextKey: 'status.cancelled.subtext',
        badgeBg: 'bg-red-500/10 border-red-500/30',
        badgeText: 'text-red-400',
        dotColor: 'bg-red-500',
        stepIndex: -1,
      };
    default:
      return {
        titleKey: 'status.default.title',
        badgeKey: 'status.default.badge',
        subtextKey: 'status.default.subtext',
        badgeBg: 'bg-brand-neon/10 border-brand-neon/30',
        badgeText: 'text-brand-neon',
        dotColor: 'bg-brand-neon',
        stepIndex: 0,
      };
  }
};
