import React from 'react';
import { cn } from '../lib/utils';

type StatusVariant = 'completed' | 'pending' | 'in_transit' | 'cancelled' | 'active' | 'rejected' | 'approved' | 'archived';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const normalizedStatus = status?.toLowerCase().replace(/[_\s]+/g, '_') as StatusVariant;
  
  const variants: Record<StatusVariant, string> = {
    completed: 'bg-brand-neon/10 text-brand-neon border-brand-neon/20',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    in_transit: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
    approved: 'bg-brand-neon/10 text-brand-neon border-brand-neon/20',
    archived: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };

  const variantClass = variants[normalizedStatus] || 'bg-brand-input text-brand-muted border-brand-border';

  return (
    <span
      className={cn(
        'text-xs font-medium px-2.5 py-1 rounded-md border inline-block capitalize',
        variantClass,
        className
      )}
    >
      {status?.replace(/_/g, ' ')}
    </span>
  );
};
