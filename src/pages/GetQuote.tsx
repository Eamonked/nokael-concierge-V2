import React from 'react';
import { AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuoteForm } from './get-quote/useQuoteForm';
import QuoteStepper from './get-quote/QuoteStepper';
import QuoteStepRoute from './get-quote/QuoteStepRoute';
import QuoteStepItem from './get-quote/QuoteStepItem';
import QuoteStepUrgency from './get-quote/QuoteStepUrgency';
import QuoteStepContact from './get-quote/QuoteStepContact';
import QuoteSidebar from './get-quote/QuoteSidebar';
import { PRICE_TIER_SAME_DAY, PRICE_TIER_DEDICATED } from '../constants';

export default function GetQuote() {
  const { t } = useTranslation('getQuote');
  const formTopRef = React.useRef<HTMLDivElement>(null);
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
    estimatedPrice,
    handleSubmit,
  } = useQuoteForm(formTopRef);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="asymmetric-grid items-start">
        <div ref={formTopRef}>
          <div className="mb-12">
            <h1 className="text-4xl md:text-6xl font-display font-medium tracking-tighter mb-6">{t('title')}</h1>
            <p className="text-brand-muted text-sm max-w-md leading-relaxed">
              {t('subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="dispatch-card relative overflow-hidden">
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
            {step === 4 && (
              <p className="mt-6 text-[9px] text-brand-muted uppercase tracking-[0.2em] text-center font-bold">
                {t('footer.pricingNote', {
                  sameDay: PRICE_TIER_SAME_DAY || 280,
                  dedicated: PRICE_TIER_DEDICATED || 380,
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
