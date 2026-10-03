import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { submitBusinessInquiry, type BusinessInquiry } from '../../lib/supabase';
import { getStoredUTMs } from '../../lib/analytics';
import { businessAccountWaMessage, tenantBasePath } from '../../lib/tenant';

export function useBusinessInquiryForm() {
  const { t } = useTranslation('businessInquiry');
  const navigate = useNavigate();
  const [step, setStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [formData, setFormData] = React.useState<Partial<BusinessInquiry>>({
    invoicing_required: false
  });

  const nextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const prevStep = () => setStep(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const utms = getStoredUTMs();
      await submitBusinessInquiry({
        ...formData,
        ...utms
      } as BusinessInquiry);

      setIsSuccess(true);
      // The business-account message goes to the company's own dispatch number, not
      // the customer — decision (A) "keep fixed" applies (see Phase 7 of the
      // customer-facing i18n plan), so this stays a plain constant, not wired to t().
      const message = encodeURIComponent(businessAccountWaMessage());
      setTimeout(() => navigate(`${tenantBasePath()}/thank-you?wa=${message}`, {
        state: {
          userData: {
            email: formData.email,
            phone_number: formData.phone_whatsapp,
            first_name: formData.contact_person,
          }
        }
      }), 2000);
    } catch (error) {
      console.error('Error submitting inquiry:', error);
      alert(t('errors.submitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    step,
    isSubmitting,
    isSuccess,
    formData,
    setFormData,
    nextStep,
    prevStep,
    handleSubmit,
  };
}
