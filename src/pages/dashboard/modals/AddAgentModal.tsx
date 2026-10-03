import React from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Upload, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase, uploadDriverDocument, type Driver, type PipelineStatus } from '../../../lib/supabase';
import { getActiveOrgId, getActiveTenant } from '../../../lib/tenant';
import { DOCUMENT_TYPES, VEHICLE_TYPES, DAYS_OF_WEEK } from '../../driver-application/constants';
import {
  driverPhoneKey,
  driverEmailKey,
  driverIdentityConflict,
  uploadDriverDocFile,
  DRIVER_DOC_ACCEPT,
  DRIVER_DOC_MAX_BYTES,
} from '../../../lib/driverAccess';

// Suggestions only: base location is free text, same as the public intake form.
const UAE_EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain', 'Al Ain'];
// Suggestions only (a datalist) — UAE companies keep this list, others get their regions.
const regionList = () => (getActiveTenant().settings.country === 'AE' ? UAE_EMIRATES : getActiveTenant().settings.regions);

// Stages the Drivers view filters and counts on (see selectors.ts). 'Active' and
// 'Rejected' are set later from the driver drawer's Approve / Reject buttons.
const INITIAL_STAGES: { value: PipelineStatus; key: string; label: string }[] = [
  { value: 'Sourced', key: 'sourced', label: 'Sourced' },
  { value: 'Screening', key: 'screening', label: 'Screening' },
  { value: 'Docs Pending', key: 'docsPending', label: 'Docs Pending' },
  { value: 'Trial Scheduled', key: 'trialScheduled', label: 'Trial Scheduled' },
];

type DocType = (typeof DOCUMENT_TYPES)[number]['id'];

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
    {hint && <small className="field-hint">{hint}</small>}
  </label>
);

interface AddAgentModalProps {
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export const AddAgentModal: React.FC<AddAgentModalProps> = ({ onClose, onSuccess }) => {
  const { t } = useTranslation('dashboard');
  // Shared labels come from the public intake form so both say the same thing.
  const ti = (key: string, defaultValue?: string) => t(key, { ns: 'driverApplication', defaultValue });
  const [loading, setLoading] = React.useState(false);

  // Same fields and stored values as the public intake form (submitDriverApplication),
  // plus the admin-only extras: Emirates ID, plate, make/model and pipeline stage.
  const [formData, setFormData] = React.useState({
    full_name: '',
    phone: '',
    whatsapp: '',
    email: '',
    emirates_id: '',
    base_location: '',
    vehicle_type: VEHICLE_TYPES[0].value,
    vehicle_plate: '',
    vehicle_make: '',
    vehicle_model: '',
    pipeline_status: 'Screening' as PipelineStatus,
    inter_emirate: true,
  });

  // Availability is stored exactly like the intake form: "Mon, Tue, Wed | 08:00 - 20:00".
  const [selectedDays, setSelectedDays] = React.useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [startTime, setStartTime] = React.useState('08:00');
  const [endTime, setEndTime] = React.useState('20:00');
  const availabilityHours = `${DAYS_OF_WEEK.filter(d => selectedDays.includes(d.id)).map(d => d.label).join(', ')} | ${startTime} - ${endTime}`;

  const [files, setFiles] = React.useState<Partial<Record<DocType, File>>>({});

  const set = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  const toggleDay = (id: string) =>
    setSelectedDays(prev => (prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]));

  const pickFile = (type: DocType, file: File | undefined) => {
    if (!file) return;
    if (file.size > DRIVER_DOC_MAX_BYTES) {
      alert(t('addAgentModal.fileTooLarge', { defaultValue: 'File size must be less than 10MB' }));
      return;
    }
    setFiles(prev => ({ ...prev, [type]: file }));
  };

