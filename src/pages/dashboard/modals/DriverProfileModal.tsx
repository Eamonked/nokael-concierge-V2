import React from 'react';
import { createPortal } from 'react-dom';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Truck,
  Navigation,
  Clock,
  FileText,
  ExternalLink,
  Copy,
  X,
  CheckCircle2,
  XCircle,
  LogOut,
  Loader2,
  MessageCircle,
  IdCard,
  Hash,
  Circle,
  Upload,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { setDriverPin, revokeDriverSessions, uploadDriverDocument, type Driver, type DriverDocument } from '../../../lib/supabase';
import { WriteGuard } from '../permissions';
import { DOCUMENT_TYPES } from '../../driver-application/constants';
import { driverInterEmirate, driverPhoneKey, driverEmailKey, uploadDriverDocFile, DRIVER_DOC_ACCEPT } from '../../../lib/driverAccess';

interface DriverProfileModalProps {
  driver: Driver & { documents: DriverDocument[] };
  onClose: () => void;
  onDriverStatusUpdate: (id: string, updates: Partial<Driver>) => Promise<void>;
}

const InfoRow: React.FC<{ icon: React.ElementType; title?: string; children: React.ReactNode }> = ({ icon: RowIcon, title, children }) => (
  <li className="driver-info-row">
    <span aria-hidden="true"><RowIcon /></span>
    <span title={title}>{children}</span>
  </li>
);

const SectionHeading: React.FC<{ index: string; title: string; hint?: string }> = ({ index, title, hint }) => (
  <div className="job-section-heading">
    <span>{index}</span>
    <div>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
    </div>
  </div>
);

