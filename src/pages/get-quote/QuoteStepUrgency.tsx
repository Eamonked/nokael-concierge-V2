import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { urgencyLevels } from './constants';

interface QuoteStepUrgencyProps {
  urgency?: string;
  updateForm: (data: any) => void;
  estimatedPrice: number;
}

export default function QuoteStepUrgency({ urgency, updateForm, estimatedPrice }: QuoteStepUrgencyProps) {
  const { t } = useTranslation('getQuote');

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
          onClick={() => updateForm({ urgency: level.id as any })}
          className={cn(
            "w-full p-6 rounded-xl border transition-all text-left flex items-center justify-between group",
            urgency === level.id
              ? "bg-brand-neon/5 border-brand-neon/30"
              : "bg-white/[0.02] border-white/[0.05] hover:border-white/[0.1]"
          )}
        >
          <div className="flex items-center gap-5">
            <div className={cn("w-2 h-2 rounded-full", level.color)} />
            <div>
              <h4 className={cn("font-bold text-sm mb-1", urgency === level.id ? "text-brand-text" : "text-brand-muted")}>
                {t(level.labelKey)}
              </h4>
              <p className="text-[10px] text-brand-muted uppercase tracking-wider">{t(level.descKey)}</p>
            </div>
          </div>
          {urgency === level.id && <CheckCircle2 className="w-4 h-4 text-brand-neon" />}
        </button>
      ))}
      <p className="text-[10px] text-brand-muted uppercase tracking-widest text-center pt-2">
        {t('step3.estimateNote', { price: estimatedPrice })}
      </p>
    </motion.div>
  );
}
