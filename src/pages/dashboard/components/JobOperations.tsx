import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  AlertTriangle, Check, CheckCircle2, CheckSquare, Copy, Download, ExternalLink, Loader2, MessageSquare, RotateCcw, Undo2, Zap,
} from 'lucide-react';
import { downloadCocForJob } from '../../../lib/cocPdf';
import {
  updateJob, overrideJobLevel, overrideCocStep, cancelJob, reactivateJob, resetJobOtpAttempts,
  type JobStatus, type JobWithDriver,
} from '../../../lib/supabase';
import { FAILURE_REASON_KEYS, getStageConfig } from '../constants';
import { getVerificationSteps, isDriverOnly, stepI18nKey, type CocStepKey } from '../verificationSteps';
import { WriteGuard } from '../permissions';
import { noteLocalStageChange } from '../../../lib/jobStage';
import { formatMoney } from '../../../lib/tenant';

/* ------------------------------------------------------------------ */
/* Everything dispatch needs to run a single job beyond the headline   */
/* actions in the Jobs detail header: parties, payout, hand-off        */
/* overrides, client messages and tracking links, stage override, and  */
/* the cancel dialog. Rendered under the route in JobDetailPanel.      */
/* ------------------------------------------------------------------ */

const COC_DOMAIN = (import.meta.env.VITE_COC_URL || 'https://nokael.ae').replace(/\/$/, '');
const JUMP_TARGETS: JobStatus[] = ['pending', 'client_pickup', 'driver_pickup', 'driver_delivery', 'completed', 'cancelled'];
const CLOSED: JobStatus[] = ['completed', 'cancelled', 'returned'];
// Mirrors confirm_job_step's max-attempts constant (5).
const MAX_OTP_ATTEMPTS = 5;

export const JOB_CONTROLS_ID = 'job-dispatch-controls';
/** Where drivers without the Android app sign in (served by the Confirmation Portal). */
const DRIVER_APP_URL = `${COC_DOMAIN}/driver-app/`;