  /**
   * The driver app finds a driver by the last 9 digits of their phone/WhatsApp,
   * or by email, so each must belong to one driver only. The database enforces
   * this (supabase-driver-unique-identity.sql); checking first lets us name the
   * driver who already has it. RLS limits this to our org, the database covers the rest.
   */
  const findSignInConflicts = async (): Promise<string[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('drivers').select('full_name, phone, whatsapp, email');
    const existing = (data || []) as Pick<Driver, 'full_name' | 'phone' | 'whatsapp' | 'email'>[];
    const keys = [driverPhoneKey(formData.phone), driverPhoneKey(formData.whatsapp)].filter(Boolean);
    const email = driverEmailKey(formData.email);
    return existing
      .filter(d =>
        keys.some(k => k === driverPhoneKey(d.phone) || k === driverPhoneKey(d.whatsapp)) ||
        (email !== null && email === driverEmailKey(d.email)))
      .map(d => d.full_name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name.trim() || !formData.phone.trim() || !formData.base_location.trim()) {
      alert(t('addAgentModal.requiredFieldsAlert', { defaultValue: 'Please fill in all required fields.' }));
      return;
    }
    if (!driverPhoneKey(formData.phone) || (formData.whatsapp.trim() && !driverPhoneKey(formData.whatsapp))) {
      alert(t('addAgentModal.phoneTooShort', {
        defaultValue: 'Enter the full mobile number with at least 9 digits. The driver app signs drivers in with it.',
      }));
      return;
    }
    if (selectedDays.length === 0) {
      alert(t('addAgentModal.pickDays', { defaultValue: 'Pick at least one working day.' }));
      return;
    }

    setLoading(true);

    try {
      if (!supabase) throw new Error('Supabase not configured');

      const conflicts = await findSignInConflicts();
      if (conflicts.length > 0) {
        alert(t('addAgentModal.identityTakenBy', {
          names: conflicts.join(', '),
          defaultValue: 'This phone number or email already belongs to: {{names}}.\n\nEach driver needs their own number and email to sign in to the driver app. Open that driver instead, or use different details.',
        }));
        setLoading(false);
        return;
      }

      const driverId = crypto.randomUUID();
      const agentId = `CR-${Math.floor(1000 + Math.random() * 9000)}`;

      // Same columns the intake form writes, so drivers from either path look the same
      // in the dashboard. `active` stays true (the column default the intake form gets);
      // app sign-in is gated by approval, which the driver drawer sets.
      const { error: driverError } = await supabase.from('drivers').insert([{
        id: driverId,
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        whatsapp: formData.whatsapp.trim() || formData.phone.trim(),
        email: formData.email.trim(),
        emirates_id: formData.emirates_id.trim() || null,
        base_location: formData.base_location.trim(),
        vehicle_type: formData.vehicle_type,
        vehicle_plate: formData.vehicle_plate.trim().toUpperCase() || null,
        vehicle_make: formData.vehicle_make.trim() || null,
        vehicle_model: formData.vehicle_model.trim() || null,
        inter_emirate_yes_no: formData.inter_emirate,
        availability_hours: availabilityHours,
        pipeline_status: formData.pipeline_status,
        onboarding_status: 'pending',
        status: 'offline',
        active: true,
        tier: 'D',
        organization_id: getActiveOrgId(),
        internal_notes: `Agent ID: ${agentId}`,
      }]);
      if (driverError) {
        const conflict = driverIdentityConflict(driverError);
        if (conflict) {
          alert(conflict === 'phone'
            ? t('addAgentModal.phoneTaken', { defaultValue: 'Another driver already has this phone or WhatsApp number. Each driver needs their own number to sign in to the driver app.' })
            : t('addAgentModal.emailTaken', { defaultValue: 'Another driver already has this email. Each driver needs their own email to sign in to the driver app.' }));
          return;
        }
        throw driverError;
      }

      // Same upload path as the intake form: Google Drive via /api/upload-driver-doc,
      // then a driver_documents row the driver drawer lists.
      const failed: string[] = [];
      for (const doc of DOCUMENT_TYPES) {
        const file = files[doc.id];
        if (!file) continue;
        try {
          const uploaded = await uploadDriverDocFile(file);
          await uploadDriverDocument({
            driver_id: driverId,
            document_type: doc.id as any,
            file_url: uploaded.file_url,
            drive_file_id: uploaded.drive_file_id,
            verification_status: 'pending',
          });
        } catch (err: any) {
          console.error(`Error uploading ${doc.id}:`, err);
          failed.push(`${ti(`step2.documentTypes.${doc.i18nKey}.label`, doc.id)} (${err?.message || err})`);
        }
      }
      if (failed.length > 0) {
        alert(t('addAgentModal.uploadsFailed', {
          list: failed.join('\n'),
          defaultValue: 'The agent was saved, but these documents did not upload:\n{{list}}',
        }));
      }

      await onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating agent:', err);
      alert(t('addAgentModal.createFailedAlert', { defaultValue: 'Failed to create agent. Please try again.' }));
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <form className="account-drawer job-form-drawer add-agent-drawer enterprise-mode" onSubmit={handleSubmit}>
        <div className="job-form-header">
          <div>
            <span className="eyebrow">{t('addAgentModal.eyebrow', { defaultValue: 'AGENT ONBOARDING' })}</span>
            <h2>{t('addAgentModal.title', { defaultValue: 'Add New Agent' })}</h2>
            <p>
              {t('addAgentModal.subtitle', {
                defaultValue: 'Complete the agent profile and upload required documents for fleet registration.',
              })}
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('addAgentModal.cancelLabel', { defaultValue: 'Cancel' })}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="job-form-body">
          {/* 01 Identity & contact: the fields the driver app signs in with */}
          <section className="job-form-section">
            <div className="job-section-heading">
              <span>01</span>
              <div>
                <h3>{t('addAgentModal.personalDetailsTitle', { defaultValue: 'Personal & Profile Details' })}</h3>
                <p>{t('addAgentModal.personalDetailsHint', { defaultValue: 'Basic identity information for the new agent.' })}</p>
              </div>
            </div>
            <div className="agent-grid">
              <Field label={ti('step1.fullNameLabel', 'Full Name')} required>
                <input required type="text" value={formData.full_name} onChange={e => set('full_name', e.target.value)} placeholder={ti('step1.fullNamePlaceholder', 'As per Emirates ID')} />
              </Field>
              <Field label={t('addAgentModal.emiratesIdLabel', { defaultValue: 'Emirates ID Number' })}>
                <input type="text" value={formData.emirates_id} onChange={e => set('emirates_id', e.target.value)} placeholder={t('addAgentModal.emiratesIdPlaceholder', { defaultValue: '' })} />
              </Field>
              <Field
                label={ti('step1.phoneLabel', 'Phone Number')}
                required
                hint={t('addAgentModal.phoneLoginHint', { defaultValue: 'Must be unique to this driver. They sign in to the app with it.' })}
              >
                <input required type="tel" inputMode="tel" value={formData.phone} onChange={e => set('phone', e.target.value)} placeholder="+971 50 123 4567" />
              </Field>
              <Field
                label={ti('step1.whatsappLabel', 'WhatsApp Number')}
                hint={t('addAgentModal.whatsappHint', { defaultValue: 'Leave empty to use the phone number.' })}
              >
                <input type="tel" inputMode="tel" value={formData.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="+971" />
              </Field>
              <Field
                label={ti('step1.emailLabel', 'Email Address')}
                wide
                hint={t('addAgentModal.emailLoginHint', { defaultValue: 'Optional. Must be unique to this driver; it also works as their app sign-in.' })}
              >
                <input type="email" value={formData.email} onChange={e => set('email', e.target.value)} placeholder="driver@example.com" />
              </Field>
            </div>
          </section>

          {/* 02 Vehicle */}
          <section className="job-form-section">
            <div className="job-section-heading">
              <span>02</span>
              <div>
                <h3>{t('addAgentModal.vehicleDetailsTitle', { defaultValue: 'Vehicle Assignment' })}</h3>
                <p>{t('addAgentModal.vehicleDetailsHint', { defaultValue: 'Assign vehicle type and registration details.' })}</p>
              </div>
            </div>
            <div className="agent-grid">
              <Field label={ti('step1.vehicleCategoryLabel', 'Vehicle Category')} required>
                <select required value={formData.vehicle_type} onChange={e => set('vehicle_type', e.target.value)}>
                  {VEHICLE_TYPES.map(v => (
                    <option key={v.value} value={v.value}>{ti(`step1.vehicleTypes.${v.i18nKey}`, v.value)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('addAgentModal.licensePlateLabel', { defaultValue: 'License Plate Number' })}>
                <input type="text" value={formData.vehicle_plate} onChange={e => set('vehicle_plate', e.target.value.toUpperCase())} placeholder="DXB-A-12345" />
              </Field>
              <Field label={t('addAgentModal.vehicleMakeLabel', { defaultValue: 'Vehicle Make' })}>
                <input type="text" value={formData.vehicle_make} onChange={e => set('vehicle_make', e.target.value)} placeholder={t('addAgentModal.vehicleMakePlaceholder', { defaultValue: 'Toyota, Nissan, etc.' })} />
              </Field>
              <Field label={t('addAgentModal.vehicleModelLabel', { defaultValue: 'Vehicle Model' })}>
                <input type="text" value={formData.vehicle_model} onChange={e => set('vehicle_model', e.target.value)} placeholder={t('addAgentModal.vehicleModelPlaceholder', { defaultValue: 'Hiace, Patrol, etc.' })} />
              </Field>
            </div>
          </section>

          {/* 03 Coverage & availability: same questions as the intake form */}
          <section className="job-form-section">
            <div className="job-section-heading">
              <span>03</span>
              <div>
                <h3>{t('addAgentModal.statusAssignmentTitle', { defaultValue: 'Status & Regional Assignment' })}</h3>
                <p>{ti('step1.availabilitySubtitle', 'Select your active dispatch days and hours')}</p>
              </div>
            </div>
            <div className="agent-grid">
              <Field label={t('addAgentModal.initialStatusLabel', { defaultValue: 'Initial Status' })}>
                <select value={formData.pipeline_status} onChange={e => set('pipeline_status', e.target.value as PipelineStatus)}>
                  {INITIAL_STAGES.map(stage => (
                    <option key={stage.value} value={stage.value}>
                      {t(`addAgentModal.status.${stage.key}`, { defaultValue: stage.label })}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={ti('step1.baseLocationLabel', 'Base Location (Area/City)')} required>
                <input required type="text" list="agent-emirates" value={formData.base_location} onChange={e => set('base_location', e.target.value)} placeholder={ti('step1.baseLocationPlaceholder', 'e.g. Al Barsha, Dubai')} />
                <datalist id="agent-emirates">
                  {regionList().map(em => <option key={em} value={em} />)}
                </datalist>
              </Field>
              <div className="field wide">
                <span>{ti('step1.availabilityTitle', 'Availability Window')} *</span>
                <div className="chips agent-day-chips" role="group" aria-label={ti('step1.availabilityTitle', 'Availability Window')}>
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.id}
                      type="button"
                      aria-pressed={selectedDays.includes(day.id)}
                      className={selectedDays.includes(day.id) ? 'selected' : ''}
                      onClick={() => toggleDay(day.id)}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
              <Field label={ti('step1.startShiftLabel', 'Start Shift')}>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </Field>
              <Field label={ti('step1.endShiftLabel', 'End Shift')}>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </Field>
              <div className="field wide">
                <span>{ti('step1.interEmirateTitle', 'Inter-Emirate Dispatch')}</span>
                <div className="agent-yes-no" role="radiogroup">
                  {[true, false].map(value => (
                    <button
                      key={String(value)}
                      type="button"
                      role="radio"
                      aria-checked={formData.inter_emirate === value}
                      className={formData.inter_emirate === value ? 'selected' : ''}
                      onClick={() => set('inter_emirate', value)}
                    >
                      {value ? ti('step1.yes', 'Yes') : ti('step1.no', 'No')}
                    </button>
                  ))}
                </div>
                <small className="field-hint">{ti('step1.interEmirateDesc')}</small>
              </div>
            </div>
          </section>

          {/* 04 Documents: the same four the intake form asks for */}
          <section className="job-form-section">
            <div className="job-section-heading">
              <span>04</span>
              <div>
                <h3>{t('addAgentModal.documentsTitle', { defaultValue: 'Document Uploads' })}</h3>
                <p>{t('addAgentModal.documentsHint', { defaultValue: 'Upload required documents for verification (optional at this stage).' })}</p>
              </div>
            </div>
            <div className="agent-doc-list">
              {DOCUMENT_TYPES.map(doc => {
                const file = files[doc.id];
                const inputId = `agent-doc-${doc.id}`;
                return (
                  <label key={doc.id} htmlFor={inputId} className={`agent-doc-row${file ? ' has-file' : ''}`}>
                    <input
                      id={inputId}
                      type="file"
                      accept={DRIVER_DOC_ACCEPT}
                      onChange={e => {
                        pickFile(doc.id, e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                    <span className="agent-doc-icon" aria-hidden="true">
                      {file ? <CheckCircle2 className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                    </span>
                    <span className="agent-doc-text">
                      <b>{ti(`step2.documentTypes.${doc.i18nKey}.label`, doc.id)}</b>
                      <small title={file?.name}>{file ? file.name : ti(`step2.documentTypes.${doc.i18nKey}.description`)}</small>
                    </span>
                    <span className="agent-doc-action">
                      {file ? ti('step2.replaceFile', 'Replace File') : ti('step2.uploadFile', 'Upload File')}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        <div className="job-form-footer">
          <button type="button" className="outline-button" onClick={onClose} disabled={loading}>
            {t('addAgentModal.cancelButton', { defaultValue: 'Cancel' })}
          </button>
          <button type="submit" className="dark-button" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('addAgentModal.savingButton', { defaultValue: 'Creating Agent...' })}
              </>
            ) : (
              t('addAgentModal.saveButton', { defaultValue: 'Create Agent' })
            )}
          </button>
        </div>
      </form>
    </>,
    document.body
  );
};
