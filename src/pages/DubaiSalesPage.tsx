import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Phone, ArrowRight } from 'lucide-react';
import CourierPhoto from '../components/CourierPhoto';
import { PHONE_NUMBER, DISPLAY_PHONE } from '../constants';
import { STARTING_PRICE_AED } from '../pricing';
import { trackPhoneClick, trackWhatsAppClick } from '../lib/analytics';
import { useEnquiryLink } from '../lib/useEnquiryLink';

/** Focused route offer: enquiries are quotations, not confirmed bookings. */
export default function DubaiSalesPage({ home = false, document = false }: { home?: boolean; document?: boolean }) {
  const { t } = useTranslation(home || document ? 'home' : 'dubaiSales', { keyPrefix: document ? 'documentSales' : home ? 'sales' : undefined });
  const enquiryUrl = useEnquiryLink();
  const sourcePrefix = document ? 'document_sales' : home ? 'home_sales' : 'dubai_sales';
  const enquiryButton = (source: string) => <a className="dubai-enquiry" href={enquiryUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackWhatsAppClick(source)}>
    <MessageSquare size={19} aria-hidden="true" /><span>{t('cta')}</span><ArrowRight size={17} aria-hidden="true" />
  </a>;
  const callLink = (source: string) => <a className="dubai-call" href={`tel:${PHONE_NUMBER}`} onClick={() => trackPhoneClick(source)}><Phone size={16} aria-hidden="true" />{t('call', { phone: DISPLAY_PHONE })}</a>;
  return <div className="dubai-sales">
    <section className="dubai-sales-hero">
      <div className="dubai-offer">
        <p className="dubai-eyebrow">{t('eyebrow')}</p>
        <h1>{t('title')}</h1>
        <p className="dubai-intro">{t('intro')}</p>
        <div className="dubai-price"><strong>{t('price', { price: STARTING_PRICE_AED })}</strong><span>{t('priceNote')}</span></div>
        <p className="dubai-pickup">{t('pickup')}</p>
        {enquiryButton(`${sourcePrefix}_hero`)}
        {callLink(`${sourcePrefix}_hero`)}
        <p className="dubai-enquiry-hint">{t('enquiryHint')}</p>
      </div>
      {home ? <figure className="courier-photo"><picture>
        <source media="(max-width: 640px)" srcSet="/images/nokael-courier-sedan-768.jpg" />
        <img src="/images/nokael-courier-sedan-1280.jpg" width="1280" height="720" alt={t('photoAlt')} fetchPriority="high" />
      </picture></figure> : <CourierPhoto variant={document ? "document" : "dubai"} priority />}
    </section>

    <section className="dubai-record" aria-labelledby="dubai-record-title">
      <div><h2 id="dubai-record-title">{t('record.title')}</h2><p>{t('record.body')}</p></div>
      <div><a href="/samples/nokael-sample-chain-of-custody.pdf" target="_blank" rel="noopener noreferrer">{t('record.link')} <ArrowRight size={16} aria-hidden="true" /></a><p className="dubai-sample-note">{t('record.note')}</p></div>
    </section>

    <section className="dubai-booking" aria-labelledby="dubai-booking-title">
      <h2 id="dubai-booking-title">{t('booking.title')}</h2>
      <ol>{[0, 1, 2].map(i => <li key={i}><span className="dubai-step-number" aria-hidden="true">{i + 1}</span><h3>{t(`booking.steps.${i}.title`)}</h3><p>{t(`booking.steps.${i}.body`)}</p></li>)}</ol>
    </section>

    <section className="dubai-included" aria-labelledby="dubai-included-title">
      <h2 id="dubai-included-title">{t('included.title')}</h2>
      <div>{[0, 1, 2].map(i => <article key={i}><h3>{t(`included.items.${i}.title`)}</h3><p>{t(`included.items.${i}.body`)}</p></article>)}</div>
    </section>

    {home && <section className="home-sales-routes"><h2>{t('routesTitle')}</h2><nav aria-label={t('routesTitle')}><Link to="/urgent-delivery-dubai">{t('dubaiRoute')} <ArrowRight size={16} /></Link><Link to="/urgent-delivery-abu-dhabi">{t('abuDhabiRoute')} <ArrowRight size={16} /></Link></nav><h3>{t('businessTitle')}</h3><p>{t('businessBody')}</p><Link to="/business-account">{t('businessLink')} <ArrowRight size={16} /></Link></section>}
    <section className="dubai-faq" aria-labelledby="dubai-faq-title">
      <h2 id="dubai-faq-title">{t('faq.title')}</h2>
      {[0, 1, 2, 3, 4].map(i => <details key={i}><summary>{t(`faq.items.${i}.q`)}</summary><p>{t(`faq.items.${i}.a`)}</p></details>)}
    </section>

    <section className="dubai-final" aria-labelledby="dubai-final-title">
      <div><h2 id="dubai-final-title">{t('final.title')}</h2><p>{t('final.body')}</p></div>
      <div>{enquiryButton(`${sourcePrefix}_footer`)}{callLink(`${sourcePrefix}_footer`)}</div>
    </section>
  </div>;
}
