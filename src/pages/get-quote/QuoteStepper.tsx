import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { itemTypes, urgencyLevels, STEP_LABEL_KEYS } from './constants';

interface QuoteStepperProps {
  step: number;
  estimatedPrice: number;
  pickupEmirate: string;
  deliveryEmirate: string;
  itemType?: string;
  urgency?: string;
}

export default function QuoteStepper({ step, estimatedPrice, pickupEmirate, deliveryEmirate, itemType, urgency }: QuoteStepperProps) {
  const { t } = useTranslation('getQuote');

  return (
    <>
      {/* Stepper — labeled so the visitor knows what's still ahead, not just "3/4" */}
      <div className="mb-10 pb-6 border-b border-brand-border">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted">
            {t('stepper.stepLabel', { step, total: 4, label: t(STEP_LABEL_KEYS[step - 1]) })}
          </p>
          {step > 1 && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-neon">
              {t('stepper.estFrom', { price: estimatedPrice })}
            </p>
          )}
        </div>
        <div className="flex gap-1.5">
          {STEP_LABEL_KEYS.map((labelKey, i) => (
            <div key={labelKey} className="flex-1">
              <div
                className={cn(
                  "h-1 rounded-full transition-all mb-1.5",
                  i + 1 <= step ? "bg-brand-neon" : "bg-brand-input-border"
                )}
              />
              <p className={cn(
                "text-[8px] uppercase tracking-widest font-bold hidden sm:block",
                i + 1 <= step ? "text-brand-muted" : "text-brand-muted/40"
              )}>
                {t(labelKey)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Running summary of prior answers — reduces "what did I even pick" anxiety
          once the visitor is a few steps in. */}
      {step > 1 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <span className="px-3 py-1.5 rounded-full bg-brand-input border border-brand-input-border text-[10px] font-bold uppercase tracking-widest text-brand-text">
            {pickupEmirate} → {deliveryEmirate}
          </span>
          {step > 2 && (
            <span className="px-3 py-1.5 rounded-full bg-brand-input border border-brand-input-border text-[10px] font-bold uppercase tracking-widest text-brand-text">
              {t(itemTypes.find(ty => ty.id === itemType)?.labelKey ?? '')}
            </span>
          )}
          {step > 3 && (
            <span className="px-3 py-1.5 rounded-full bg-brand-input border border-brand-input-border text-[10px] font-bold uppercase tracking-widest text-brand-text">
              {t(urgencyLevels.find(u => u.id === urgency)?.labelKey ?? '')}
            </span>
          )}
        </div>
      )}
    </>
  );
}
