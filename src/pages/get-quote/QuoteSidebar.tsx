import { useTranslation } from 'react-i18next';
import { useTenant } from '../../context/TenantContext';
import { waHref, telHref, tenantPriceTiers, formatMoney } from '../../lib/tenant';
import { trackWhatsAppClick, trackPhoneClick } from '../../lib/analytics';
import type { QuoteRequest } from '../../lib/supabase';

export default function QuoteSidebar({ formData }: { formData: Partial<QuoteRequest> }) {
  const { t } = useTranslation('getQuote');
  const tenant = useTenant();
  const tiers = tenantPriceTiers(tenant);
  return <aside className="quote-aside">
    <section className="quote-summary">
      <h2>{t('summary.heading')}</h2>
      <dl>
        <div><dt>{t('step1.pickupTitle')}</dt><dd>{formData.pickup_location || t('summary.noPickup')}</dd></div>
        <div><dt>{t('step1.deliveryTitle')}</dt><dd>{formData.delivery_location || t('summary.noDelivery')}</dd></div>
      </dl>
      {tiers && <div className="quote-price"><span>{t('summary.startingPrice')}</span><strong>{formatMoney(tiers.sameDay, { tenant })}</strong></div>}
      <p>{t('summary.priceNote')}</p>
    </section>
    <section className="quote-next">
      <h2>{t('summary.nextHeading')}</h2>
      <ol><li>{t('summary.next1')}</li><li>{t('summary.next2')}</li><li>{t('summary.next3')}</li></ol>
    </section>
    <section className="quote-help">
      <h2>{t('summary.helpHeading')}</h2>
      <p>{t('summary.helpBody')}</p>
      <a href={telHref(tenant)} onClick={() => trackPhoneClick('quote_help')}>{tenant.branding.support_phone}</a>
      <a href={waHref(undefined, tenant)} target="_blank" rel="noopener noreferrer" onClick={() => trackWhatsAppClick('quote_help')}>{t('summary.whatsapp')}</a>
    </section>
  </aside>;
}
