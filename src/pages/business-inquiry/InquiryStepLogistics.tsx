import React from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { MapPin, Package, BarChart3, CheckCircle2 } from 'lucide-react';
import { type BusinessInquiry } from '../../lib/supabase';
import { cn } from '../../lib/utils';

interface InquiryStepLogisticsProps {
  formData: Partial<BusinessInquiry>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<BusinessInquiry>>>;
}

export default function InquiryStepLogistics({ formData, setFormData }: InquiryStepLogisticsProps) {
  const { t } = useTranslation('businessInquiry');

  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-8"
    >
      <div className="space-y-4">
        <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black italic">{t('step2.routesLabel')}</label>
        <div className="relative group">
          <MapPin className="absolute start-5 top-6 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
          <textarea
            required
            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-5 ps-14 pe-5 focus:outline-none focus:border-brand-neon/50 transition-all font-medium placeholder:text-brand-muted/30 min-h-[120px]"
            placeholder={t('step2.routesPlaceholder') as string}
            value={formData.typical_routes || ''}
            onChange={e => setFormData({ ...formData, typical_routes: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <div className="space-y-4">
          <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black italic">{t('step2.serviceTypeLabel')}</label>
          <div className="relative group">
            <Package className="absolute start-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
            <input
              type="text"
              className="w-full bg-brand-input border border-brand-input-border rounded-xl py-5 ps-14 pe-5 focus:outline-none focus:border-brand-neon/50 transition-all font-medium placeholder:text-brand-muted/30"
              placeholder={t('step2.serviceTypePlaceholder') as string}
              value={formData.item_types || ''}
              onChange={e => setFormData({ ...formData, item_types: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-4">
          <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black italic">{t('step2.frequencyLabel')}</label>
          <div className="relative group">
            <BarChart3 className="absolute start-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
            <input
              type="text"
              className="w-full bg-brand-input border border-brand-input-border rounded-xl py-5 ps-14 pe-5 focus:outline-none focus:border-brand-neon/50 transition-all font-medium placeholder:text-brand-muted/30"
              placeholder={t('step2.frequencyPlaceholder') as string}
              value={formData.estimated_monthly_volume || ''}
              onChange={e => setFormData({ ...formData, estimated_monthly_volume: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-4 p-6 rounded-2xl border transition-all cursor-pointer group",
          formData.invoicing_required ? "bg-brand-neon/5 border-brand-neon/30" : "bg-brand-input border-brand-input-border hover:border-brand-neon/20"
        )}
        onClick={() => setFormData({ ...formData, invoicing_required: !formData.invoicing_required })}
      >
        <div className={cn(
          "w-6 h-6 rounded border flex items-center justify-center transition-all",
          formData.invoicing_required ? "bg-brand-neon border-brand-neon" : "bg-brand-bg border-brand-border"
        )}>
          {formData.invoicing_required && <CheckCircle2 className="w-4 h-4 text-brand-bg" />}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-brand-text italic">{t('step2.invoicingTitle')}</p>
          <p className="text-[9px] text-brand-muted uppercase tracking-wider font-bold">{t('step2.invoicingSubtitle')}</p>
        </div>
      </div>
    </motion.div>
  );
}
