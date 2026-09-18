import { FileText, Wrench, Package } from 'lucide-react';
import type { JobStatus } from '../../lib/supabase';

// Map Item types to labels and icons
export const getItemMeta = (itemType?: string) => {
  switch (itemType) {
    case 'document':
      return { label: 'Legal & Corporate Documents', icon: FileText, color: 'text-blue-400' };
    case 'spare_part':
      return { label: 'Critical Spare Parts', icon: Wrench, color: 'text-amber-400' };
    case 'parcel':
      return { label: 'Urgent Express Parcel', icon: Package, color: 'text-emerald-400' };
    default:
      return { label: 'Specialized Cargo', icon: Package, color: 'text-brand-neon' };
  }
};

// Map Urgency types
export const getUrgencyMeta = (urgency?: string) => {
  switch (urgency) {
    case 'immediate':
      return { label: 'Immediate 60-90 Min Corridor', color: 'bg-brand-neon/10 text-brand-neon border-brand-neon/30' };
    case 'today':
      return { label: 'Same-Day Priority', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    case 'scheduled':
      return { label: 'Pre-Scheduled Dispatch', color: 'bg-white/10 text-brand-muted border-white/20' };
    default:
      return { label: 'Express Direct', color: 'bg-brand-neon/10 text-brand-neon border-brand-neon/30' };
  }
};

// Map exact DB JobStatus to UI step & descriptor
export interface StatusConfig {
  title: string;
  badge: string;
  subtext: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  stepIndex: number; // 0 to 4
}

export const getJobStatusConfig = (status: JobStatus, hasDriver: boolean): StatusConfig => {
  switch (status) {
    case 'pending':
      return {
        title: hasDriver ? 'Driver Assigned & En Route to Hub' : 'Dispatch Processing & Driver Allocation',
        badge: hasDriver ? 'Driver Assigned' : 'Awaiting Dispatch',
        subtext: hasDriver
          ? 'Pilot has been assigned to your corridor manifest and is preparing for pickup.'
          : 'Your dispatch request has been logged. Operations control is routing the nearest available driver.',
        badgeBg: 'bg-blue-500/10 border-blue-500/30',
        badgeText: 'text-blue-400',
        dotColor: 'bg-blue-500',
        stepIndex: 0,
      };
    case 'client_pickup':
      return {
        title: 'Pilot Inbound to Pickup Location',
        badge: 'Pilot Inbound to Pickup',
        subtext: 'Pilot is en route to collect the parcel. Handover verification ready.',
        badgeBg: 'bg-amber-500/10 border-amber-500/30',
        badgeText: 'text-amber-400',
        dotColor: 'bg-amber-500',
        stepIndex: 1,
      };
    case 'driver_pickup':
      return {
        title: 'In Dedicated Transit Across Corridor',
        badge: 'In Transit',
        subtext: 'Package collected and secured. Driver is actively cruising the corridor to destination.',
        badgeBg: 'bg-brand-neon/10 border-brand-neon/30',
        badgeText: 'text-brand-neon',
        dotColor: 'bg-brand-neon',
        stepIndex: 2,
      };
    case 'driver_delivery':
      return {
        title: 'Arrived at Destination Point',
        badge: 'Out for Final Handover',
        subtext: 'Pilot has reached the destination address and is completing recipient handover.',
        badgeBg: 'bg-purple-500/10 border-purple-500/30',
        badgeText: 'text-purple-400',
        dotColor: 'bg-purple-400',
        stepIndex: 3,
      };
    case 'completed':
      return {
        title: 'Delivered & Handover Verified',
        badge: 'Delivered & Logged',
        subtext: 'Chain of Custody completed. Package has been received and verified by recipient.',
        badgeBg: 'bg-emerald-500/10 border-emerald-500/30',
        badgeText: 'text-emerald-400',
        dotColor: 'bg-emerald-400',
        stepIndex: 4,
      };
    case 'cancelled':
      return {
        title: 'Dispatch Cancelled',
        badge: 'Cancelled',
        subtext: 'This dispatch operation has been cancelled.',
        badgeBg: 'bg-red-500/10 border-red-500/30',
        badgeText: 'text-red-400',
        dotColor: 'bg-red-500',
        stepIndex: -1,
      };
    default:
      return {
        title: 'Active Corridor Manifest',
        badge: 'Active',
        subtext: 'Monitoring live dispatch telemetry.',
        badgeBg: 'bg-brand-neon/10 border-brand-neon/30',
        badgeText: 'text-brand-neon',
        dotColor: 'bg-brand-neon',
        stepIndex: 0,
      };
  }
};
