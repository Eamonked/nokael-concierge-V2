import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import type { JobWithDriver } from '../../lib/supabase';
import type { StatusConfig } from './statusConfig';

interface TrackStatusBannerProps {
  statusConfig: StatusConfig;
  activeJob: JobWithDriver;
}

export default function TrackStatusBanner({ statusConfig, activeJob }: TrackStatusBannerProps) {
  const { t } = useTranslation('tracking');
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-brand-input/50 border border-brand-input-border mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className={cn("w-3 h-3 rounded-full", statusConfig.dotColor, "animate-pulse shadow-[0_0_10px_currentColor]")} />
          <h2 className="text-xl sm:text-2xl font-display font-medium tracking-tight text-brand-text">
            {t(statusConfig.titleKey)}
          </h2>
        </div>
        <span className={cn("px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border", statusConfig.badgeBg, statusConfig.badgeText)}>
          {t(statusConfig.badgeKey)}
        </span>
      </div>
      <p className="text-sm text-brand-muted leading-relaxed">
        {t(statusConfig.subtextKey)}
      </p>

      {/* Cancellation Reason if cancelled */}
      {activeJob.status === 'cancelled' && activeJob.cancellation_reason && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <b>{t('statusBanner.cancellationLabel')}</b> {activeJob.cancellation_reason}
        </div>
      )}
    </div>
  );
}
