import React from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase, type BusinessInquiry } from '../../../lib/supabase';
import { NOKAEL_ORG_ID } from '../../../constants';

const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'RAK', 'Fujairah', 'UMM Al Quwain', 'Al Ain'];
const SERVICE_TIERS = ['Enterprise VIP', 'Same-Day Premium', 'Enterprise', 'Standard'];
const ESTIMATED_VOLUMES = ['1-10', '11-50', '51-100', '100-500', '500+'];

const Field: React.FC<{ 
  label: string; 
  wide?: boolean; 
  required?: boolean; 
  children: React.ReactNode;
  hint?: string;
}> = ({ label, wide, required, children, hint }) => (
  <label className={`field${wide ? ' wide' : ''}`}>
    <span>{label}{required ? ' *' : ''}</span>
    {children}
    {hint && <small style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>{hint}</small>}
  </label>
);

interface AddBusinessModalProps {
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export const AddBusinessModal: React.FC<AddBusinessModalProps> = ({ onClose, onSuccess }) => {
  const { t } = useTranslation('dashboard');
  const [loading, setLoading] = React.useState(false);
  
  const [formData, setFormData] = React.useState({
    company_name: '',
    contact_person: '',
    phone_whatsapp: '',
    email: '',
    typical_routes: '',
    item_types: '',
    estimated_monthly_volume: '11-50',
    urgent_express_dedicated_needs: '',
    invoicing_required: true,
    status: 'pending' as const,
    follow_up_notes: '',
    service_tier: 'Standard',
    base_emirate: 'Dubai',
    payment_terms: 'Net 30',
  });

  const set = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.company_name.trim() || !formData.contact_person.trim() || !formData.phone_whatsapp.trim()) {
      alert(t('addBusinessModal.requiredFieldsAlert', { 
        defaultValue: 'Please fill in all required fields.' 
      }));
      return;
    }

