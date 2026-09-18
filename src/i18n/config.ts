import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonEn from './locales/en/common.json';
import commonAr from './locales/ar/common.json';
import getQuoteEn from './locales/en/getQuote.json';
import getQuoteAr from './locales/ar/getQuote.json';
import driverApplicationEn from './locales/en/driverApplication.json';
import driverApplicationAr from './locales/ar/driverApplication.json';
import businessInquiryEn from './locales/en/businessInquiry.json';
import businessInquiryAr from './locales/ar/businessInquiry.json';
import trackingEn from './locales/en/tracking.json';
import trackingAr from './locales/ar/tracking.json';

i18next.use(initReactI18next).init({
  resources: {
    en: {
      common: commonEn,
      getQuote: getQuoteEn,
      driverApplication: driverApplicationEn,
      businessInquiry: businessInquiryEn,
      tracking: trackingEn,
    },
    ar: {
      common: commonAr,
      getQuote: getQuoteAr,
      driverApplication: driverApplicationAr,
      businessInquiry: businessInquiryAr,
      tracking: trackingAr,
    },
  },
  lng: localStorage.getItem('nokael_lang') ?? 'en',
  fallbackLng: 'en',
  interpolation: {
    // React already escapes values when rendering, so let i18next skip its own
    // escaping to avoid double-encoding interpolated strings.
    escapeValue: false,
  },
});

export default i18next;
