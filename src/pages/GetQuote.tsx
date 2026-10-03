import React from 'react';
import { AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowLeft, Loader2, MessageSquare, Phone, Clock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuoteForm } from './get-quote/useQuoteForm';
import QuoteStepper from './get-quote/QuoteStepper';
import QuoteStepRoute from './get-quote/QuoteStepRoute';
import QuoteStepItem from './get-quote/QuoteStepItem';
import QuoteStepUrgency from './get-quote/QuoteStepUrgency';
import QuoteStepContact from './get-quote/QuoteStepContact';
import QuoteSidebar from './get-quote/QuoteSidebar';
import { useTenant } from '../context/TenantContext';
import { waHref, telHref, tenantPriceTiers } from '../lib/tenant';
import { trackWhatsAppClick } from '../lib/analytics';

export default function GetQuote() {
  const { t } = useTranslation('getQuote');
  const tenant = useTenant();
  const tiers = tenantPriceTiers(tenant);
  const formTopRef = React.useRef<HTMLDivElement>(null);
  // ?expired=1: arrived from a tracking link that closed 24 h after delivery.
  const [searchParams] = useSearchParams();
  const fromExpiredLink = searchParams.get('expired') === '1';
  const {
    step,
    loading,
    error,
    pickupEmirate,
    deliveryEmirate,
    formData,
    updateForm,
    updatePickupEmirate,
    updateDeliveryEmirate,
    prevStep,
    goToStep,
    estimatedPrice,
    handleSubmit,
  } = useQuoteForm(formTopRef);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 md:pt-20">
      <div className="asymmetric-grid items-start">
        <div ref={formTopRef} className="scroll-mt-32">
          {fromExpiredLink && (
            <div role="status" className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
              <p className="flex items-center gap-2 font-semibold">
                <Clock className="w-4 h-4 text-amber-600" /> {t('expiredLink.title')}
              </p>
              <p className="mt-2 text-sm text-brand-muted leading-relaxed">{t('expiredLink.body')}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={telHref(tenant)} className="inline-flex items-center gap-2 rounded-xl border border-brand-field-border bg-brand-surface px-4 py-2 text-sm font-semibold">
                  <Phone className="w-4 h-4" /> {t('expiredLink.call')}
                </a>
                <a
                  href={waHref(t('expiredLink.whatsappText'), tenant)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-brand-field-border bg-brand-surface px-4 py-2 text-sm font-semibold"
                >
                  <MessageSquare className="w-4 h-4" /> {t('expiredLink.whatsapp')}
                </a>
              </div>
            </div>
          )}

          <div className="mb-10">
            <h1 className="text-4xl md:text-6xl font-display font-medium tracking-tighter mb-6">{t('title')}</h1>
            <p className="text-brand-muted text-sm max-w-md leading-relaxed">
              {t('subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="relative rounded-2xl border border-brand-field-border bg-brand-surface shadow-sm px-5 py-8 sm:px-10 sm:py-12">
            {error && (
              <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs leading-relaxed">
                <p className="font-bold mb-1 uppercase tracking-widest">{t('errors.dispatchErrorTitle')}</p>
                {error}
              </div>
            )}

            <QuoteStepper
              step={step}
              estimatedPrice={estimatedPrice}
              pickupEmirate={pickupEmirate}
              deliveryEmirate={deliveryEmirate}
              itemType={formData.item_type}
              urgency={formData.urgency}
              onStepClick={goToStep}
            />

            <AnimatePresence mode="wait">
              {step === 1 && (
                <QuoteStepRoute
                  pickupEmirate={pickupEmirate}
                  deliveryEmirate={deliveryEmirate}
                  formData={formData}
                  updateForm={updateForm}
                  updatePickupEmirate={updatePickupEmirate}
                  updateDeliveryEmirate={updateDeliveryEmirate}
                />
              )}
              {step === 2 && (
                <QuoteStepItem itemType={formData.item_type} updateForm={updateForm} />
              )}
              {step === 3 && (
                <QuoteStepUrgency
                  urgency={formData.urgency}
                  updateForm={updateForm}
                  estimatedPrice={estimatedPrice}
                />
              )}
              {step === 4 && (
                <QuoteStepContact formData={formData} updateForm={updateForm} />
              )}
            </AnimatePresence>

            <div className="mt-12 flex items-center gap-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="btn-secondary flex-1 py-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{t('buttons.back')}</span>
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-[2] py-4"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{step === 4 ? t('buttons.getMyQuote') : t('buttons.continue')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            {step === 4 && tiers && (
              <p className="mt-6 text-[9px] text-brand-muted uppercase tracking-[0.2em] text-center font-bold">
                {t('footer.pricingNote', {
                  sameDay: tiers.sameDay,
                  dedicated: tiers.dedicated,
                })}
              </p>
            )}
          </form>

          {/* The sticky WhatsApp CTA is hidden on this page and the sidebar is desktop-only,
              so small screens get a quiet inline fallback instead. */}
          <a
            href={waHref(undefined, tenant)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick('quote_inline_mobile')}
            className="lg:hidden mt-6 flex items-center justify-center gap-2 text-xs font-bold text-brand-muted hover:text-brand-neon"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{t('sidebar.urgentSupport')} · {t('sidebar.chatWithDispatch')}</span>
          </a>
        </div>

        <QuoteSidebar formData={formData} />
      </div>
    </div>
  );
}
