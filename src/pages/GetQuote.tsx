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
    <div className="quote-page">
      <header className="quote-heading"><p>{t("summary.eyebrow")}</p><h1>{t("title")}</h1><p>{t("subtitle")}</p></header>
      <div className="quote-layout">
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

          <form onSubmit={handleSubmit} className="quote-form">
            {error && (
              <div role="alert" className="quote-error">
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

            <div className="quote-step-heading"><h2>{t("steps." + step + ".title")}</h2><p>{t("steps." + step + ".body")}</p></div>
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
                  pickupAt={formData.pickup_at}
                  deadline={formData.deadline}
                  updateForm={updateForm}
                  estimatedPrice={estimatedPrice}
                />
              )}
              {step === 4 && (
                <QuoteStepContact formData={formData} updateForm={updateForm} />
              )}
            </AnimatePresence>

            <div className="quote-actions">
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="quote-back"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{t('buttons.back')}</span>
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="quote-submit"
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
              <p className="quote-form-note">
                {t('footer.pricingNote', {
                  sameDay: tiers.sameDay,
                  dedicated: tiers.dedicated,
                })}
              </p>
            )}
          </form>

        </div>

        <QuoteSidebar formData={formData} />
      </div>
    </div>
  );
}
