import React from 'react';
import { STAT_TONE_COLOR, type StatTone } from '../constants';

export const StatCard: React.FC<{ title: string; value: number; icon: any; tone?: StatTone }> = ({ title, value, icon: Icon, tone = 'neutral' }) => {
  const active = tone !== 'neutral' && value > 0;
  return (
    <div className="stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>
        <Icon className="w-4 h-4 inline-block opacity-40" />
      </small>
    </div>
  );
};
