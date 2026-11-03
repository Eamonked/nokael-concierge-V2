import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { urgencyLevels } from './constants';
import { useTenant } from '../../context/TenantContext';
import { isoToZonedInput, zonedInputToIso } from '../../lib/tenant';
import { fieldClass, labelClass } from './constants';

interface QuoteStepUrgencyProps {
  urgency?: string;
  pickupAt?: string;
  deadline?: string;
  updateForm: (data: any) => void;
  estimatedPrice: number | null;
}

export default function QuoteStepUrgency({ urgency, pickupAt, deadline, updateForm, estimatedPrice }: QuoteStepUrgencyProps) {
  const { t } = useTranslation('getQuote');
  const tenant = useTenant();

  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-4"
    >
      {urgencyLevels.map(level => (
        <button
          key={level.id}
          type="button"
          aria-pressed={urgency === level.id}
          onClick={() => updateForm({ urgency: level.id as any })}
          className={cn(
            "quote-choice w-full p-5 rounded-md border transition-colors text-start flex items-center justify-between group",
            urgency === level.id
              ? "bg-brand-neon/5 border-brand-neon "
              : "bg-brand-surface border-brand-field-border hover:border-brand-neon"
          )}
        >
          <div className="flex items-center gap-5">
            <div className={cn("w-2 h-2 rounded-full", level.color)} />
            <div>
              <h4 className={cn("font-bold text-sm mb-1", urgency === level.id ? "text-brand-text" : "text-brand-muted")}>
                {t(level.labelKey)}
              </h4>
              <p className="text-sm text-brand-muted normal-case tracking-normal">{t(level.descKey)}</p>
            </div>
          </div>
          {urgency === level.id && <CheckCircle2 className="w-4 h-4 text-brand-neon" />}
        </button>
      ))}
      {urgency === 'scheduled' && <div>
        <label htmlFor="quote-pickup-at" className={labelClass}>{t('step3.pickupAt', { zone: tenant.settings.timezone })}</label>
        <input id="quote-pickup-at" type="datetime-local" required className={fieldClass} value={isoToZonedInput(pickupAt, tenant)} onChange={e => updateForm({ pickup_at: zonedInputToIso(e.target.value, tenant) || undefined })} />
      </div>}
      <div>
        <label htmlFor="quote-deadline" className={labelClass}>{t('step3.deadline', { zone: tenant.settings.timezone })}</label>
        <input id="quote-deadline" type="datetime-local" className={fieldClass} value={isoToZonedInput(deadline, tenant)} onChange={e => updateForm({ deadline: zonedInputToIso(e.target.value, tenant) || undefined })} />
      </div>
      {estimatedPrice != null && (
        <p className="text-sm text-brand-muted normal-case tracking-normal text-center pt-2">
          {t('step3.estimateNote', { price: estimatedPrice })}
        </p>
      )}
    </motion.div>
  );
}
