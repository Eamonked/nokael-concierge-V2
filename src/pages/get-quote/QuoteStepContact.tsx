import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { User, Building2, Shield, Phone, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { type QuoteRequest } from '../../lib/supabase';
import { DISPLAY_PHONE } from '../../constants';

interface QuoteStepContactProps {
  formData: Partial<QuoteRequest>;
  updateForm: (data: Partial<QuoteRequest>) => void;
}

export default function QuoteStepContact({ formData, updateForm }: QuoteStepContactProps) {
  const { t } = useTranslation('getQuote');

  return (
    <motion.div
      key="step4"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-8"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => updateForm({ customer_type: 'business' })}
            className={cn(
              "py-3 px-4 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all",
              formData.customer_type === 'business' ? "bg-brand-neon border-brand-neon text-brand-bg" : "bg-brand-input border-brand-input-border text-brand-muted"
            )}
          >
            {t('step4.businessLabel')}
          </button>
          <button
            type="button"
            onClick={() => updateForm({ customer_type: 'personal' })}
            className={cn(
              "py-3 px-4 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all",
              formData.customer_type === 'personal' ? "bg-brand-neon border-brand-neon text-brand-bg" : "bg-brand-input border-brand-input-border text-brand-muted"
            )}
          >
            {t('step4.personalLabel')}
          </button>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-3">{t('step4.fullNameLabel')}</label>
          <div className="relative">
            <User className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
            <input
              required
              type="text"
              placeholder={t('step4.namePlaceholder') as string}
              className="w-full bg-brand-input border border-brand-input-border rounded-xl py-4 ps-12 pe-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors text-sm"
              value={formData.name}
              onChange={e => updateForm({ name: e.target.value })}
            />
          </div>
        </div>

        {formData.customer_type === 'business' && (
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-3">{t('step4.companyLabel')}</label>
              <div className="relative">
                <Building2 className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input
                  type="text"
                  placeholder={t('step4.companyPlaceholder') as string}
                  className="w-full bg-brand-input border border-brand-input-border rounded-xl py-4 ps-12 pe-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors text-sm"
                  value={formData.company_name}
                  onChange={e => updateForm({ company_name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-1">{t('step4.corporateCodeLabel')}</label>
              <p className="text-[9px] text-brand-muted/70 uppercase tracking-wider mb-3">
                {t('step4.corporateCodeHint')}
              </p>
              <div className="relative">
                <Shield className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-neon" />
                <input
                  type="text"
                  placeholder={t('step4.corporateCodePlaceholder') as string}
                  className="w-full bg-brand-input border border-brand-neon/20 rounded-xl py-4 ps-12 pe-4 text-brand-neon focus:outline-none focus:border-brand-neon transition-colors text-sm font-mono placeholder:text-brand-neon/30"
                  value={formData.corporate_code || ''}
                  onChange={e => updateForm({ corporate_code: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-3">{t('step4.phoneLabel')}</label>
          <div className="relative">
            <Phone className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
            <input
              required
              type="tel"
              placeholder={DISPLAY_PHONE}
              className="w-full bg-brand-input border border-brand-input-border rounded-xl py-4 ps-12 pe-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors text-sm"
              value={formData.phone}
              onChange={e => updateForm({ phone: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={cn(
              "w-5 h-5 rounded border flex items-center justify-center transition-all",
              formData.whatsapp_opt_in ? "bg-brand-neon border-brand-neon" : "bg-brand-input border-brand-input-border group-hover:border-brand-neon/30"
            )}>
              {formData.whatsapp_opt_in && <CheckCircle2 className="w-3 h-3 text-brand-bg" />}
            </div>
            <input
              type="checkbox"
              className="hidden"
              checked={formData.whatsapp_opt_in}
              onChange={e => updateForm({ whatsapp_opt_in: e.target.checked })}
            />
            <span className="text-xs text-brand-muted font-medium">{t('step4.whatsappOptIn')}</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={cn(
              "w-5 h-5 rounded border flex items-center justify-center transition-all",
              formData.repeat_business ? "bg-brand-neon border-brand-neon" : "bg-brand-input border-brand-input-border group-hover:border-brand-neon/30"
            )}>
              {formData.repeat_business && <CheckCircle2 className="w-3 h-3 text-brand-bg" />}
            </div>
            <input
              type="checkbox"
              className="hidden"
              checked={formData.repeat_business}
              onChange={e => updateForm({ repeat_business: e.target.checked })}
            />
            <span className="text-xs text-brand-muted font-medium">{t('step4.repeatBusiness')}</span>
          </label>
        </div>
      </div>
    </motion.div>
  );
}