export function JobOperations({
  job, onUpdate, cancelOpen, onCancelClose,
}: {
  job: JobWithDriver;
  onUpdate: () => void | Promise<void>;
  cancelOpen: boolean;
  onCancelClose: () => void;
}) {
  const { t, i18n } = useTranslation('dashboard');
  const STAGE_CONFIG = getStageConfig(t);
  // Anything written to the job record / audit log stays English whatever the UI language.
  const tEn = i18n.getFixedT('en', 'dashboard');
  const isReturned = job.status === 'returned';
  const isCancelled = job.status === 'cancelled';
  const otpLocked = (job.otp_attempts ?? 0) >= MAX_OTP_ATTEMPTS && !CLOSED.includes(job.status);

  const [flash, setFlash] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const [payoutDraft, setPayoutDraft] = React.useState(job.driver_payout_aed != null ? String(job.driver_payout_aed) : '');
  const [notes, setNotes] = React.useState(job.operator_notes || '');
  const [targetStatus, setTargetStatus] = React.useState<JobStatus>(job.status || 'pending');
  const [autoTimestamp, setAutoTimestamp] = React.useState(true);
  const [stepNotes, setStepNotes] = React.useState<Record<string, string>>({});
  const [failReason, setFailReason] = React.useState<string>(FAILURE_REASON_KEYS[0]);
  const [customFailReason, setCustomFailReason] = React.useState('');

  React.useEffect(() => { setPayoutDraft(job.driver_payout_aed != null ? String(job.driver_payout_aed) : ''); }, [job.driver_payout_aed]);
  React.useEffect(() => { setNotes(job.operator_notes || ''); }, [job.operator_notes]);
  React.useEffect(() => { setTargetStatus(job.status || 'pending'); }, [job.status]);

  const say = (message: string) => {
    setFlash(message);
    window.setTimeout(() => setFlash(current => (current === message ? null : current)), 2500);
  };

  /** Runs one write, keyed so only its own button spins; alerts on failure. */
  const run = async (key: string, action: () => Promise<unknown>, success: string, errorKey: string) => {
    setBusy(key);
    try {
      await action();
      say(success);
      await onUpdate();
      return true;
    } catch (err: any) {
      alert(t(errorKey, { error: err?.message || String(err), defaultValue: `Something went wrong: ${err?.message || err}` }));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    window.setTimeout(() => setCopied(current => (current === key ? null : current)), 1600);
  };

  // ── Payout ──────────────────────────────────────────────────────────────────
  const payoutValid = payoutDraft.trim() === '' || /^\d+(\.\d{1,2})?$/.test(payoutDraft.trim());
  const payoutValue = payoutDraft.trim() === '' ? null : Number(payoutDraft.trim());
  const payoutChanged = payoutValue !== (job.driver_payout_aed ?? null);

  // ── Hand-offs ───────────────────────────────────────────────────────────────
  const driverOnly = isDriverOnly(job);
  const steps = getVerificationSteps(job).map(def => {
    const token = def.tokenKey ? (job[def.tokenKey] as string | undefined) : undefined;
    const slug = def.tokenKey ? def.tokenKey.replace('token_', '').replace('_', '-') : '';
    return {
      ...def,
      label: t(`jobDetailModal.verification.steps.${def.i18nKey}.label`),
      at: job[def.stepKey] as string | null | undefined,
      otp: job[def.otpKey] as string | null | undefined,
      url: token ? `${COC_DOMAIN}/${token}/${slug}` : '',
    };
  });

  const toggleStep = (stepKey: CocStepKey, confirmed: boolean) => {
    const action = confirmed ? 'reset' : 'force-confirmed';
    const note = stepNotes[stepKey]?.trim();
    const label = tEn(`jobDetailModal.verification.steps.${stepI18nKey(job, stepKey)}.label`);
    const entry = `[${format(new Date(), 'HH:mm')}] ${label} ${action} ${note ? `— ${note}` : 'via Command Centre'}`;
    // Append: operator_notes is one shared field, a step note mustn't clobber earlier ones.
    const combined = job.operator_notes ? `${job.operator_notes}\n${entry}` : entry;
    noteLocalStageChange(job.id!);
    return run(stepKey, async () => {
      await overrideCocStep(job.id!, stepKey, !confirmed, combined, job.confirmation_mode);
      setStepNotes(prev => ({ ...prev, [stepKey]: '' }));
    }, t('jobDetailModal.toast.cocStepUpdated'), 'jobDetailModal.errors.cocStep');
  };

  // ── Messages (go to external parties, so deliberately not localised) ───────
  // Clients get their live tracking page (which also shows their own code) plus
  // the code itself in the message. Drivers never get a per-job link: they sign
  // in to the Nokael Driver app, or its web version for drivers without it.
  // Only four-step jobs still have client confirmation pages on the portal.
  const trackUrl = (party: 'sender' | 'recipient') => {
    const token = party === 'sender' ? job.token_client_pickup : job.token_client_delivery;
    return token ? `${COC_DOMAIN}/${token}/track${party === 'recipient' ? '?for=recipient' : ''}` : '';
  };
  const confirmUrl = (party: 'sender' | 'recipient') => {
    if (driverOnly) return '';
    const token = party === 'sender' ? job.token_client_pickup : job.token_client_delivery;
    return token ? `${COC_DOMAIN}/${token}/${party === 'sender' ? 'client-pickup' : 'client-delivery'}` : '';
  };

  const buildMessage = (type: 'sender' | 'driver' | 'recipient') => {
    const ref = `Job #${job.job_ref}`;
    if (type === 'driver') {
      return [
        `New job assigned — ${ref}`,
        `Pickup: ${job.pickup_location}, ${job.pickup_emirate}`,
        `Delivery: ${job.delivery_location}, ${job.delivery_emirate}`,
        `Item: ${job.item_type} | Urgency: ${job.urgency}`,
        `Sender: ${job.sender_name} | Recipient: ${job.recipient_name}`,
        '',
        `Open the Nokael Driver app and go online to start it. No app? Sign in here: ${DRIVER_APP_URL}`,
        driverOnly ? 'The sender and recipient each give you their code at the hand-off.' : '',
      ].join('\n').trim();
    }
    const sender = type === 'sender';
    const name = sender ? job.sender_name : job.recipient_name;
    const code = sender ? job.otp_sender : job.otp_recipient;
    const confirm = confirmUrl(type);
    return [
      sender
        ? `Hi ${name}, your Nokael pickup is confirmed (${ref}).`
        : `Hi ${name}, a package from ${job.sender_name} is on its way to you (${ref}).`,
      `Route: ${job.pickup_location} → ${job.delivery_location}`,
      `Item: ${job.item_type}`,
      '',
      `Track it live: ${trackUrl(type)}`,
      confirm ? `When you ${sender ? 'hand it over' : 'receive it'}, tap to confirm: ${confirm}` : '',
      code ? `Your ${sender ? 'handover' : 'delivery'} code: ${code} — give it to the driver only when you ${sender ? 'hand over' : 'receive'} the package.` : '',
    ].filter(Boolean).join('\n');
  };

  const openWhatsApp = (phone: string, message: string) =>
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');

  const sendWhatsApp = (type: 'sender' | 'driver' | 'recipient') => {
    const phone = type === 'sender' ? job.sender_phone : type === 'driver' ? job.driver?.phone || '' : job.recipient_phone;
    openWhatsApp(phone, buildMessage(type));
    const flag = type === 'sender' ? { sender_notified: true } : type === 'driver' ? { driver_notified: true } : { recipient_notified: true };
    updateJob(job.id!, flag).then(() => onUpdate()).catch(() => { /* the message still went out */ });
  };

  const whatsappTargets = [
    { id: 'sender' as const, label: t('jobDetailModal.whatsapp.sender'), sent: job.sender_notified, reachable: !!job.sender_phone },
    { id: 'driver' as const, label: t('jobDetailModal.whatsapp.pilot'), sent: job.driver_notified, reachable: !!job.driver?.phone },
    { id: 'recipient' as const, label: t('jobDetailModal.whatsapp.client'), sent: job.recipient_notified, reachable: !!job.recipient_phone },
  ];

  const trackingLinks = (['sender', 'recipient'] as const)
    .map(party => ({
      id: `track-${party}`,
      label: party === 'sender' ? t('jobDetailModal.tracking.sender', { defaultValue: 'Sender' }) : t('jobDetailModal.tracking.recipient', { defaultValue: 'Recipient' }),
      url: trackUrl(party),
      phone: party === 'sender' ? job.sender_phone : job.recipient_phone,
      message: buildMessage(party),
    }))
    .filter(link => link.url);

  // Hand-off codes dispatch may need to read out or resend. Driver-only jobs use
  // just the sender's and recipient's codes; four-step jobs add the driver's.
  const codes = [
    { id: 'code-sender', label: 'Sender code', hint: 'Driver enters it at pickup', code: job.otp_sender, phone: job.sender_phone, to: 'sender' as const },
    ...(!driverOnly && job.otp_driver_pickup
      ? [{ id: 'code-driver', label: 'Driver code', hint: 'Driver gives it at both hand-offs', code: job.otp_driver_pickup, phone: job.driver?.phone || '', to: 'driver' as const }]
      : []),
    { id: 'code-recipient', label: 'Recipient code', hint: 'Driver enters it at delivery', code: job.otp_recipient, phone: job.recipient_phone, to: 'recipient' as const },
  ];
  const codeMessage = (to: 'sender' | 'driver' | 'recipient', code: string) =>
    to === 'driver'
      ? `Nokael Job #${job.job_ref}: your hand-off code is ${code}.`
      : `Nokael Job #${job.job_ref}: your ${to === 'sender' ? 'handover' : 'delivery'} code is ${code}. Give it to the driver only when you ${to === 'sender' ? 'hand over' : 'receive'} the package.`;

  // ── Cancel ──────────────────────────────────────────────────────────────────
  const confirmCancel = async () => {
    const reason = customFailReason.trim() || (failReason === 'custom' ? 'Custom' : tEn(`failureReasons.${failReason}`));
    const ok = await run('cancel', () => cancelJob(job.id!, reason, notes), t('jobDetailModal.toast.markedFailed'), 'jobDetailModal.errors.cancel');
    if (ok) {
      setCustomFailReason('');
      onCancelClose();
    }
  };

  const Spin = ({ on, icon }: { on: boolean; icon: React.ReactNode }) => (on ? <Loader2 className="animate-spin" /> : <>{icon}</>);

  return (
    <WriteGuard>
      <div className="jo">
        {flash && <div className="jo-flash" role="status"><Check />{flash}</div>}

        {isCancelled && (
          <div className="jo-banner danger">
            <AlertTriangle />
            <div>
              <b>{t('jobDetailModal.cancelledBanner')}</b>
              <span>{job.cancellation_reason || t('jobDetailModal.manualFailureRecorded')}{job.cancelled_at && ` · ${format(new Date(job.cancelled_at), 'd MMM, HH:mm')}`}</span>
            </div>
            <div className="jo-banner-actions">
              <button type="button" className="jo-btn" disabled={!!busy} onClick={() => run('reactivate', () => reactivateJob(job.id!, 'pending'), t('jobDetailModal.toast.reactivatedTo', { stage: STAGE_CONFIG.pending.label }), 'jobDetailModal.errors.reactivate')}>
                <Spin on={busy === 'reactivate'} icon={<RotateCcw />} />{t('jobDetailModal.reactivatePending')}
              </button>
              <button type="button" className="jo-btn" disabled={!!busy} onClick={() => run('resume', () => reactivateJob(job.id!, 'driver_pickup'), t('jobDetailModal.toast.reactivatedTo', { stage: STAGE_CONFIG.driver_pickup.label }), 'jobDetailModal.errors.reactivate')}>
                <Spin on={busy === 'resume'} icon={<RotateCcw />} />{t('jobDetailModal.resumeInTransit')}
              </button>
            </div>
          </div>
        )}

        {job.status === 'completed' && (
          <div className="jo-banner success">
            <CheckCircle2 />
            <div>
              <b>{t('jobDetailModal.coc.deliveredBanner', { defaultValue: 'Delivered' })}</b>
              <span>
                {t('jobDetailModal.coc.linksClose', { defaultValue: 'Client links close 24 hours after delivery. Send the certificate from here when a client asks.' })}
              </span>
            </div>
            <div className="jo-banner-actions">
              <button type="button" className="jo-btn" disabled={!!busy} onClick={async () => {
                setBusy('coc');
                try {
                  await downloadCocForJob(job);
                } catch (err: any) {
                  alert(t('jobDetailModal.errors.downloadCoc', { error: err?.message || String(err), defaultValue: `Could not create the certificate: ${err?.message || err}` }));
                } finally {
                  setBusy(null);
                }
              }}>
                <Spin on={busy === 'coc'} icon={<Download />} />{t('jobDetailModal.coc.download', { defaultValue: 'Download COC' })}
              </button>
            </div>
          </div>
        )}

        {isReturned && (
          <div className="jo-banner warn">
            <Undo2 />
            <div>
              <b>{t('jobDetailModal.returnedBanner')}</b>
              <span>{job.return_reason || t('jobDetailModal.returnedNoReason')}{job.returned_at && ` · ${format(new Date(job.returned_at), 'd MMM, HH:mm')}`}</span>
              <small>{t('jobDetailModal.returnedHint')}</small>
            </div>
          </div>
        )}

        {otpLocked && (
          <div className="jo-banner danger">
            <AlertTriangle />
            <div><span>{t('jobDetailModal.verification.otpLocked', { defaultValue: 'Code entry is locked after 5 wrong codes. The driver cannot confirm until you unlock it.' })}</span></div>
            <div className="jo-banner-actions">
              <button type="button" className="jo-btn" disabled={!!busy} onClick={() => run('otp', () => resetJobOtpAttempts(job.id!), t('jobDetailModal.toast.otpUnlocked', { defaultValue: 'Code entry unlocked' }), 'jobDetailModal.errors.unlockOtp')}>
                <Spin on={busy === 'otp'} icon={<RotateCcw />} />{t('jobDetailModal.verification.unlockOtp', { defaultValue: 'Unlock code entry' })}
              </button>
            </div>
          </div>
        )}

        {/* ── Parties & job facts ─────────────────────────────────────────── */}
        <section className="jo-section">
          <h3>{t('jobDetailModal.details.title')}</h3>
          <div className="jo-parties">
            {[
              { key: 'sender', title: t('jobDetailModal.details.consignor'), name: job.sender_name, phone: job.sender_phone, emirate: job.pickup_emirate, place: job.pickup_location },
              { key: 'recipient', title: t('jobDetailModal.details.consignee'), name: job.recipient_name, phone: job.recipient_phone, emirate: job.delivery_emirate, place: job.delivery_location },
            ].map(party => (
              <div key={party.key} className="jo-party">
                <small>{party.title}</small>
                <b>{party.name || '—'}</b>
                {party.phone && <a href={`tel:${party.phone.replace(/[^\d+]/g, '')}`}>{party.phone}</a>}
                <p><strong>{party.emirate}</strong> · {party.place}</p>
              </div>
            ))}
          </div>
          <dl className="jo-facts">
            <div><dt>{t('jobDetailModal.details.item')}</dt><dd>{job.item_type ? t(`jobDetailModal.details.itemTypes.${job.item_type}`, { defaultValue: job.item_type.replace('_', ' ') }) : '—'}</dd></div>
            <div><dt>{t('jobDetailModal.details.urgency')}</dt><dd>{job.urgency ? t(`jobDetailModal.details.urgencies.${job.urgency}`, { defaultValue: job.urgency }) : '—'}</dd></div>
            <div><dt>{t('jobDetailModal.details.price')}</dt><dd>{job.price_aed != null ? formatMoney(job.price_aed, { currency: job.currency }) : '—'}</dd></div>
          </dl>
          {job.special_instructions && (
            <div className="jo-note"><small>{t('jobDetailModal.details.specialInstructions')}</small><p>{job.special_instructions}</p></div>
          )}
          {job.driver_remark && (
            <div className="jo-note"><small>{t('jobDetailModal.details.driverRemark', { defaultValue: 'Driver remark' })}</small><p>{job.driver_remark}</p></div>
          )}
          <label className="jo-field">
            <small>{t('jobDetailModal.details.driverPayout', { defaultValue: 'Driver payout ({{currency}})', ...(job.currency ? { currency: job.currency } : {}) })}</small>
            <div className="jo-inline">
              <input
                type="text"
                inputMode="decimal"
                value={payoutDraft}
                onChange={e => setPayoutDraft(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="—"
                aria-invalid={!payoutValid}
              />
              <button type="button" className="jo-btn" disabled={!payoutValid || !payoutChanged || !!busy}
                onClick={() => run('payout', () => updateJob(job.id!, { driver_payout_aed: payoutValue }), t('jobDetailModal.toast.payoutSaved', { defaultValue: 'Driver payout saved' }), 'jobDetailModal.errors.savePayout')}>
                <Spin on={busy === 'payout'} icon={null} />{t('jobDetailModal.emergency.save')}
              </button>
            </div>
            {job.driver_id && job.driver_payout_aed == null && !CLOSED.includes(job.status) && (
              <em className="jo-hint warn">{t('jobDetailModal.details.payoutMissing', { defaultValue: 'No payout set — the driver sees "—" in the app.' })}</em>
            )}
          </label>
        </section>

        {/* ── Hand-offs: codes, portal links, manual override ─────────────── */}
        <section className="jo-section">
          <div className="jo-section-head">
            <h3>{t('jobDetailModal.verification.title')}</h3>
            <span className="jw-tag">{driverOnly ? 'Driver-only handoff' : 'Four-step handoff'}</span>
          </div>
          <ul className="jo-codes" aria-label="Hand-off codes">
            {codes.map(c => (
              <li key={c.id}>
                <small>{c.label}</small>
                <b>{c.code || t('jobDetailModal.verification.codeNotSet')}</b>
                <em>{c.hint}</em>
                {c.code && (
                  <div className="jo-code-actions">
                    <button type="button" className="jo-icon" onClick={() => copy(c.id, c.code!)} aria-label={`Copy ${c.label.toLowerCase()}`} title="Copy code">
                      {copied === c.id ? <Check /> : <Copy />}
                    </button>
                    {c.phone && (
                      <button type="button" className="jo-icon" onClick={() => openWhatsApp(c.phone, codeMessage(c.to, c.code!))} aria-label={`Send ${c.label.toLowerCase()} on WhatsApp`} title="Send on WhatsApp">
                        <MessageSquare />
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <ol className="jo-steps">
            {steps.map(step => {
              const confirmed = !!step.at;
              return (
                <li key={step.stepKey} className={confirmed ? 'done' : ''}>
                  <span className="jo-step-mark">{confirmed ? <Check /> : null}</span>
                  <div className="jo-step-main">
                    <b>{step.label}</b>
                    <small>
                      {confirmed
                        ? `${t('jobDetailModal.verification.verified')} · ${format(new Date(step.at!), 'd MMM, HH:mm')}`
                        : t(`jobDetailModal.verification.${step.waitingKey}`, { code: step.otp || t('jobDetailModal.verification.codeNotSet') })}
                    </small>
                    <div className="jo-inline">
                      <input
                        type="text"
                        value={stepNotes[step.stepKey] || ''}
                        onChange={e => setStepNotes(prev => ({ ...prev, [step.stepKey]: e.target.value }))}
                        placeholder={t('jobDetailModal.verification.notePlaceholder')}
                        disabled={isReturned}
                      />
                      <button type="button" className={`jo-btn ${confirmed ? '' : 'warn'}`} disabled={!!busy || isReturned} onClick={() => toggleStep(step.stepKey, confirmed)}>
                        <Spin on={busy === step.stepKey} icon={confirmed ? <Undo2 /> : <CheckSquare />} />
                        {confirmed ? t('jobDetailModal.verification.undo') : t('jobDetailModal.verification.overrideStep')}
                      </button>
                      {step.url && (
                        <>
                          <button type="button" className="jo-icon" onClick={() => copy(step.stepKey, step.url)} title={t('jobDetailModal.verification.copyLinkTitle')} aria-label={t('jobDetailModal.verification.copyLinkTitle')}>
                            {copied === step.stepKey ? <Check /> : <Copy />}
                          </button>
                          <a className="jo-icon" href={step.url} target="_blank" rel="noopener noreferrer" title={t('jobDetailModal.verification.openTitle')} aria-label={t('jobDetailModal.verification.openTitle')}>
                            <ExternalLink />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* ── Client & driver messages ────────────────────────────────────── */}
        <section className="jo-section">
          <h3>{t('jobDetailModal.whatsapp.title')}</h3>
          <div className="jo-wa">
            {whatsappTargets.map(target => (
              <button key={target.id} type="button" className={target.sent ? 'sent' : ''} disabled={!target.reachable} onClick={() => sendWhatsApp(target.id)}>
                <MessageSquare />
                <b>{target.label}</b>
                <small>{target.sent ? t('jobDetailModal.whatsapp.dispatched') : t('jobDetailModal.whatsapp.ready')}</small>
              </button>
            ))}
          </div>
          <small className="jo-sub">Links</small>
          <ul className="jo-links">
            {trackingLinks.map(link => (
              <li key={link.id}>
                <b>{link.label}</b>
                <span title={link.url}>{link.url.replace(/^https?:\/\//, '')}</span>
                <button type="button" className="jo-icon" onClick={() => copy(link.id, link.url)} aria-label={t('jobDetailModal.verification.copyLinkTitle')} title={t('jobDetailModal.verification.copyLinkTitle')}>
                  {copied === link.id ? <Check /> : <Copy />}
                </button>
                {link.phone && (
                  <button type="button" className="jo-icon" onClick={() => openWhatsApp(link.phone, link.message)}
                    aria-label={t('jobDetailModal.tracking.sendWhatsApp', { defaultValue: 'Send on WhatsApp' })} title={t('jobDetailModal.tracking.sendWhatsApp', { defaultValue: 'Send on WhatsApp' })}>
                    <MessageSquare />
                  </button>
                )}
                <a className="jo-icon" href={link.url} target="_blank" rel="noopener noreferrer" aria-label={t('jobDetailModal.tracking.open', { defaultValue: 'Open tracking page' })} title={t('jobDetailModal.tracking.open', { defaultValue: 'Open tracking page' })}>
                  <ExternalLink />
                </a>
              </li>
            ))}
            <li>
              <b>Driver</b>
              <span title={DRIVER_APP_URL}>{DRIVER_APP_URL.replace(/^https?:\/\//, '')}</span>
              <button type="button" className="jo-icon" onClick={() => copy('driver-app', DRIVER_APP_URL)} aria-label={t('jobDetailModal.verification.copyLinkTitle')} title={t('jobDetailModal.verification.copyLinkTitle')}>
                {copied === 'driver-app' ? <Check /> : <Copy />}
              </button>
              <a className="jo-icon" href={DRIVER_APP_URL} target="_blank" rel="noopener noreferrer" aria-label="Open driver web app" title="Open driver web app">
                <ExternalLink />
              </a>
            </li>
          </ul>
        </section>

        {/* ── Stage override & audit notes ────────────────────────────────── */}
        <section className="jo-section" id={JOB_CONTROLS_ID}>
          <h3>{t('jobDetailModal.emergency.title')}</h3>
          {isReturned ? (
            <p className="jo-hint">{t('jobDetailModal.returnedFinalNote')}</p>
          ) : (
            <>
              <p className="jo-hint"><strong>{t('jobDetailModal.emergency.useOnlyIf')}</strong> {t('jobDetailModal.emergency.useOnlyIfBody')}</p>
              <div className="jo-inline">
                <select value={targetStatus} onChange={e => setTargetStatus(e.target.value as JobStatus)} aria-label={t('jobDetailModal.emergency.jumpTo')}>
                  {JUMP_TARGETS.map(status => (
                    <option key={status} value={status}>{t(`jobDetailModal.emergency.jumpOptions.${status}`)}</option>
                  ))}
                </select>
                <button type="button" className="jo-btn warn" disabled={!!busy || targetStatus === job.status}
                  onClick={() => run('override', () => { noteLocalStageChange(job.id!); return overrideJobLevel(job.id!, { status: targetStatus, autoTimestampCoc: autoTimestamp, overrideNotes: notes }); }, t('jobDetailModal.toast.overridden', { stage: STAGE_CONFIG[targetStatus].label }), 'jobDetailModal.errors.override')}>
                  <Spin on={busy === 'override'} icon={<Zap />} />{t('jobDetailModal.emergency.forceUpdate')}
                </button>
              </div>
              <label className="jo-check">
                <input type="checkbox" checked={autoTimestamp} onChange={e => setAutoTimestamp(e.target.checked)} />
                {t('jobDetailModal.emergency.autoMark')}
              </label>
            </>
          )}
          <label className="jo-field">
            <small>{t('jobDetailModal.emergency.reasonLabel')}</small>
            <div className="jo-inline">
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('jobDetailModal.emergency.reasonPlaceholder')} />
              <button type="button" className="jo-btn" disabled={!!busy || notes === (job.operator_notes || '')}
                onClick={() => run('notes', () => updateJob(job.id!, { operator_notes: notes }), t('jobDetailModal.toast.noteSaved'), 'jobDetailModal.errors.saveNote')}>
                <Spin on={busy === 'notes'} icon={null} />{t('jobDetailModal.emergency.save')}
              </button>
            </div>
            <em className="jo-hint">{t('jobDetailModal.emergency.auditNote')}</em>
          </label>
        </section>
      </div>

      {cancelOpen && (
        <div className="jo-dialog-backdrop" onClick={onCancelClose}>
          <div className="jo-dialog" role="dialog" aria-modal="true" aria-labelledby="jo-cancel-title" onClick={e => e.stopPropagation()}>
            <h3 id="jo-cancel-title">{t('jobDetailModal.failModal.title')}</h3>
            <p>{t('jobDetailModal.failModal.subtitle')}</p>
            <label className="jo-field">
              <small>{t('jobDetailModal.failModal.why')}</small>
              <select value={failReason} onChange={e => setFailReason(e.target.value)} autoFocus>
                {FAILURE_REASON_KEYS.map(key => <option key={key} value={key}>{t(`failureReasons.${key}`)}</option>)}
                <option value="custom">{t('jobDetailModal.failModal.other')}</option>
              </select>
            </label>
            {failReason === 'custom' && (
              <label className="jo-field">
                <small>{t('jobDetailModal.failModal.explain')}</small>
                <textarea rows={2} value={customFailReason} onChange={e => setCustomFailReason(e.target.value)} placeholder={t('jobDetailModal.failModal.describePlaceholder')} />
              </label>
            )}
            <div className="jo-dialog-actions">
              <button type="button" className="jw-ghost" onClick={onCancelClose}>{t('jobDetailModal.failModal.back')}</button>
              <button type="button" className="jo-danger" disabled={busy === 'cancel'} onClick={confirmCancel}>
                <Spin on={busy === 'cancel'} icon={null} />{t('jobDetailModal.failModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </WriteGuard>
  );
}
