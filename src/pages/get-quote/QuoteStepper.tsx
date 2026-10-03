import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { itemTypes, urgencyLevels, STEP_LABEL_KEYS } from './constants';

interface QuoteStepperProps {
  step: number;
  estimatedPrice: number | null;
  pickupEmirate: string;
  deliveryEmirate: string;
  itemType?: string;
  urgency?: string;
  onStepClick: (step: number) => void;
}

export default function QuoteStepper({ step, estimatedPrice, pickupEmirate, deliveryEmirate, itemType, urgency, onStepClick }: QuoteStepperProps) {
  const { t } = useTranslation('getQuote');

  return (
    <>
      {/* Stepper — labeled so the visitor knows what's still ahead, not just "3/4" */}
      <div className="mb-10 pb-6 border-b border-brand-border">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted">
            {t('stepper.stepLabel', { step, total: 4, label: t(STEP_LABEL_KEYS[step - 1]) })}
          </p>
          {step > 1 && estimatedPrice != null && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-neon">
              {t('stepper.estFrom', { price: estimatedPrice })}
            </p>
          )}
        </div>
        <ol className="flex items-start">
          {STEP_LABEL_KEYS.map((labelKey, i) => {
            const n = i + 1;
            const done = n < step;
            const active = n === step;
            return (
              <li key={labelKey} className="flex-1 flex items-start last:flex-none">
                <button
                  type="button"
                  disabled={!done}
                  onClick={() => onStepClick(n)}
                  aria-current={active ? 'step' : undefined}
                  aria-label={done ? t('stepper.goToStep', { label: t(labelKey) }) : undefined}
                  className={cn(
                    "group flex flex-col items-center gap-1.5 shrink-0 w-16",
                    done ? "cursor-pointer" : "cursor-default"
                  )}
                >
                  <span
                    className={cn(
                      "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all",
                      done && "bg-brand-neon border-brand-neon text-brand-on-neon group-hover:opacity-80",
                      active && "border-brand-neon text-brand-neon bg-brand-neon/10 ring-4 ring-brand-neon/15",
                      !done && !active && "border-brand-field-border text-brand-muted/60"
                    )}
                  >
                    {done ? <Check className="w-4 h-4" strokeWidth={3} /> : n}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] uppercase tracking-widest font-bold",
                      active ? "text-brand-text" : done ? "text-brand-muted group-hover:text-brand-neon" : "text-brand-muted/50"
                    )}
                  >
                    {t(labelKey)}
                  </span>
                </button>
                {n < STEP_LABEL_KEYS.length && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 mt-4 mx-2 rounded-full transition-colors",
                      done ? "bg-brand-neon" : "bg-brand-field-border"
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
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
