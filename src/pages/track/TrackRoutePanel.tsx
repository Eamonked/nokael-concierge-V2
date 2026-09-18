import { MapPin, Navigation, Building2, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { JobWithDriver } from '../../lib/supabase';
import { getUrgencyMeta } from './statusConfig';

interface TrackRoutePanelProps {
  activeJob: JobWithDriver;
}

export default function TrackRoutePanel({ activeJob }: TrackRoutePanelProps) {
  const { t } = useTranslation('tracking');
  return (
    <div className="dispatch-card border border-brand-border bg-brand-surface/60 space-y-4">
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-muted">
        {t('routePanel.sectionLabel')}
      </p>

      <div className="space-y-4 text-xs">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-widest font-black text-brand-muted block">{t('routePanel.pickupLabel')} ({activeJob.pickup_emirate})</span>
            <p className="font-semibold text-brand-text">{activeJob.pickup_location}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-brand-neon/10 text-brand-neon flex items-center justify-center shrink-0 mt-0.5">
            <Navigation className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-widest font-black text-brand-muted block">{t('routePanel.deliveryLabel')} ({activeJob.delivery_emirate})</span>
            <p className="font-semibold text-brand-text">{activeJob.delivery_location}</p>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-brand-border/60 flex flex-wrap gap-2">
        {activeJob.company_name && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-input text-[10px] font-bold text-brand-muted border border-brand-input-border">
            <Building2 className="w-3 h-3 text-brand-neon" />
            {activeJob.company_name}
          </span>
        )}
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-input text-[10px] font-bold text-brand-muted border border-brand-input-border">
          <Clock className="w-3 h-3" />
          {t(getUrgencyMeta(activeJob.urgency).labelKey)}
        </span>
      </div>
    </div>
  );
}
