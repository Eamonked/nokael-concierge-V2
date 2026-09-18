import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { submitQuoteRequest, type QuoteRequest } from '../../lib/supabase';
import { captureUTMs, getStoredUTMs } from '../../lib/analytics';
import { PRICE_TIER_SAME_DAY, PRICE_TIER_DEDICATED } from '../../constants';

export function useQuoteForm(formTopRef: React.RefObject<HTMLDivElement>) {
  const { t } = useTranslation('getQuote');
  const navigate = useNavigate();
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pickupEmirate, setPickupEmirate] = React.useState('Dubai');
  const [deliveryEmirate, setDeliveryEmirate] = React.useState('Dubai');
  const [formData, setFormData] = React.useState<Partial<QuoteRequest>>({
    pickup_location: '',
    delivery_location: '',
    emirate: 'Dubai → Dubai',
    item_type: 'parcel',
    urgency: 'immediate',
    name: '',
    phone: '',
    whatsapp_opt_in: true,
    customer_type: 'business',
    company_name: '',
    repeat_business: false,
  });

  // Capture UTMs on page load — this is where most Google Ads traffic arrives
  React.useEffect(() => {
    captureUTMs();
  }, []);

  // Scroll the form back into view whenever the step changes, so a mobile visitor
  // who scrolled while filling a long step isn't left staring at the wrong content.
  React.useEffect(() => {
    formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  const updateForm = (data: Partial<QuoteRequest>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const updatePickupEmirate = (val: string) => {
    setPickupEmirate(val);
    setFormData(prev => ({ ...prev, emirate: `${val} → ${deliveryEmirate}` }));
  };

  const updateDeliveryEmirate = (val: string) => {
    setDeliveryEmirate(val);
    setFormData(prev => ({ ...prev, emirate: `${pickupEmirate} → ${val}` }));
  };

  const nextStep = () => setStep(s => Math.min(s + 1, 4));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  // Live estimate shown throughout steps 2-4 so the price is never a surprise at the end.
  // Spare parts run on the dedicated-fleet tier; everything else is the same-day tier.
  const estimatedPrice = formData.item_type === 'spare_part' ? PRICE_TIER_DEDICATED : PRICE_TIER_SAME_DAY;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 4) {
      nextStep();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Merge UTM attribution data into the lead record before saving
      const utms = getStoredUTMs();
      const enrichedData: QuoteRequest = {
        ...(formData as QuoteRequest),
        // UTM fields — these map to columns added via the SQL migration
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        utm_term: utms.utm_term,
        gclid: utms.gclid,
      };

      await submitQuoteRequest(enrichedData);

      // Build the pre-filled WhatsApp message.
      // This message goes to Nokael's own dispatch number, not the customer —
      // decision (A) "keep fixed" applies (see Phase 7 of the customer-facing
      // i18n plan), so this stays a plain template literal, not wired to t().
      const message = encodeURIComponent(
        `Hi Nokael, I need a quote for a ${formData.item_type} delivery from ${formData.pickup_location}, ${pickupEmirate} to ${formData.delivery_location}, ${deliveryEmirate}. Urgency: ${formData.urgency}. My name is ${formData.name}.`
      );

      // Navigate to /thank-you — this is where the Google Ads conversion pixel fires.
      // The WhatsApp redirect happens from that page after a short delay.
      navigate(`/thank-you?wa=${message}`, {
        state: {
          userData: {
            phone_number: formData.phone,
            first_name: formData.name
          }
        }
      });

    } catch (err: any) {
      console.error('Error submitting quote:', err);
      setError(err.message || t('errors.submitFailed'));
    } finally {
      setLoading(false);
    }
  };

  return {
    step,
    loading,
    error,
    pickupEmirate,
    deliveryEmirate,
    formData,
    updateForm,
    updatePickupEmirate,
    updateDeliveryEmirate,
    nextStep,
    prevStep,
    estimatedPrice,
    handleSubmit,
  };
}
