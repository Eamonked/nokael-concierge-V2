import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/config';

export const LanguageToggle = () => {
  const { t } = useTranslation('common');
  const isArabic = i18n.language === 'ar';

  const toggleLanguage = () => {
    const next = isArabic ? 'en' : 'ar';
    i18n.changeLanguage(next);
    localStorage.setItem('nokael_lang', next);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="px-3 h-8 flex items-center justify-center bg-brand-surface border border-brand-border rounded-full text-xs font-bold text-brand-text hover:border-brand-neon/40 transition-all duration-300"
      aria-label={isArabic ? t('languageSwitcher.switchToEnglish') : t('languageSwitcher.switchToArabic')}
    >
      {isArabic ? t('languageSwitcher.switchToEnglish') : t('languageSwitcher.switchToArabic')}
    </button>
  );
};
