import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';

interface ApplicationStepperProps {
  step: number;
}

export default function ApplicationStepper({ step }: ApplicationStepperProps) {
  const { t } = useTranslation('driverApplication');

  const steps = [
    { step: 1, label: t('stepper.personalInfo') },
    { step: 2, label: t('stepper.documents') },
    { step: 3, label: t('stepper.complete') },
  ];

  return (
    <div className="flex items-center justify-between mb-12">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
            step >= s.step ? 'bg-brand-neon text-brand-bg' : 'bg-brand-surface border border-brand-border text-brand-muted'
          }`}>
            {step > s.step ? <CheckCircle2 className="w-5 h-5" /> : s.step}
          </div>
          {i < 2 && (
            <div className={`h-[1px] flex-grow mx-4 ${step > s.step ? 'bg-brand-neon' : 'bg-brand-border'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
