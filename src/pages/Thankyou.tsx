import { CheckCircle2, MessageSquare, Phone } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trackWhatsAppClick } from '../lib/analytics';
import { useTenant } from '../context/TenantContext';
import { waHref, telHref, tenantBasePath } from '../lib/tenant';

// Conversion tracking occurs after saving, never when this page loads.
export default function ThankYou() {
  const { t } = useTranslation('thankyou');
  const tenant = useTenant();
  const { state } = useLocation();
  const confirmed = typeof state?.leadId === 'string';
  const waUrl = confirmed && state.whatsappOptIn ? waHref(state.waMessage, tenant) : undefined;
  return <div className="min-h-[80vh] flex items-center justify-center px-4">
    <div className="max-w-md w-full dispatch-card text-center py-16">
      {confirmed && <CheckCircle2 className="w-16 h-16 text-brand-neon mx-auto mb-8" />}
      <h1 className="text-3xl font-display mb-4">{t(confirmed ? 'requestLogged' : 'noConfirmation')}</h1>
      <p className="text-brand-muted mb-8 text-sm">{t(confirmed ? (state.whatsappOptIn ? 'confirmation' : 'phoneConfirmation') : 'noConfirmationBody')}</p>
      {waUrl && <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackWhatsAppClick('thank_you_page')} className="btn-primary w-full py-5"><MessageSquare className="w-4 h-4" />{t('connectWithDispatcher')}</a>}
      <a href={telHref(tenant)} className="btn-secondary w-full mt-4 py-4"><Phone className="w-4 h-4" />{t('callDispatch')}</a>
      {!confirmed && <Link className="block mt-6 underline" to={tenantBasePath(tenant) + '/get-quote'}>{t('requestQuote')}</Link>}
    </div>
  </div>;
}
