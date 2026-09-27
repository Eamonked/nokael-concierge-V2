import { Navigation, Package, Zap, Truck } from 'lucide-react';

export const emirates = [
  'Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'
];

export const itemTypes = [
  { id: 'document', icon: Navigation, labelKey: 'step2.itemTypes.document.label', descKey: 'step2.itemTypes.document.desc' },
  { id: 'parcel', icon: Package, labelKey: 'step2.itemTypes.parcel.label', descKey: 'step2.itemTypes.parcel.desc' },
  { id: 'spare_part', icon: Zap, labelKey: 'step2.itemTypes.spare_part.label', descKey: 'step2.itemTypes.spare_part.desc' },
  { id: 'other', icon: Truck, labelKey: 'step2.itemTypes.other.label', descKey: 'step2.itemTypes.other.desc' },
];

export const urgencyLevels = [
  { id: 'immediate', color: 'bg-brand-neon', labelKey: 'step3.urgencyLevels.immediate.label', descKey: 'step3.urgencyLevels.immediate.desc' },
  { id: 'today', color: 'bg-brand-blue', labelKey: 'step3.urgencyLevels.today.label', descKey: 'step3.urgencyLevels.today.desc' },
  { id: 'scheduled', color: 'bg-brand-muted/50', labelKey: 'step3.urgencyLevels.scheduled.label', descKey: 'step3.urgencyLevels.scheduled.desc' },
];

// Steps are ordered by commitment level: route/item/urgency (low friction, no personal
// info required) come first to build momentum before we ask for contact details.
export const STEP_LABEL_KEYS = ['stepper.labels.route', 'stepper.labels.item', 'stepper.labels.urgency', 'stepper.labels.contact'];

// Shared field styling: a visible resting border (brand-field-border ≈ gray-300 in
// light mode) and a green focus ring so every input reads as a distinct box.
export const fieldClass =
  'w-full bg-brand-input border border-brand-field-border rounded-xl py-3.5 px-4 text-brand-text text-sm transition-colors placeholder:text-brand-muted/60 focus:outline-none focus:border-brand-neon focus:ring-2 focus:ring-brand-neon/20';
export const labelClass = 'block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-2';