export function DriverProfileModal({ driver, onClose, onDriverStatusUpdate }: DriverProfileModalProps) {
  const { t } = useTranslation('dashboard');
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [pinDraft, setPinDraft] = React.useState('');
  // has_pin comes from the generated column; flip it locally after a successful set.
  const [hasPin, setHasPin] = React.useState(!!driver.has_pin);
  React.useEffect(() => { setHasPin(!!driver.has_pin); }, [driver.id, driver.has_pin]);
  const [copiedDriverLink, setCopiedDriverLink] = React.useState(false);
  // Documents uploaded from this drawer are added locally so the checklist
  // updates straight away, without refetching the driver.
  const [documents, setDocuments] = React.useState<DriverDocument[]>(driver.documents || []);
  const [uploadingType, setUploadingType] = React.useState<string | null>(null);
  React.useEffect(() => { setDocuments(driver.documents || []); }, [driver.documents]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleUpdate = async (updates: Partial<Driver>) => {
    setIsUpdating(true);
    try {
      await onDriverStatusUpdate(driver.id!, updates);
    } finally {
      setIsUpdating(false);
    }
  };

  const cocDomain = (import.meta.env.VITE_COC_URL || 'https://nokael.ae').replace(/\/$/, '');
  const statusUrl = `${cocDomain}/driver/${driver.id}/status`;

  const poolStatus: Record<string, { label: string; tone: string }> = {
    available: { label: t('driverProfileModal.dispatchStatus.availableNow'), tone: 'ok' },
    on_job:    { label: t('driverProfileModal.dispatchStatus.onJob'),        tone: 'warn' },
    offline:   { label: t('driverProfileModal.dispatchStatus.offline'),      tone: 'idle' },
  };
  const dispatchStatus = poolStatus[driver.status || 'offline'] || poolStatus.offline;

  const onboarding = driver.onboarding_status || 'pending';
  const onboardingTone = onboarding === 'approved' ? 'ok' : onboarding === 'rejected' ? 'bad' : 'warn';
  const reliability = isNaN(driver.reliability_score!) ? 0 : (driver.reliability_score || 0);
  const pinValid = /^[0-9]{4,6}$/.test(pinDraft);
  const initials = (driver.full_name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const handleSetPin = async () => {
    if (!pinValid) return;
    try {
      await setDriverPin(driver.id!, pinDraft);
      setPinDraft('');
      setHasPin(true);
      alert(t('driverProfileModal.pinSetAlert', { name: driver.full_name }));
    } catch (err: any) {
      alert(t('driverProfileModal.pinFailedAlert', { error: err.message || String(err) }));
    }
  };

  const handleSignOutEverywhere = async () => {
    if (!confirm(t('driverProfileModal.signOutConfirm', { defaultValue: 'Sign {{name}} out of the driver app on every device?', name: driver.full_name }))) return;
    try {
      await revokeDriverSessions(driver.id!);
      alert(t('driverProfileModal.signOutDone', { defaultValue: '{{name}} has been signed out everywhere.', name: driver.full_name }));
    } catch (err: any) {
      alert(t('driverProfileModal.signOutFailed', { defaultValue: 'Could not sign out driver: {{error}}', error: err.message || String(err) }));
    }
  };

  const copyStatusLink = () => {
    navigator.clipboard.writeText(statusUrl);
    setCopiedDriverLink(true);
    setTimeout(() => setCopiedDriverLink(false), 2000);
  };

  const ti = (key: string, defaultValue?: string) => t(key, { ns: 'driverApplication', defaultValue });
  const docTypeLabel = (type: string) => {
    const known = DOCUMENT_TYPES.find(d => d.id === type);
    return known ? ti(`step2.documentTypes.${known.i18nKey}.label`, type.replace(/_/g, ' ')) : type.replace(/_/g, ' ');
  };
  // Checklist of the four documents the intake form asks for, newest upload per type,
  // plus anything else that was uploaded.
  const docsByType = new Map<string, DriverDocument>();
  [...documents]
    .sort((a, b) => (b.uploaded_at || '').localeCompare(a.uploaded_at || ''))
    .forEach(doc => { if (!docsByType.has(doc.document_type)) docsByType.set(doc.document_type, doc); });
  const docChecklist: { type: string; doc?: DriverDocument }[] = [
    ...DOCUMENT_TYPES.map(d => ({ type: d.id, doc: docsByType.get(d.id) })),
    ...[...docsByType.keys()].filter(type => !DOCUMENT_TYPES.some(d => d.id === type)).map(type => ({ type, doc: docsByType.get(type) })),
  ];

  // Same upload path as the intake form and Add Agent: Google Drive via
  // /api/upload-driver-doc, then a driver_documents row awaiting review.
  const handleDocUpload = async (type: string, file: File) => {
    if (!driver.id) return;
    setUploadingType(type);
    try {
      const uploaded = await uploadDriverDocFile(file);
      const doc: DriverDocument = {
        driver_id: driver.id,
        document_type: type as DriverDocument['document_type'],
        file_url: uploaded.file_url,
        drive_file_id: uploaded.drive_file_id,
        verification_status: 'pending',
      };
      await uploadDriverDocument(doc);
      setDocuments(prev => [...prev, { ...doc, uploaded_at: new Date().toISOString() }]);
    } catch (err: any) {
      console.error(`Error uploading ${type}:`, err);
      alert(t('driverProfileModal.docUploadFailed', {
        doc: docTypeLabel(type),
        error: err?.message || String(err),
        defaultValue: '{{doc}} did not upload: {{error}}',
      }));
    } finally {
      setUploadingType(null);
    }
  };

  const vehicleDetail = [driver.vehicle_make, driver.vehicle_model].filter(Boolean).join(' ');
  const showWhatsapp = !!driver.whatsapp && driverPhoneKey(driver.whatsapp) !== driverPhoneKey(driver.phone);

  // Mirrors the driver_login checks (see lib/driverAccess.ts). The PIN hash is
  // not readable here; has_pin (generated column) only says whether one is set.
  const signInChecks = [
    { ok: onboarding === 'approved', label: t('driverProfileModal.signIn.approved', { defaultValue: 'Application approved' }) },
    { ok: driver.active !== false, label: t('driverProfileModal.signIn.active', { defaultValue: 'Account active' }) },
    { ok: !!driverPhoneKey(driver.phone) || !!driverEmailKey(driver.email), label: t('driverProfileModal.signIn.identifier', { defaultValue: 'Phone number on file (9+ digits)' }) },
    { ok: hasPin, label: hasPin
      ? t('driverProfileModal.signIn.pinSet', { defaultValue: 'PIN set' })
      : t('driverProfileModal.signIn.pinMissing', { defaultValue: 'No PIN set yet' }) },
  ];
  const signInReady = signInChecks.every(c => c.ok);

  return createPortal(
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div
        className="account-drawer job-form-drawer driver-profile-drawer enterprise-mode"
        role="dialog"
        aria-modal="true"
        aria-labelledby="driver-profile-title"
      >
        {/* Header: avatar, name, ID and onboarding status */}
        <div className="job-form-header">
          <div className="driver-hero">
            <span className="driver-avatar" aria-hidden="true">{initials || <User className="w-5 h-5" />}</span>
            <div>
              <span className="eyebrow">{t('driverProfileModal.internalManagement')}</span>
              <h2 id="driver-profile-title" title={driver.full_name}>{driver.full_name}</h2>
              <div className="driver-meta">
                <span className="driver-id-pill">{t('driverProfileModal.driverIdLabel')} {driver.id?.substring(0, 8)}</span>
                <span className={`driver-pill ${onboardingTone}`}>
                  <i aria-hidden="true" />
                  {t(`driverProfileModal.onboardingStatus.${onboarding}`, { defaultValue: onboarding })}
                </span>
              </div>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('businessDetailsModal.close', { defaultValue: 'Close' })}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <WriteGuard>
        <div className="job-form-body">
          {/* 01 Contact + vehicle */}
          <section className="job-form-section">
            <SectionHeading index="01" title={`${t('driverProfileModal.contactDetails')} · ${t('driverProfileModal.vehicleLogistics')}`} />
            <div className="driver-info-grid">
              <div className="driver-info-card">
                <h4>{t('driverProfileModal.contactDetails')}</h4>
                <ul>
                  <InfoRow icon={Phone} title={driver.phone}><span className="mono">{driver.phone}</span></InfoRow>
                  {showWhatsapp && (
                    <InfoRow icon={MessageCircle} title={driver.whatsapp}><span className="mono">{driver.whatsapp}</span></InfoRow>
                  )}
                  <InfoRow icon={Mail} title={driver.email}>{driver.email || '—'}</InfoRow>
                  <InfoRow icon={MapPin} title={driver.base_location}>{driver.base_location || '—'}</InfoRow>
                  {driver.emirates_id && (
                    <InfoRow icon={IdCard} title={driver.emirates_id}><span className="mono">{driver.emirates_id}</span></InfoRow>
                  )}
                </ul>
              </div>
              <div className="driver-info-card">
                <h4>{t('driverProfileModal.vehicleLogistics')}</h4>
                <ul>
                  <InfoRow icon={Truck} title={[driver.vehicle_type, vehicleDetail].filter(Boolean).join(' · ')}>
                    {driver.vehicle_type || '—'}{vehicleDetail && <span className="driver-sub"> · {vehicleDetail}</span>}
                  </InfoRow>
                  {driver.vehicle_plate && (
                    <InfoRow icon={Hash} title={driver.vehicle_plate}><span className="mono">{driver.vehicle_plate}</span></InfoRow>
                  )}
                  <InfoRow icon={Navigation}>
                    {t('driverProfileModal.interEmirate')}: {driverInterEmirate(driver) ? t('driverProfileModal.yes') : t('driverProfileModal.no')}
                  </InfoRow>
                  <InfoRow icon={Clock} title={driver.availability_hours}>{driver.availability_hours || '—'}</InfoRow>
                </ul>
              </div>
            </div>
          </section>

          {/* 02 Documents checklist */}
          <section className="job-form-section">
            <SectionHeading index="02" title={t('driverProfileModal.uploadedDocuments')} />
            <ul className="driver-doc-list">
              {docChecklist.map(({ type, doc }) => (
                <li key={type} className={doc ? undefined : 'missing'}>
                  {!doc
                    ? <Circle aria-hidden="true" />
                    : doc.verification_status === 'verified'
                    ? <CheckCircle2 className="doc-ok" aria-hidden="true" />
                    : doc.verification_status === 'rejected'
                    ? <XCircle className="doc-bad" aria-hidden="true" />
                    : <FileText aria-hidden="true" />}
                  <div>
                    <b title={docTypeLabel(type)}>{docTypeLabel(type)}</b>
                    <small>
                      {doc
                        ? `${t('driverProfileModal.docStatusLabel')}: ${doc.verification_status || 'pending'}`
                        : t('driverProfileModal.docMissing', { defaultValue: 'Not uploaded' })}
                    </small>
                  </div>
                  <span className="driver-doc-actions">
                    <label
                      className={uploadingType === type ? 'is-uploading' : undefined}
                      title={doc
                        ? ti('step2.replaceFile', 'Replace File')
                        : ti('step2.uploadFile', 'Upload File')}
                    >
                      <input
                        type="file"
                        accept={DRIVER_DOC_ACCEPT}
                        disabled={uploadingType !== null}
                        aria-label={`${docTypeLabel(type)}: ${doc ? ti('step2.replaceFile', 'Replace File') : ti('step2.uploadFile', 'Upload File')}`}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) handleDocUpload(type, file);
                        }}
                      />
                      {uploadingType === type ? <Loader2 className="animate-spin" /> : <Upload />}
                    </label>
                    {doc && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t('driverProfileModal.openLink')}
                        aria-label={`${docTypeLabel(type)}: ${t('driverProfileModal.openLink')}`}
                      >
                        <ExternalLink />
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* 03 Dispatch controls */}
          <section className="job-form-section">
            <SectionHeading index="03" title={t('driverProfileModal.internalManagement')} hint={t('driverProfileModal.dispatchPoolHint')} />
            <div className="driver-controls-grid">
              <label className="field">
                <span className="field-label" title={t('driverProfileModal.tieringStrategy')}>{t('driverProfileModal.tieringStrategy')}</span>
                <select value={driver.tier || 'D'} onChange={(e) => handleUpdate({ tier: e.target.value as any })}>
                  <option value="A">{t('driverProfileModal.tiers.elite')}</option>
                  <option value="B">{t('driverProfileModal.tiers.priority')}</option>
                  <option value="C">{t('driverProfileModal.tiers.standard')}</option>
                  <option value="D">{t('driverProfileModal.tiers.newArrival')}</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label" title="Core = full-time, Flex = part-time, Surge = on-call (shown under Standby on the Drivers tab)">
                  {t('driverProfileModal.poolRole', { defaultValue: 'Pool role' })}
                </span>
                <select
                  value={driver.availability || 'on-call'}
                  onChange={(e) => handleUpdate({ availability: e.target.value as Driver['availability'] })}
                >
                  <option value="full-time">{t('driverProfileModal.pool.core', { defaultValue: 'Core · full-time' })}</option>
                  <option value="part-time">{t('driverProfileModal.pool.flex', { defaultValue: 'Flex · part-time' })}</option>
                  <option value="on-call">{t('driverProfileModal.pool.surge', { defaultValue: 'Surge · on-call' })}</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label" title={t('driverProfileModal.reliabilityScore')}>{t('driverProfileModal.reliabilityScore')}</span>
                <div className="driver-score">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={reliability}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      handleUpdate({ reliability_score: isNaN(val) ? 0 : val });
                    }}
                  />
                  <div className="driver-score-bar"><i style={{ width: `${Math.min(100, reliability * 10)}%` }} /></div>
                </div>
              </label>
              <div className="field">
                <span className="field-label" title={t('driverProfileModal.dispatchPoolStatus')}>{t('driverProfileModal.dispatchPoolStatus')}</span>
                <span className={`driver-pool ${dispatchStatus.tone}`}>
                  <i aria-hidden="true" />
                  {dispatchStatus.label}
                </span>
              </div>
            </div>
          </section>

          {/* 04 Driver app access */}
          <section className="job-form-section">
            <SectionHeading
              index="04"
              title={t('driverProfileModal.driverAppPin')}
              hint={t('driverProfileModal.pinLoginHint', {
                defaultValue: 'The driver signs in to the Nokael Driver app with their phone number (or email) and uses this 4–6 digit PIN as the password. Send them the PIN over WhatsApp.',
              })}
            />
            <div className={`driver-signin ${signInReady ? 'ready' : 'blocked'}`}>
              <div className="driver-signin-head">
                <b>
                  {signInReady
                    ? t('driverProfileModal.signIn.readyWithPin', { defaultValue: 'Can sign in to the driver app' })
                    : t('driverProfileModal.signIn.blocked', { defaultValue: 'Can’t sign in to the driver app yet' })}
                </b>
                {driverPhoneKey(driver.phone) && (
                  <span>
                    {t('driverProfileModal.signIn.with', { defaultValue: 'Signs in with' })} <span className="mono">{driver.phone}</span>
                  </span>
                )}
              </div>
              <ul>
                {signInChecks.map(check => (
                  <li key={check.label} className={check.ok ? 'ok' : 'bad'}>
                    {check.ok ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                    {check.label}
                  </li>
                ))}
              </ul>
            </div>
            <form
              className="driver-pin-row"
              onSubmit={(e) => {
                e.preventDefault();
                handleSetPin();
              }}
            >
              <label className="field">
                <input
                  type="text"
                  aria-label={t('driverProfileModal.driverAppPin')}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  placeholder={t('driverProfileModal.pinPlaceholder')}
                  value={pinDraft}
                  onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ''))}
                />
              </label>
              <button type="submit" className="dark-button" disabled={!pinValid || isUpdating}>
                {t('driverProfileModal.setPin')}
              </button>
            </form>
            <p className="driver-note">
              {t('driverProfileModal.pinSignsOut', { defaultValue: 'Setting a new PIN also signs the driver out of every device.' })}
            </p>
            <div className="driver-access-actions">
              <div className="driver-link-group">
                <button type="button" className="outline-button" onClick={copyStatusLink}>
                  {copiedDriverLink ? <CheckCircle2 className="doc-ok" aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  <span>{copiedDriverLink ? t('driverProfileModal.copied') : t('driverProfileModal.copyStatusLink')}</span>
                </button>
                <a
                  className="outline-button"
                  href={statusUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t('driverProfileModal.openLink')}
                  aria-label={t('driverProfileModal.openLink')}
                >
                  <ExternalLink aria-hidden="true" />
                </a>
              </div>
              <button type="button" className="driver-signout" disabled={isUpdating} onClick={handleSignOutEverywhere}>
                <LogOut aria-hidden="true" />
                <span>{t('driverProfileModal.signOutEverywhere', { defaultValue: 'Sign out everywhere' })}</span>
              </button>
            </div>
          </section>

          {/* 05 Internal notes */}
          <section className="job-form-section">
            <SectionHeading index="05" title={t('driverProfileModal.internalAuditNotes')} />
            <label className="field wide">
              <textarea
                rows={4}
                aria-label={t('driverProfileModal.internalAuditNotes')}
                placeholder={t('driverProfileModal.notesPlaceholder')}
                value={driver.internal_notes || ''}
                onChange={(e) => handleUpdate({ internal_notes: e.target.value })}
              />
            </label>
          </section>
        </div>

        {/* Footer: quiet destructive action, one clear primary */}
        <div className="job-form-footer">
          <button
            type="button"
            className="driver-reject-button"
            disabled={isUpdating}
            onClick={() => handleUpdate({ onboarding_status: 'rejected', pipeline_status: 'Rejected' })}
          >
            <XCircle aria-hidden="true" />
            {t('driverProfileModal.rejectApplication')}
          </button>
          <button
            type="button"
            className="driver-approve-button"
            disabled={isUpdating}
            // Login needs active + approved; the dashboard's driver stats count pipeline_status 'Active'.
            onClick={() => handleUpdate({ onboarding_status: 'approved', pipeline_status: 'Active', active: true })}
          >
            {isUpdating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
            {driver.onboarding_status === 'approved' ? t('driverProfileModal.updateReapprove') : t('driverProfileModal.approveDriver')}
          </button>
        </div>
        </WriteGuard>
      </div>
    </>,
    document.body
  );
}
