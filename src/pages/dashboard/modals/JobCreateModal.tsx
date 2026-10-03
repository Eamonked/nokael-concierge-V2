import React from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, MapPin, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase, createJob, updateJob, generateOtp, type Driver, type Job, type ItemType, type UrgencyType, type ServiceTier, type BusinessInquiry } from '../../../lib/supabase';
import { sendTelegramNotification, formatJobAssignmentNotification } from '../../../lib/notifications';
import { geocodeAddress, validCoord, type LatLng } from '../../../lib/geo';
import { AccountPicker, ClientReferenceInput, findAccountByName } from '../components/AccountPicker';

import { getActiveTenant, isoToZonedInput, zonedInputToIso, regionOptions, formatMoney } from '../../../lib/tenant';

// Scheduled pickups are entered and displayed in the company's own time zone
// (organizations.settings.timezone — Asia/Dubai for Nokael), whatever
// timezone the operator's browser is in.
const isoToGstInput = (iso?: string | null): string => isoToZonedInput(iso);
const gstInputToIso = (v: string): string | null => zonedInputToIso(v);

// Legacy jobs may hold concatenated values like "Dubai → Abu Dhabi" in an emirate field.
const cleanEmirate = (value: string | null | undefined, part: 0 | 1, fallback: string): string => {
  if (!value) return fallback;
  if (value.includes('→')) return value.split('→')[part]?.trim() || fallback;
  return value;
};

const Field: React.FC<{ label: string; wide?: boolean; span2?: boolean; required?: boolean; children: React.ReactNode }> = ({ label, wide, span2, required, children }) => (
  <label className={`field${wide ? ' wide' : ''}${span2 ? ' span-2' : ''}`}>
    {/* Labels truncate to one line; the full text stays available on hover. */}
    <span className="field-label" title={label}>{label}{required ? ' *' : ''}</span>
    {children}
  </label>
);

interface JobCreateModalProps {
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  initialData?: Partial<Job>;
  drivers: Driver[];
  /** When set, the drawer edits this existing job instead of creating a new one. */
  editJob?: Job;
  /** When set, the drawer creates a NEW job pre-filled from this one (fresh tokens/OTPs, no driver, no quote link). */
  duplicateFrom?: Job;
  /** Tracking ref of the source quote request (e.g. NK-1234), shown when converting a quote. */
  quoteRef?: string;
  /**
   * Business accounts for the Company Account picker. The picked account's id
   * is saved as jobs.business_id, which is what puts the job in that client's
   * portal, POD reports and billing. Unlinked jobs are one-offs.
   */
  businessInquiries?: BusinessInquiry[];
}

