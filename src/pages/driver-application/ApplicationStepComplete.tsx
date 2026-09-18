import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

export default function ApplicationStepComplete() {
  const { t } = useTranslation('driverApplication');
  const navigate = useNavigate();

  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-12"
    >
      <div className="w-24 h-24 bg-brand-neon/10 rounded-full flex items-center justify-center mx-auto mb-8">
        <CheckCircle2 className="w-12 h-12 text-brand-neon" />
      </div>
      <h2 className="text-4xl font-display font-medium text-brand-text mb-4">{t('step3.title')}</h2>
      <p className="text-brand-muted mb-12 max-w-md mx-auto">
        {t('step3.description')}
      </p>
      <button
        onClick={() => navigate('/')}
        className="btn-primary px-12 py-5"
      >
        {t('step3.returnHome')}
      </button>
    </motion.div>
  );
}
