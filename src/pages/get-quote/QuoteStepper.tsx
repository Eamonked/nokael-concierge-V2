import { useTranslation } from 'react-i18next';
import { STEP_LABEL_KEYS } from './constants';

interface Props {
  step: number; estimatedPrice: number | null; pickupEmirate: string; deliveryEmirate: string;
  itemType?: string; urgency?: string; onStepClick: (step: number) => void;
}
export default function QuoteStepper({ step, onStepClick }: Props) {
  const { t } = useTranslation('getQuote');
  return <nav aria-label={t('summary.progress')} className="quote-progress">
    <ol>{STEP_LABEL_KEYS.map((key, i) => <li key={key} className={i + 1 === step ? 'current' : i + 1 < step ? 'complete' : ''}>
      <button type="button" disabled={i + 1 >= step} aria-current={i + 1 === step ? 'step' : undefined} onClick={() => onStepClick(i + 1)}>
        <span>{i + 1}.</span> {t(key)}
      </button>
    </li>)}</ol>
  </nav>;
}