export const JobCreateModal: React.FC<JobCreateModalProps> = ({ onClose, onSuccess, initialData: prefill, drivers, editJob, duplicateFrom, quoteRef, businessInquiries }) => {
  const { t } = useTranslation('dashboard');
  const isEdit = !!editJob;
  const isDuplicate = !!duplicateFrom;
  const isQuoteConversion = !editJob && !duplicateFrom && !!prefill?.quote_id;
  // A duplicate copies only the reusable commercial/route details. Driver, internal
  // notes, quote link, status, schedule time and every token/OTP are deliberately
  // NOT carried over — the create path issues fresh ones.
  const duplicateData: Partial<Job> | undefined = duplicateFrom && {
    sender_name: duplicateFrom.sender_name,
    sender_phone: duplicateFrom.sender_phone,
    recipient_name: duplicateFrom.recipient_name,
    recipient_phone: duplicateFrom.recipient_phone,
    pickup_emirate: duplicateFrom.pickup_emirate,
    pickup_location: duplicateFrom.pickup_location,
    pickup_lat: duplicateFrom.pickup_lat,
    pickup_lng: duplicateFrom.pickup_lng,
    delivery_emirate: duplicateFrom.delivery_emirate,
    delivery_location: duplicateFrom.delivery_location,
    delivery_lat: duplicateFrom.delivery_lat,
    delivery_lng: duplicateFrom.delivery_lng,
    item_type: duplicateFrom.item_type,
    urgency: duplicateFrom.urgency,
    company_name: duplicateFrom.company_name,
    // Same account and campaign: duplicating is how dispatch books the next
    // recipient of a multi-drop campaign. The delivery slot is NOT copied.
    business_id: duplicateFrom.business_id,
    client_reference: duplicateFrom.client_reference,
    service_tier: duplicateFrom.service_tier,
    price_aed: duplicateFrom.price_aed,
    special_instructions: duplicateFrom.special_instructions,
    confirmation_mode: duplicateFrom.confirmation_mode,
  };
  const initialData: Partial<Job> | undefined = editJob ?? duplicateData ?? prefill;
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    sender_name: initialData?.sender_name || '',
    sender_phone: initialData?.sender_phone || '',
    recipient_name: initialData?.recipient_name || '',
    recipient_phone: initialData?.recipient_phone || '',
    pickup_emirate: cleanEmirate(initialData?.pickup_emirate, 0, getActiveTenant().settings.regions[0] ?? ''),
    pickup_location: initialData?.pickup_location || '',
    delivery_emirate: cleanEmirate(initialData?.delivery_emirate, 1, getActiveTenant().settings.regions[1] ?? getActiveTenant().settings.regions[0] ?? ''),
    delivery_location: initialData?.delivery_location || '',
    item_type: initialData?.item_type || 'parcel' as ItemType,
    urgency: initialData?.urgency || 'immediate' as UrgencyType,
    driver_id: initialData?.driver_id || '',
    // Driver-visible (sent via WhatsApp) and internal (audit log only) are separate fields.
    special_instructions: (initialData as any)?.notes || initialData?.special_instructions || '',
    operator_notes: initialData?.operator_notes || '',
    scheduled_pickup_at: isoToGstInput(initialData?.scheduled_pickup_at),
    company_name: initialData?.company_name || '',
    // Existing link wins; otherwise an exact name match (e.g. a converted quote) links it.
    business_id: (initialData?.business_id ?? findAccountByName(businessInquiries, initialData?.company_name || '')?.id ?? null) as string | null,
    client_reference: initialData?.client_reference || '',
    scheduled_delivery_start: isoToGstInput(initialData?.scheduled_delivery_start),
    scheduled_delivery_end: isoToGstInput(initialData?.scheduled_delivery_end),
    price_aed: initialData?.price_aed != null ? String(initialData.price_aed) : '',
    driver_payout_aed: initialData?.driver_payout_aed != null ? String(initialData.driver_payout_aed) : '',
    service_tier: (initialData?.service_tier || 'standard') as ServiceTier,
    quote_id: initialData?.quote_id || null,
    // 'driver_only' (2-step, driver-confirmed) is the default going forward.
    // 'four_step' brings back the confirm.nokael.com sender/recipient portal
    // steps for jobs that specifically need them.
    confirmation_mode: (initialData?.confirmation_mode || 'driver_only') as 'four_step' | 'driver_only'
  });

  // Reference-drawer fields that have no Job column yet (payment mode, building/gate,
  // per-stop company, time windows, per-stop notes, cargo specs, handling flags, attachments).
  // They are layout-only: kept in local state and deliberately NOT part of the create/update
  // payloads below, so nothing here can reach Supabase until matching columns exist.
  const [extra, setExtra] = React.useState({
    payment_mode: '',
    pickup_building: '', pickup_company: '', pickup_window_start: '', pickup_window_end: '', pickup_notes: '',
    delivery_building: '', delivery_company: '', delivery_notes: '',
    vehicle_required: '', quantity: '1', weight_kg: '', dim_l: '', dim_w: '', dim_h: '',
    handling: [] as string[],
  });
  const setX = <K extends keyof typeof extra>(key: K, value: (typeof extra)[K]) =>
    setExtra(prev => ({ ...prev, [key]: value }));
  const [files, setFiles] = React.useState<File[]>([]);

  /** '' → null (cleared); a valid amount → number; anything unparseable → undefined (leave the column alone). */
  const parseMoney = (raw: string): number | null | undefined => {
    if (raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.urgency === 'scheduled' && !formData.scheduled_pickup_at) {
      alert(t('jobCreateModal.scheduledPickupHint'));
      return;
    }
    if (formData.scheduled_delivery_start && formData.scheduled_delivery_end
        && formData.scheduled_delivery_end < formData.scheduled_delivery_start) {
      alert(t('jobCreateModal.deliverySlotOrder', { defaultValue: 'The delivery slot ends before it starts. Check the two times.' }));
      return;
    }
    setLoading(true);
    
    try {
      // Put both stops on the map (live map, ETA, geofence alerts, driver arrival
      // check). A stop that's unchanged from the starting data (the job being
      // edited or duplicated, or the quote's pin the customer picked) keeps that
      // pin; otherwise the address is looked up. A failed lookup just leaves it
      // empty, and the map retries later.
      const knownPin = (field: 'pickup' | 'delivery'): LatLng | null => {
        if (!initialData) return null;
        const unchanged =
          formData[`${field}_location`] === initialData[`${field}_location`] &&
          formData[`${field}_emirate`] === initialData[`${field}_emirate`];
        return unchanged ? validCoord(initialData[`${field}_lat`], initialData[`${field}_lng`]) : null;
      };
      // undefined = keep what the saved job already has (edits only).
      const resolveStop = (field: 'pickup' | 'delivery'): Promise<LatLng | null | undefined> => {
        const pin = knownPin(field);
        if (pin) return Promise.resolve(editJob ? undefined : pin);
        return geocodeAddress(formData[`${field}_location`], formData[`${field}_emirate`]);
      };
      const [pickupCoord, deliveryCoord] = await Promise.all([resolveStop('pickup'), resolveStop('delivery')]);
      // undefined = unchanged (leave the column alone); null = moved but not found (clear the old point).
      const coords: Partial<Job> = {
        ...(pickupCoord !== undefined && { pickup_lat: pickupCoord?.[0] ?? null, pickup_lng: pickupCoord?.[1] ?? null }),
        ...(deliveryCoord !== undefined && { delivery_lat: deliveryCoord?.[0] ?? null, delivery_lng: deliveryCoord?.[1] ?? null }),
      };

      if (editJob?.id) {
        const editedPrice = formData.price_aed.trim() === '' ? null : Number(formData.price_aed);
        const editedPayout = parseMoney(formData.driver_payout_aed);
        await updateJob(editJob.id, {
          sender_name: formData.sender_name,
          sender_phone: formData.sender_phone,
          recipient_name: formData.recipient_name,
          recipient_phone: formData.recipient_phone,
          pickup_emirate: formData.pickup_emirate,
          pickup_location: formData.pickup_location,
          delivery_emirate: formData.delivery_emirate,
          delivery_location: formData.delivery_location,
          item_type: formData.item_type,
          urgency: formData.urgency,
          scheduled_pickup_at: formData.urgency === 'scheduled' ? gstInputToIso(formData.scheduled_pickup_at) : null,
          ...accountFields(),
          service_tier: formData.service_tier,
          price_aed: editedPrice !== null && Number.isFinite(editedPrice) && editedPrice >= 0 ? editedPrice : null,
          ...(editedPayout !== undefined && { driver_payout_aed: editedPayout }),
          special_instructions: formData.special_instructions.trim() || null,
          ...coords,
        });
        await onSuccess();
        onClose();
        return;
      }

      const genOtp = generateOtp;
      const tokens = {
        token_client_pickup: crypto.randomUUID(),
        token_driver_pickup: crypto.randomUUID(),
        token_driver_delivery: crypto.randomUUID(),
        token_client_delivery: crypto.randomUUID()
      };

      const otpVal = genOtp();
      const parsedPrice = formData.price_aed.trim() === '' ? null : Number(formData.price_aed);
      const priceValue = parsedPrice !== null && Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : null;
      const payload: Partial<Job> = {
        ...coords,
        sender_name: formData.sender_name,
        sender_phone: formData.sender_phone,
        recipient_name: formData.recipient_name,
        recipient_phone: formData.recipient_phone,
        pickup_emirate: formData.pickup_emirate,
        pickup_location: formData.pickup_location,
        delivery_emirate: formData.delivery_emirate,
        delivery_location: formData.delivery_location,
        item_type: formData.item_type,
        urgency: formData.urgency,
        driver_id: formData.driver_id || null,
        special_instructions: formData.special_instructions.trim() || null,
        operator_notes: formData.operator_notes.trim() || null,
        scheduled_pickup_at: formData.urgency === 'scheduled' ? gstInputToIso(formData.scheduled_pickup_at) : null,
        ...accountFields(),
        price_aed: priceValue,
        driver_payout_aed: parseMoney(formData.driver_payout_aed) ?? null,
        service_tier: formData.service_tier,
        quote_id: formData.quote_id,
        confirmation_mode: formData.confirmation_mode,
        ...tokens,
        otp_sender: genOtp(),
        otp_driver_pickup: otpVal,
        otp_driver_delivery: otpVal,
        otp_recipient: genOtp(),
        source: 'manual',
        status: 'pending'
      };
      
      const result = await createJob(payload);

      // If it came from a quote, mark the source quote as converted.
      // 'completed' is the only DB-valid status besides pending/contacted
      // (see quote_requests_status CHECK constraint) — using anything else
      // (e.g. 'assigned') fails silently and leaves the quote stuck as
      // 'pending', so it never disappears from the active quotes list.
      if (formData.quote_id && supabase) {
        const { error: quoteError } = await supabase
          .from('quote_requests')
          .update({ status: 'completed' })
          .eq('id', formData.quote_id);
        if (quoteError) {
          console.error('Error marking quote as converted:', quoteError);
        }
      }

      await sendTelegramNotification(formatJobAssignmentNotification({
        ...payload,
        job_ref: result.job_ref
      }));

      onSuccess();
      onClose();
    } catch (err) {
      console.error(isEdit ? 'Error updating job:' : 'Error creating job:', err);
      alert(isEdit ? t('jobCreateModal.updateFailedAlert') : t('jobCreateModal.createFailedAlert'));
    } finally {
      setLoading(false);
    }
  };

  const set = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  /**
   * Account link, campaign reference and delivery slot, identical for create and
   * edit. business_id comes only from the picker (an explicit choice, shown to
   * dispatch as "Linked" or "One-off"), never from silent name matching at save.
   * A campaign reference without an account would be invisible to any client, so
   * it is dropped for one-off jobs.
   */
  const accountFields = (): Partial<Job> => ({
    company_name: formData.company_name.trim() || null,
    business_id: formData.business_id,
    client_reference: formData.business_id ? (formData.client_reference.trim() || null) : null,
    scheduled_delivery_start: gstInputToIso(formData.scheduled_delivery_start),
    scheduled_delivery_end: gstInputToIso(formData.scheduled_delivery_end),
  });
  const priceNumber = Number(formData.price_aed);
  const clientTotal = formData.price_aed.trim() !== '' && Number.isFinite(priceNumber)
    ? formatMoney(priceNumber, { decimals: 2 })
    : t('jobCreateModal.notSetLabel');

  const priceAed = Number.isFinite(priceNumber) && priceNumber > 0 ? priceNumber : 0;
  const payoutNumber = Number(formData.driver_payout_aed);
  const payoutAed = Number.isFinite(payoutNumber) && payoutNumber > 0 ? payoutNumber : 0;
  const marginAed = Math.max(0, priceAed - payoutAed);
  const marginPct = priceAed > 0 ? Math.round((marginAed / priceAed) * 100) : 0;

  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked: File[] = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    const accepted = picked.filter(f => f.size <= MAX_FILE_BYTES);
    if (accepted.length < picked.length) alert(t('jobCreateModal.attachTooLarge'));
    if (accepted.length) setFiles(prev => [...prev, ...accepted]);
  };
  const formatFileSize = (bytes: number) =>
    bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const HANDLING_FLAGS: { key: string; label: string }[] = [
    { key: 'fragile', label: t('jobCreateModal.handlingFragile') },
    { key: 'refrigerated', label: t('jobCreateModal.handlingRefrigerated') },
    { key: 'two_person', label: t('jobCreateModal.handlingTwoPerson') },
    { key: 'hazmat', label: t('jobCreateModal.handlingHazmat') },
  ];

  const emirateOptions = (current: string) => regionOptions(current);
  const currencyCode = getActiveTenant().settings.currency;

  const confirmationModes: { value: 'driver_only' | 'four_step'; title: string; desc: string }[] = [
    { value: 'driver_only', title: t('jobCreateModal.twoStepTitle'), desc: t('jobCreateModal.twoStepDesc') },
    { value: 'four_step', title: t('jobCreateModal.fourStepTitle'), desc: t('jobCreateModal.fourStepDesc') },
  ];

  return createPortal(
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <form className="account-drawer job-form-drawer job-create-drawer enterprise-mode" onSubmit={handleSubmit}>
        <div className="job-form-header">
          <div>
            <span className="eyebrow">{isEdit ? (editJob?.job_ref || t('jobCreateModal.editTitle')) : isDuplicate ? t('jobCreateModal.duplicateEyebrow', { ref: duplicateFrom?.job_ref || '' }) : isQuoteConversion ? t('jobCreateModal.quoteEyebrow', { ref: quoteRef || '' }).trim() : t('jobCreateModal.newDispatchEyebrow')}</span>
            <h2>{isEdit ? t('jobCreateModal.editTitle') : isDuplicate ? t('jobCreateModal.duplicateTitle') : isQuoteConversion ? t('jobCreateModal.quoteTitle') : t('jobCreateModal.title')}</h2>
            <p>{isEdit ? t('jobCreateModal.editSubtitle') : isDuplicate ? t('jobCreateModal.duplicateSubtitle') : isQuoteConversion ? t('jobCreateModal.quoteSubtitle') : t('jobCreateModal.subtitle')}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('jobCreateModal.cancelLabel')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="job-form-body">
          <section className="job-form-section">
            <div className="job-section-heading">
              <span>01</span>
              <div>
                <h3>{t('jobCreateModal.pricingTitle')}</h3>
                <p>{t('jobCreateModal.pricingHint')}</p>
              </div>
            </div>
            <div className="pricing-grid">
              {/* Row 1: money in, money out, what's left. Row 2: how it's billed. */}
              <Field label={t('jobCreateModal.priceLabel')}>
                <div className="money-input">
                  <span className="money-prefix" aria-hidden="true">{currencyCode}</span>
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={formData.price_aed} onChange={e => set('price_aed', e.target.value)} placeholder="0.00" />
                </div>
              </Field>
              <Field label={t('jobCreateModal.agentPayout')}>
                <div className="money-input">
                  <span className="money-prefix" aria-hidden="true">{currencyCode}</span>
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={formData.driver_payout_aed} onChange={e => set('driver_payout_aed', e.target.value)} placeholder={t('jobCreateModal.optionalPlaceholder')} />
                </div>
              </Field>
              <div className="margin-card" aria-live="polite">
                <span>{t('jobCreateModal.netMargin')}</span>
                <strong>{formatMoney(marginAed, { decimals: 2 })}</strong>
                <em>{t('jobCreateModal.marginPercent', { percent: marginPct })}</em>
                <div><i style={{ width: `${Math.min(100, marginPct)}%` }} /></div>
              </div>
              {/* A <div>, not <Field>'s <label>: a label would forward clicks on the
                  dropdown and mini-form to the first input inside it. */}
              <div className="field span-2">
                <span className="field-label" title={t('jobCreateModal.companyAccount')}>{t('jobCreateModal.companyAccount')}</span>
                <AccountPicker
                  accounts={businessInquiries || []}
                  value={{ businessId: formData.business_id, companyName: formData.company_name }}
                  onChange={v => setFormData(prev => ({ ...prev, business_id: v.businessId, company_name: v.companyName }))}
                />
              </div>
              <Field label={t('jobCreateModal.serviceTier')}>
                <select value={formData.service_tier} onChange={e => set('service_tier', e.target.value as ServiceTier)}>
                  <option value="express">{t('jobCreateModal.serviceTiers.express')}</option>
                  <option value="priority">{t('jobCreateModal.serviceTiers.priority')}</option>
                  <option value="standard">{t('jobCreateModal.serviceTiers.standard')}</option>
                </select>
              </Field>
              <Field label={t('jobCreateModal.paymentMode')}>
                <select value={extra.payment_mode} onChange={e => setX('payment_mode', e.target.value)}>
                  <option value="">{t('jobCreateModal.paymentModePlaceholder')}</option>
                  <option value="cod">{t('jobCreateModal.paymentModeCod')}</option>
                  <option value="invoice">{t('jobCreateModal.paymentModeInvoice')}</option>
                  <option value="card">{t('jobCreateModal.paymentModeCard')}</option>
                </select>
              </Field>
              <Field label={t('jobCreateModal.clientReference', { defaultValue: 'Campaign / client reference' })} span2>
                <ClientReferenceInput
                  businessId={formData.business_id}
                  value={formData.client_reference}
                  onChange={v => set('client_reference', v)}
                />
              </Field>
            </div>
            {!isEdit && (<>
            <p className="confirmation-mode-label" id="coc-mode-label">{t('jobCreateModal.cocConfirmation')}</p>
            <div className="confirmation-mode-grid" role="radiogroup" aria-labelledby="coc-mode-label">
              {confirmationModes.map(mode => (
                <button
                  key={mode.value}
                  type="button"
                  role="radio"
                  aria-checked={formData.confirmation_mode === mode.value}
                  className={`confirmation-mode-card${formData.confirmation_mode === mode.value ? ' selected' : ''}`}
                  onClick={() => set('confirmation_mode', mode.value)}
                  title={mode.desc}
                >
                  <i className="confirmation-mode-dot" aria-hidden="true" />
                  <b>{mode.title}</b>
                  <small>{mode.desc}</small>
                </button>
              ))}
            </div>
            </>)}
          </section>

          <div className="route-form-grid">
            <section className="route-form-section pickup">
              <div className="job-section-heading">
                <span>02</span>
                <div>
                  <h3>{t('jobCreateModal.pickupDetailsTitle')}</h3>
                  <p>{t('jobCreateModal.pickupDetailsHint')}</p>
                </div>
              </div>
              <div className="leg-fields leg-fields-3">
                <Field label={t('jobCreateModal.mapLocation')} span2 required>
                  <div className="location-input">
                    <MapPin className="w-3.5 h-3.5" />
                    <input required type="text" value={formData.pickup_location} onChange={e => set('pickup_location', e.target.value)} placeholder={t('jobCreateModal.pickupAddressPlaceholder')} />
                    <button type="button" disabled title={t('jobCreateModal.pickOnMap')}>{t('jobCreateModal.pickOnMap')}</button>
                  </div>
                </Field>
                <Field label={t('jobCreateModal.emirateLabel')} required>
                  <select required value={formData.pickup_emirate} onChange={e => set('pickup_emirate', e.target.value)}>
                    {emirateOptions(formData.pickup_emirate).map(em => <option key={em} value={em}>{em}</option>)}
                  </select>
                </Field>
                <Field label={t('jobCreateModal.contactPerson')} required>
                  <input required type="text" value={formData.sender_name} onChange={e => set('sender_name', e.target.value)} placeholder={t('jobCreateModal.fullNamePlaceholder')} />
                </Field>
                <Field label={t('jobCreateModal.directMobile')} required>
                  <input required type="tel" value={formData.sender_phone} onChange={e => set('sender_phone', e.target.value)} placeholder={t('jobCreateModal.whatsappPlaceholder')} />
                </Field>
                <Field label={t('jobCreateModal.buildingUnitGate')}>
                  <input type="text" value={extra.pickup_building} onChange={e => setX('pickup_building', e.target.value)} placeholder={t('jobCreateModal.buildingPlaceholder')} />
                </Field>
                <Field label={t('jobCreateModal.companyEntity')}>
                  <input type="text" value={extra.pickup_company} onChange={e => setX('pickup_company', e.target.value)} placeholder={t('jobCreateModal.companyEntityPlaceholder')} />
                </Field>
                <Field label={t('jobCreateModal.windowStart')}>
                  <input type="datetime-local" value={extra.pickup_window_start} onChange={e => setX('pickup_window_start', e.target.value)} />
                </Field>
                <Field label={t('jobCreateModal.windowEnd')}>
                  <input type="datetime-local" value={extra.pickup_window_end} onChange={e => setX('pickup_window_end', e.target.value)} />
                </Field>
                <Field label={t('jobCreateModal.gateNotes')} wide>
                  <textarea rows={2} value={extra.pickup_notes} onChange={e => setX('pickup_notes', e.target.value)} placeholder={t('jobCreateModal.gateNotesPlaceholder')} />
                </Field>
              </div>
            </section>
            <section className="route-form-section dropoff">
              <div className="job-section-heading">
                <span>03</span>
                <div>
                  <h3>{t('jobCreateModal.dropoffDetailsTitle')}</h3>
                  <p>{t('jobCreateModal.dropoffDetailsHint')}</p>
                </div>
              </div>
              <div className="leg-fields leg-fields-3">
                <Field label={t('jobCreateModal.mapLocation')} span2 required>
                  <div className="location-input">
                    <MapPin className="w-3.5 h-3.5" />
                    <input required type="text" value={formData.delivery_location} onChange={e => set('delivery_location', e.target.value)} placeholder={t('jobCreateModal.deliveryAddressPlaceholder')} />
                    <button type="button" disabled title={t('jobCreateModal.pickOnMap')}>{t('jobCreateModal.pickOnMap')}</button>
                  </div>
                </Field>
                <Field label={t('jobCreateModal.emirateLabel')} required>
                  <select required value={formData.delivery_emirate} onChange={e => set('delivery_emirate', e.target.value)}>
                    {emirateOptions(formData.delivery_emirate).map(em => <option key={em} value={em}>{em}</option>)}
                  </select>
                </Field>
                <Field label={t('jobCreateModal.contactPerson')} required>
                  <input required type="text" value={formData.recipient_name} onChange={e => set('recipient_name', e.target.value)} placeholder={t('jobCreateModal.fullNamePlaceholder')} />
                </Field>
                <Field label={t('jobCreateModal.directMobile')} required>
                  <input required type="tel" value={formData.recipient_phone} onChange={e => set('recipient_phone', e.target.value)} placeholder={t('jobCreateModal.whatsappPlaceholder')} />
                </Field>
                <Field label={t('jobCreateModal.buildingUnitGate')}>
                  <input type="text" value={extra.delivery_building} onChange={e => setX('delivery_building', e.target.value)} placeholder={t('jobCreateModal.buildingPlaceholder')} />
                </Field>
                <Field label={t('jobCreateModal.companyEntity')}>
                  <input type="text" value={extra.delivery_company} onChange={e => setX('delivery_company', e.target.value)} placeholder={t('jobCreateModal.companyEntityPlaceholder')} />
                </Field>
                <Field label={t('jobCreateModal.deliveryEtaStart')}>
                  <input type="datetime-local" value={formData.scheduled_delivery_start} onChange={e => set('scheduled_delivery_start', e.target.value)} />
                  <small>{t('jobCreateModal.deliverySlotHint', { defaultValue: 'UAE time. Shown to the client.' })}</small>
                </Field>
                <Field label={t('jobCreateModal.guaranteedBy')}>
                  <input type="datetime-local" value={formData.scheduled_delivery_end} min={formData.scheduled_delivery_start || undefined} onChange={e => set('scheduled_delivery_end', e.target.value)} />
                </Field>
                <Field label={t('jobCreateModal.gateNotes')} wide>
                  <textarea rows={2} value={extra.delivery_notes} onChange={e => setX('delivery_notes', e.target.value)} placeholder={t('jobCreateModal.gateNotesPlaceholder')} />
                </Field>
              </div>
            </section>
          </div>

          <section className="job-form-section">
            <div className="job-section-heading">
              <span>04</span>
              <div>
                <h3>{t('jobCreateModal.cargoSpecialTitle')}</h3>
                <p>{t('jobCreateModal.cargoSpecialHint')}</p>
              </div>
            </div>
            <div className="cargo-grid">
              <Field label={t('jobCreateModal.cargoType')}>
                <select value={formData.item_type} onChange={e => set('item_type', e.target.value as ItemType)}>
                  <option value="parcel">{t('jobCreateModal.itemTypes.parcel')}</option>
                  <option value="document">{t('jobCreateModal.itemTypes.document')}</option>
                  <option value="spare_part">{t('jobCreateModal.itemTypes.sparePart')}</option>
                  <option value="other">{t('jobCreateModal.itemTypes.other')}</option>
                </select>
              </Field>
              <Field label={t('jobCreateModal.requiredVehicle')}>
                <select value={extra.vehicle_required} onChange={e => setX('vehicle_required', e.target.value)}>
                  <option value="">{t('jobCreateModal.vehiclePlaceholder')}</option>
                  <option value="motorbike">{t('jobCreateModal.vehicleMotorbike')}</option>
                  <option value="cargo_van">{t('jobCreateModal.vehicleVan')}</option>
                  <option value="flatbed_3t">{t('jobCreateModal.vehicleFlatbed')}</option>
                  <option value="refrigerated">{t('jobCreateModal.vehicleReefer')}</option>
                </select>
              </Field>
              <Field label={t('jobCreateModal.quantity')}>
                <input type="number" min="1" value={extra.quantity} onChange={e => setX('quantity', e.target.value)} />
              </Field>
              <Field label={t('jobCreateModal.totalWeight')}>
                <input type="number" min="0" step="0.1" value={extra.weight_kg} onChange={e => setX('weight_kg', e.target.value)} placeholder="0.0" />
              </Field>
              <Field label={t('jobCreateModal.dimensions')} wide>
                <div className="dimension-inputs">
                  <input type="number" min="0" value={extra.dim_l} onChange={e => setX('dim_l', e.target.value)} placeholder={t('jobCreateModal.dimLength')} />
                  <span>×</span>
                  <input type="number" min="0" value={extra.dim_w} onChange={e => setX('dim_w', e.target.value)} placeholder={t('jobCreateModal.dimWidth')} />
                  <span>×</span>
                  <input type="number" min="0" value={extra.dim_h} onChange={e => setX('dim_h', e.target.value)} placeholder={t('jobCreateModal.dimHeight')} />
                </div>
              </Field>
              <div className="handling-field">
                <span>{t('jobCreateModal.handlingRequirements')}</span>
                <div>
                  {HANDLING_FLAGS.map(flag => (
                    <label key={flag.key}>
                      <input
                        type="checkbox"
                        checked={extra.handling.includes(flag.key)}
                        onChange={e => setX('handling', e.target.checked ? [...extra.handling, flag.key] : extra.handling.filter(k => k !== flag.key))}
                      />
                      {flag.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="leg-fields leg-fields-3 dispatch-row">
              <Field label={t('jobCreateModal.urgencyStatus')}>
                <select value={formData.urgency} onChange={e => set('urgency', e.target.value as UrgencyType)}>
                  <option value="immediate">{t('jobCreateModal.urgencyOptions.immediate')}</option>
                  <option value="today">{t('jobCreateModal.urgencyOptions.today')}</option>
                  <option value="scheduled">{t('jobCreateModal.urgencyOptions.scheduled')}</option>
                </select>
              </Field>
              {!isEdit && (
              <Field label={t('jobCreateModal.driverAssignment')}>
                <select value={formData.driver_id} onChange={e => set('driver_id', e.target.value)}>
                  <option value="">{t('jobCreateModal.unassignedOption')}</option>
                  {drivers.map(d => {
                    const statusIcon = d.status === 'available' ? '🟢' : d.status === 'on_job' ? '🟠' : '⚪';
                    return (
                      <option key={d.id} value={d.id}>{statusIcon} {d.full_name} ({t('jobCreateModal.tierShort')} {d.tier || 'D'} · {d.vehicle_type})</option>
                    );
                  })}
                </select>
              </Field>
              )}
              {formData.urgency === 'scheduled' && (
                <Field label={t('jobCreateModal.scheduledPickup')} required>
                  <input
                    required
                    type="datetime-local"
                    value={formData.scheduled_pickup_at}
                    onChange={e => set('scheduled_pickup_at', e.target.value)}
                    aria-label={t('jobCreateModal.scheduledPickupPlaceholder')}
                  />
                  <small>{t('jobCreateModal.scheduledPickupHint')}</small>
                </Field>
              )}
            </div>
          </section>

          <section className="job-form-section">
            <div className="job-section-heading">
              <span>05</span>
              <div>
                <h3>{t('jobCreateModal.notesTitle')}</h3>
                <p>{t('jobCreateModal.notesHint')}</p>
              </div>
            </div>
            <div className="leg-fields">
              <Field label={t('jobCreateModal.driverInstructions')} wide={isEdit}>
                <textarea rows={3} value={formData.special_instructions} onChange={e => set('special_instructions', e.target.value)} placeholder={t('jobCreateModal.driverInstructionsPlaceholder')} />
                <small>{t('jobCreateModal.driverInstructionsHint')}</small>
              </Field>
              {!isEdit && (
              <Field label={t('jobCreateModal.internalNotes')}>
                <textarea rows={3} value={formData.operator_notes} onChange={e => set('operator_notes', e.target.value)} placeholder={t('jobCreateModal.internalNotesPlaceholder')} />
                <small>{t('jobCreateModal.internalNotesHint')}</small>
              </Field>
              )}
            </div>
          </section>

          <section className="job-form-section">
            <div className="job-section-heading">
              <span>06</span>
              <div>
                <h3>{t('jobCreateModal.attachmentsTitle')}</h3>
                <p>{t('jobCreateModal.attachmentsHint')}</p>
              </div>
            </div>
            <label className="attachment-drop">
              <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFiles} />
              <span><Plus className="w-4 h-4" /></span>
              <div>
                <b>{t('jobCreateModal.attachDrop')}</b>
                <small>{t('jobCreateModal.attachTypes')}</small>
              </div>
            </label>
            {files.map((file, index) => (
              <div className="attached-file" key={`${file.name}-${index}`}>
                <span className="pdf-icon">{(file.name.split('.').pop() || 'FILE').slice(0, 4).toUpperCase()}</span>
                <div>
                  <b title={file.name}>{file.name}</b>
                  <small>{formatFileSize(file.size)}</small>
                </div>
                <button type="button" aria-label={t('jobCreateModal.removeFile')} onClick={() => setFiles(prev => prev.filter((_, i) => i !== index))}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </section>
        </div>

        <div className="job-form-footer">
          <div>
            <span>{t('jobCreateModal.clientTotalLabel')}</span>
            <strong>{clientTotal}</strong>
          </div>
          <button type="button" className="outline-button" onClick={onClose} disabled={loading}>
            {isEdit ? t('jobCreateModal.discardChanges') : t('jobCreateModal.cancelLabel')}
          </button>
          <button type="submit" className="dark-button" disabled={loading}>
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            {isEdit ? t('jobCreateModal.saveChanges') : isDuplicate ? t('jobCreateModal.createDuplicate') : isQuoteConversion ? t('jobCreateModal.convertAndCreate') : t('jobCreateModal.commitDispatch')}
          </button>
        </div>
      </form>
    </>,
    document.body
  );
};
