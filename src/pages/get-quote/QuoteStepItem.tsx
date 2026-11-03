import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { itemTypes } from './constants';

interface QuoteStepItemProps {
  itemType?: string;
  updateForm: (data: any) => void;
}

export default function QuoteStepItem({ itemType, updateForm }: QuoteStepItemProps) {
  const { t } = useTranslation('getQuote');

  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="grid grid-cols-2 gap-4"
    >
      {itemTypes.map(type => (
        <button
          key={type.id}
          type="button"
          aria-pressed={itemType === type.id}
          onClick={() => updateForm({ item_type: type.id as any })}
          className={cn(
            "quote-choice p-5 rounded-md border transition-colors text-start",
            itemType === type.id
              ? "bg-brand-neon/5 border-brand-neon "
              : "bg-brand-surface border-brand-field-border hover:border-brand-neon"
          )}
        >
          <type.icon className={cn("w-6 h-6 mb-4", itemType === type.id ? "text-brand-neon" : "text-brand-muted")} />
          <p className={cn("text-sm font-bold mb-1", itemType === type.id ? "text-brand-text" : "text-brand-muted")}>
            {t(type.labelKey)}
          </p>
          <p className="text-sm text-brand-muted normal-case tracking-normal">{t(type.descKey)}</p>
        </button>
      ))}
    </motion.div>
  );
}
