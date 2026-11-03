import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WHATSAPP_NUMBER } from '../constants';

/** Preserve the route offer through every WhatsApp entry point on the Dubai page. */
export function useEnquiryLink() {
  const { pathname } = useLocation();
  const { t } = useTranslation('dubaiSales');
  const { t: homeT } = useTranslation('home');
  const isHome = pathname === '/';
  const isDocument = pathname.replace(/\/+$/, '') === '/document-delivery-uae';
  const isDubai = pathname.replace(/\/+$/, '') === '/urgent-delivery-dubai';
  return `https://wa.me/${WHATSAPP_NUMBER}${isDubai || isHome || isDocument ? `?text=${encodeURIComponent(isDocument ? homeT('documentSales.message') : isHome ? homeT('sales.message') : t('message'))}` : ''}`;
}
