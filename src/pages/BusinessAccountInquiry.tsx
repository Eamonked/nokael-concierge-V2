import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WHATSAPP_NUMBER, BUSINESS_ACCOUNT_WA_MESSAGE } from '../constants';
import { cn } from '../lib/utils';
import { useBusinessInquiryForm } from './business-inquiry/useBusinessInquiryForm';
import InquirySuccess from './business-inquiry/InquirySuccess';
import InquirySidebar from './business-inquiry/InquirySidebar';
import InquiryStepOrg from './business-inquiry/InquiryStepOrg';
import InquiryStepLogistics from './business-inquiry/InquiryStepLogistics';

export default function BusinessAccountInquiry() {
  const { t } = useTranslation('businessInquiry');
  const { step, isSubmitting, isSuccess, formData, setFormData, nextStep, prevStep, handleSubmit } = useBusinessInquiryForm();

  // Goes to Nokael's own dispatch number, not the customer — decision (A)
  // "keep fixed" applies (see Phase 7 of the customer-facing i18n plan), so
  // this stays a plain constant, not wired to t().
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(BUSINESS_ACCOUNT_WA_MESSAGE)}`;

  if (isSuccess) {
    return <InquirySuccess />;
  }

  return (
    <div className="bg-brand-bg min-h-screen py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="asymmetric-grid items-start">
          <InquirySidebar formData={formData} waUrl={waUrl} />

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="dispatch-card p-8 md:p-12 border-2 border-brand-border"
          >
            <div className="flex items-center justify-between mb-12 pb-6 border-b border-brand-border">
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-brand-text italic">
                {t('stepper.label')} <span className="text-brand-neon">{t('stepper.stepOf', { step })}</span>
              </h2>
              <div className="flex gap-1.5">
                {[1, 2].map(i => (
                  <div
                    key={i}
                    className={cn(
                      "w-8 h-1 rounded-full transition-all duration-500",
                      i <= step ? "bg-brand-neon shadow-[0_0_10px_rgba(154,255,10,0.5)]" : "bg-brand-border"
                    )}
                  />
                ))}
              </div>
            </div>

            <form onSubmit={step === 1 ? nextStep : handleSubmit} className="space-y-10">
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <InquiryStepOrg formData={formData} setFormData={setFormData} />
                ) : (
                  <InquiryStepLogistics formData={formData} setFormData={setFormData} />
                )}
              </AnimatePresence>

              <div className="flex gap-4 pt-4 border-t border-brand-border">
                {step === 2 && (
                  <button type="button" onClick={prevStep} className="btn-secondary flex-1 py-5">
                    {t('buttons.back')}
                  </button>
                )}
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-[2] py-5 group">
                  <span className="flex items-center justify-center gap-3">
                    {isSubmitting ? t('buttons.transmitting') : step === 1 ? t('buttons.configureLogistics') : t('buttons.establishAccount')}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </div>

              <p className="text-[9px] text-brand-muted uppercase tracking-[0.4em] text-center font-bold">
                {t('footer.securePortal')}
              </p>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
