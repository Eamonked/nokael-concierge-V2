import React from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';

export default function InquirySuccess() {
  const { t } = useTranslation('businessInquiry');

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="w-20 h-20 bg-brand-neon/10 rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle2 className="w-10 h-10 text-brand-neon" />
        </div>
        <h1 className="text-4xl font-display font-medium text-brand-text mb-4">{t('success.title')}</h1>
        <p className="text-brand-muted">{t('success.subtitle')}</p>
      </motion.div>
    </div>
  );
}
