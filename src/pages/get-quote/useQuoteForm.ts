import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { submitQuoteRequest, type QuoteRequest } from '../../lib/supabase';
import { captureUTMs, getStoredUTMs } from '../../lib/analytics';
import { useTenant } from '../../context/TenantContext';
import { tenantBasePath, tenantDisplayName, tenantPriceTiers } from '../../lib/tenant';
import { routeProblem, validFutureDate, validPhone } from '../../../shared/quoteValidation';
import { trackSavedQuote } from '../../lib/analytics';

export function useQuoteForm(formTopRef: React.RefObject<HTMLDivElement>) {
  const { t } = useTranslation('getQuote');
  const navigate = useNavigate();
  const tenant = useTenant();
  // Require an explicit region choice; never silently submit the default route.
  const firstRegion = '';
  const submissionId = React.useRef(crypto.randomUUID());
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pickupEmirate, setPickupEmirate] = React.useState(firstRegion);
  const [deliveryEmirate, setDeliveryEmirate] = React.useState(firstRegion);
  const [formData, setFormData] = React.useState<Partial<QuoteRequest>>({
    pickup_location: '',
    delivery_location: '',
    emirate: firstRegion ? `${firstRegion} → ${firstRegion}` : '',
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
  const previousStep = React.useRef(step);
  React.useEffect(() => {
    if (previousStep.current !== step) formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    previousStep.current = step;
  }, [step]);

  const updateForm = (data: Partial<QuoteRequest>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const updatePickupEmirate = (val: string) => {
    setPickupEmirate(val);
    setFormData(prev => ({ ...prev, pickup_location: '', pickup_lat: null, pickup_lng: null, emirate: `${val} → ${deliveryEmirate}` }));
  };

  const updateDeliveryEmirate = (val: string) => {
    setDeliveryEmirate(val);
    setFormData(prev => ({ ...prev, delivery_location: '', delivery_lat: null, delivery_lng: null, emirate: `${pickupEmirate} → ${val}` }));
  };

  const nextStep = () => setStep(s => Math.min(s + 1, 4));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));
  // Stepper jumps are backwards-only: moving forward must go through the form
  // submit so the current step's required fields are validated.
  const goToStep = (target: number) => setStep(s => (target >= 1 && target < s ? target : s));

  // Live estimate shown throughout steps 2-4 so the price is never a surprise at the end.
  // Spare parts run on the dedicated-fleet tier; everything else is the same-day tier.
  // null when the company hasn't published prices — the estimate is then hidden.
  const tiers = tenantPriceTiers(tenant);
  const estimatedPrice = tiers ? (formData.item_type === 'spare_part' ? tiers.dedicated : tiers.sameDay) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pickupEmirate || !deliveryEmirate || !formData.pickup_location?.trim() || !formData.delivery_location?.trim() || routeProblem(formData.pickup_location, pickupEmirate) || routeProblem(formData.delivery_location, deliveryEmirate)) {
      setError(t('errors.routeMismatch')); return;
    }
    if (step >= 3 && ((formData.urgency === 'scheduled' && !validFutureDate(formData.pickup_at)) || (formData.deadline && (!validFutureDate(formData.deadline) || (formData.urgency === 'scheduled' && formData.pickup_at && Date.parse(formData.deadline) <= Date.parse(formData.pickup_at)))))) {
      setError(t('errors.scheduleInvalid')); return;
    }
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
        id: submissionId.current,
        pickup_at: formData.urgency === 'scheduled' ? formData.pickup_at : undefined,
        // UTM fields — these map to columns added via the SQL migration
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        utm_term: utms.utm_term,
        gclid: utms.gclid,
      };

      if (!validPhone(formData.phone || '')) { setError(t('errors.phoneInvalid')); return; }
      const saved = await submitQuoteRequest(enrichedData);
      trackSavedQuote(saved.id!);

      // Build the pre-filled WhatsApp message.
      // This message goes to the company's own dispatch number, not the customer —
      // decision (A) "keep fixed" applies (see Phase 7 of the customer-facing
      // i18n plan), so this stays a plain template literal, not wired to t().
      const message = `Hi ${tenantDisplayName(tenant)}, please follow up on saved quote ${saved.tracking_id}.`;

      // Navigate to /thank-you — this is where the Google Ads conversion pixel fires.
      // The WhatsApp redirect happens from that page after a short delay.
      navigate(`${tenantBasePath(tenant)}/thank-you`, {
        replace: true,
        state: {
          leadId: saved.id,
          whatsappOptIn: formData.whatsapp_opt_in,
          waMessage: message,
        }
      });

    } catch (err: any) {
      console.error('Error submitting quote:', err);
      setError(err.message?.startsWith('This enquiry was already submitted') ? t('errors.alreadySubmitted') : t('errors.submitFailed'));
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
    goToStep,
    estimatedPrice,
    handleSubmit,
  };
}
