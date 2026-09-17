import React from 'react';
import { STAT_TONE_COLOR, type StatTone } from '../constants';

export const StatCard: React.FC<{ title: string; value: number; icon: any; tone?: StatTone }> = ({ title, value, icon: Icon, tone = 'neutral' }) => {
  const active = tone !== 'neutral' && value > 0;
  const spine = active ? STAT_TONE_COLOR[tone] : STAT_TONE_COLOR.neutral;
  return (
    <div className="stat-ticket" style={{ '--stat-spine': spine } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-3">
        <p
          className="stat-figure text-3xl font-medium leading-none"
          style={{ color: active ? spine : 'var(--color-brand-text)' }}
        >
          {value}
        </p>
        <Icon className="w-3.5 h-3.5 text-brand-muted opacity-40 shrink-0 mt-0.5" />
      </div>
      <h3 className="text-brand-muted text-xs mt-2 truncate">{title}</h3>
    </div>
  );
};