    // Validate email format if provided
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      alert(t('addBusinessModal.invalidEmailAlert', { 
        defaultValue: 'Please enter a valid email address.' 
      }));
      return;
    }

    setLoading(true);
    
    try {
      if (!supabase) throw new Error('Supabase not configured');

      // Generate corporate code (NOK-XXXX format)
      const corpCodeNumber = Math.floor(1000 + Math.random() * 9000);
      const corporate_code = `NOK-${corpCodeNumber}`;

      // Prepare business inquiry payload
      const businessPayload: Partial<BusinessInquiry> = {
        company_name: formData.company_name.trim(),
        contact_person: formData.contact_person.trim(),
        phone_whatsapp: formData.phone_whatsapp.trim(),
        email: formData.email.trim() || '',
        typical_routes: formData.typical_routes.trim() || null,
        item_types: formData.item_types.trim() || null,
        estimated_monthly_volume: formData.estimated_monthly_volume,
        urgent_express_dedicated_needs: formData.urgent_express_dedicated_needs.trim() || null,
        invoicing_required: formData.invoicing_required,
        status: formData.status,
        follow_up_notes: formData.follow_up_notes.trim() || null,
        corporate_code,
        // Was previously collected in this form but never sent — the column
        // now exists on business_inquiries (see supabase-business-real-data.sql).
        service_tier: formData.service_tier as BusinessInquiry['service_tier'],
        organization_id: NOKAEL_ORG_ID,
      };

      // Insert business inquiry
      const { error: businessError } = await supabase
        .from('business_inquiries')
        .insert([businessPayload]);

      if (businessError) throw businessError;

      await onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating business account:', err);
      alert(t('addBusinessModal.createFailedAlert', { 
        defaultValue: 'Failed to create business account. Please try again.' 
      }));
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <form className="account-drawer job-form-drawer enterprise-mode" onSubmit={handleSubmit}>
        <div className="job-form-header">
          <div>
            <span className="eyebrow">
              {t('addBusinessModal.eyebrow', { defaultValue: 'BUSINESS ONBOARDING' })}
            </span>
            <h2>{t('addBusinessModal.title', { defaultValue: 'Add Business Account' })}</h2>
            <p>
              {t('addBusinessModal.subtitle', { 
                defaultValue: 'Register a new corporate client for managed delivery services and account billing.' 
              })}
            </p>
          </div>
          <button 
            type="button" 
            className="icon-button" 
            onClick={onClose} 
            aria-label={t('addBusinessModal.cancelLabel', { defaultValue: 'Cancel' })}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="job-form-body">
          {/* Section 1: Company Information */}
          <section className="job-form-section">
            <div className="job-section-heading">
              <span>01</span>
              <div>
                <h3>
                  {t('addBusinessModal.companyInfoTitle', { defaultValue: 'Company Information' })}
                </h3>
                <p>
                  {t('addBusinessModal.companyInfoHint', { 
                    defaultValue: 'Legal entity name and primary business contact details.' 
                  })}
                </p>
              </div>
            </div>
            <div className="pricing-grid">
              <Field 
                label={t('addBusinessModal.companyNameLabel', { defaultValue: 'Company / Legal Entity Name' })} 
                required
              >
                <input
                  required
                  type="text"
                  value={formData.company_name}
                  onChange={e => set('company_name', e.target.value)}
                  placeholder={t('addBusinessModal.companyNamePlaceholder', { 
                    defaultValue: 'e.g., Emirates Logistics LLC' 
                  })}
                />
              </Field>
              <Field 
                label={t('addBusinessModal.contactPersonLabel', { defaultValue: 'Primary Contact Person' })} 
                required
              >
                <input
                  required
                  type="text"
                  value={formData.contact_person}
                  onChange={e => set('contact_person', e.target.value)}
                  placeholder={t('addBusinessModal.contactPersonPlaceholder', { 
                    defaultValue: 'e.g., John Smith (Operations Manager)' 
                  })}
                />
              </Field>
              <Field 
                label={t('addBusinessModal.phoneLabel', { defaultValue: 'Phone / WhatsApp Number' })} 
                required
              >
                <input
                  required
                  type="tel"
                  value={formData.phone_whatsapp}
                  onChange={e => set('phone_whatsapp', e.target.value)}
                  placeholder={t('addBusinessModal.phonePlaceholder', { 
                    defaultValue: '+971 50 123 4567' 
                  })}
                />
              </Field>
              <Field 
                label={t('addBusinessModal.emailLabel', { defaultValue: 'Business Email Address' })}
              >
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder={t('addBusinessModal.emailPlaceholder', { 
                    defaultValue: 'operations@company.com' 
                  })}
                />
              </Field>
              <Field 
                label={t('addBusinessModal.baseEmirateLabel', { defaultValue: 'Primary Operating Emirate' })} 
                required
              >
                <select
                  required
                  value={formData.base_emirate}
                  onChange={e => set('base_emirate', e.target.value)}
                >
                  {EMIRATES.map(emirate => (
                    <option key={emirate} value={emirate}>
                      {emirate}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          {/* Section 2: Service Requirements */}
          <section className="job-form-section">
            <div className="job-section-heading">
              <span>02</span>
              <div>
                <h3>
                  {t('addBusinessModal.serviceRequirementsTitle', { defaultValue: 'Service Requirements & Scope' })}
                </h3>
                <p>
                  {t('addBusinessModal.serviceRequirementsHint', { 
                    defaultValue: 'Define expected delivery patterns, volume, and service level needs.' 
                  })}
                </p>
              </div>
            </div>
            <div className="pricing-grid">
              <Field 
                label={t('addBusinessModal.typicalRoutesLabel', { defaultValue: 'Typical Routes / Corridors' })}
                wide
              >
                <input
                  type="text"
                  value={formData.typical_routes}
                  onChange={e => set('typical_routes', e.target.value)}
                  placeholder={t('addBusinessModal.typicalRoutesPlaceholder', { 
                    defaultValue: 'e.g., Dubai Marina → DIFC, Sharjah → Dubai' 
                  })}
                />
              </Field>
              <Field 
                label={t('addBusinessModal.itemTypesLabel', { defaultValue: 'Item Types / Categories' })}
                wide
              >
                <input
                  type="text"
                  value={formData.item_types}
                  onChange={e => set('item_types', e.target.value)}
                  placeholder={t('addBusinessModal.itemTypesPlaceholder', { 
                    defaultValue: 'e.g., Documents, Parcels, Medical Supplies' 
                  })}
                />
              </Field>
              <Field 
                label={t('addBusinessModal.estimatedVolumeLabel', { defaultValue: 'Estimated Monthly Volume' })}
              >
                <select
                  value={formData.estimated_monthly_volume}
                  onChange={e => set('estimated_monthly_volume', e.target.value)}
                >
                  {ESTIMATED_VOLUMES.map(volume => (
                    <option key={volume} value={volume}>
                      {volume} {t('addBusinessModal.jobsPerMonth', { defaultValue: 'jobs/month' })}
                    </option>
                  ))}
                </select>
              </Field>
              <Field 
                label={t('addBusinessModal.serviceTierLabel', { defaultValue: 'Service Tier / Priority Level' })}
              >
                <select
                  value={formData.service_tier}
                  onChange={e => set('service_tier', e.target.value)}
                >
                  {SERVICE_TIERS.map(tier => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </Field>
              <Field 
                label={t('addBusinessModal.specialNeedsLabel', { defaultValue: 'Express / Dedicated Requirements' })}
                wide
              >
                <textarea
                  value={formData.urgent_express_dedicated_needs}
                  onChange={e => set('urgent_express_dedicated_needs', e.target.value)}
                  placeholder={t('addBusinessModal.specialNeedsPlaceholder', { 
                    defaultValue: 'e.g., Same-hour medical deliveries, dedicated driver on Thursdays...' 
                  })}
                  rows={3}
                  style={{ resize: 'vertical', minHeight: '80px' }}
                />
              </Field>
            </div>
          </section>

          {/* Section 3: Billing & Account Setup */}
          <section className="job-form-section">
            <div className="job-section-heading">
              <span>03</span>
              <div>
                <h3>
                  {t('addBusinessModal.billingSetupTitle', { defaultValue: 'Billing & Account Setup' })}
                </h3>
                <p>
                  {t('addBusinessModal.billingSetupHint', { 
                    defaultValue: 'Configure invoicing, payment terms, and account status.' 
                  })}
                </p>
              </div>
            </div>
            <div className="pricing-grid">
              <Field 
                label={t('addBusinessModal.invoicingLabel', { defaultValue: 'Invoicing & Payment Terms' })}
              >
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={formData.invoicing_required === true}
                      onChange={() => set('invoicing_required', true)}
                    />
                    <span>
                      {t('addBusinessModal.monthlyInvoicing', { defaultValue: 'Monthly invoicing required' })}
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={formData.invoicing_required === false}
                      onChange={() => set('invoicing_required', false)}
                    />
                    <span>
                      {t('addBusinessModal.standardPayment', { defaultValue: 'Standard payment (per-job)' })}
                    </span>
                  </label>
                </div>
              </Field>
              <Field 
                label={t('addBusinessModal.paymentTermsLabel', { defaultValue: 'Payment Terms' })}
              >
                <select
                  value={formData.payment_terms}
                  onChange={e => set('payment_terms', e.target.value)}
                >
                  <option value="Net 7">Net 7 Days</option>
                  <option value="Net 15">Net 15 Days</option>
                  <option value="Net 30">Net 30 Days</option>
                  <option value="Net 45">Net 45 Days</option>
                  <option value="Net 60">Net 60 Days</option>
                  <option value="Due on Receipt">Due on Receipt</option>
                </select>
              </Field>
              <Field 
                label={t('addBusinessModal.accountStatusLabel', { defaultValue: 'Initial Account Status' })}
              >
                <select
                  value={formData.status}
                  onChange={e => set('status', e.target.value as any)}
                >
                  <option value="pending">
                    {t('addBusinessModal.statusPending', { defaultValue: 'Pending Review' })}
                  </option>
                  <option value="active">
                    {t('addBusinessModal.statusActive', { defaultValue: 'Active (Start Immediately)' })}
                  </option>
                </select>
              </Field>
            </div>
          </section>

          {/* Section 4: Internal Notes */}
          <section className="job-form-section">
            <div className="job-section-heading">
              <span>04</span>
              <div>
                <h3>
                  {t('addBusinessModal.internalNotesTitle', { defaultValue: 'Internal Notes & Follow-up' })}
                </h3>
                <p>
                  {t('addBusinessModal.internalNotesHint', { 
                    defaultValue: 'Track onboarding progress, pricing agreements, and operational notes (internal use only).' 
                  })}
                </p>
              </div>
            </div>
            <div className="pricing-grid">
              <Field 
                label={t('addBusinessModal.followUpNotesLabel', { defaultValue: 'CRM Notes & Follow-up Log' })}
                wide
              >
                <textarea
                  value={formData.follow_up_notes}
                  onChange={e => set('follow_up_notes', e.target.value)}
                  placeholder={t('addBusinessModal.followUpNotesPlaceholder', { 
                    defaultValue: 'e.g., Initial call on [date], awaiting contract review, pre-agreed rate AED 45/job...' 
                  })}
                  rows={6}
                  style={{ resize: 'vertical', minHeight: '120px' }}
                />
              </Field>
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="job-form-footer">
          <button 
            type="button" 
            className="outline-button" 
            onClick={onClose}
            disabled={loading}
          >
            {t('addBusinessModal.cancelButton', { defaultValue: 'Cancel' })}
          </button>
          <button 
            type="submit" 
            className="dark-button" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('addBusinessModal.savingButton', { defaultValue: 'Creating Account...' })}
              </>
            ) : (
              <>
                {t('addBusinessModal.saveButton', { defaultValue: 'Create Business Account' })}
              </>
            )}
          </button>
        </div>
      </form>
    </>,
    document.body
  );
};
