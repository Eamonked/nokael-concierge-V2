import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, MessageSquare, Zap, Shield, Navigation, Package, Truck,
  ExternalLink, Copy, X, Loader2, Download, AlertTriangle, RotateCcw,
  CheckSquare, XCircle, FastForward, Edit3, Check, Undo2, HelpCircle, Ban
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { format } from 'date-fns';
import { ar as arLocale } from 'date-fns/locale';
import { generateJobPOC } from '../../../lib/pdf-export';
import {
  assignDriverToJob, updateJob, overrideJobLevel, overrideCocStep, cancelJob, reactivateJob, resetJobOtpAttempts,
  type Driver, type Job, type JobStatus, type ItemType, type UrgencyType, type JobWithDriver
} from '../../../lib/supabase';
import { JobCreateModal } from './JobCreateModal';
import { STAGE_ORDER, FAILURE_REASON_KEYS, getStageConfig } from '../constants';
import { getVerificationSteps, isDriverOnly, stepI18nKey, type CocStepKey } from '../verificationSteps';
import { WriteGuard } from '../permissions';

export const JobDetailModal = ({ job, drivers, onClose, onUpdate }: { job: JobWithDriver, drivers: Driver[], onClose: () => void, onUpdate: () => void }) => {
  const { t, i18n } = useTranslation('dashboard');
  const STAGE_CONFIG = getStageConfig(t);
  // Anything written to the database / audit log (operator_notes, cancellation_reason)
  // is always English, whatever language the operator is using, so the record stays
  // consistent. `tEn` is used for those strings; `t` is for what's shown on screen.
  const tEn = i18n.getFixedT('en', 'dashboard');
  const dateLocale = i18n.language?.startsWith('ar') ? arLocale : undefined;
  // 'returned' is terminal (set by the driver app after pickup). Nothing on this screen
  // may move a returned job to another status; dispatch re-dispatches with a new job.
  const isReturned = job.status === 'returned';
  const [copiedStep, setCopiedStep] = React.useState<string | null>(null);
  const [reassigning, setReassigning] = React.useState(false);
  const [assigningDriver, setAssigningDriver] = React.useState(false);

  // Command Center Override State
  const [targetStatus, setTargetStatus] = React.useState<JobStatus>(job.status || 'pending');
  const [autoTimestampCoc, setAutoTimestampCoc] = React.useState(true);
  const [operatorNotes, setOperatorNotes] = React.useState(job.operator_notes || '');
  const [isApplyingOverride, setIsApplyingOverride] = React.useState(false);
  const [overrideMessage, setOverrideMessage] = React.useState<string | null>(null);

  // Failure modal state
  const [showFailModal, setShowFailModal] = React.useState(false);
  // Tracks the selected reason KEY (or 'custom'); the English label is what gets saved.
  const [failReason, setFailReason] = React.useState<string>(FAILURE_REASON_KEYS[0]);
  const [customFailReason, setCustomFailReason] = React.useState('');
  const [isCancelling, setIsCancelling] = React.useState(false);

  // COC Step Force-action state
  const [actingStep, setActingStep] = React.useState<string | null>(null);
  const [stepNotes, setStepNotes] = React.useState<Record<string, string>>({});

  // Job details are edited in the shared JobCreateModal drawer (edit mode), so
  // operators can correct intake mistakes without cancelling and re-creating.
  const [showEditDrawer, setShowEditDrawer] = React.useState(false);
  const [showDuplicateDrawer, setShowDuplicateDrawer] = React.useState(false);

  // Driver payout (what the driver sees in the app; not the client price).
  const [payoutDraft, setPayoutDraft] = React.useState(job.driver_payout_aed != null ? String(job.driver_payout_aed) : '');
  const [savingPayout, setSavingPayout] = React.useState(false);
  const [unlockingOtp, setUnlockingOtp] = React.useState(false);
  // Mirrors confirm_job_step's max-attempts constant (5).
  const otpLocked = (job.otp_attempts ?? 0) >= 5;

  // Keep targetStatus in sync when job updates
  React.useEffect(() => {
    setTargetStatus(job.status || 'pending');
    setOperatorNotes(job.operator_notes || '');
  }, [job.status, job.operator_notes]);

  React.useEffect(() => {
    setPayoutDraft(job.driver_payout_aed != null ? String(job.driver_payout_aed) : '');
  }, [job.driver_payout_aed]);

  const payoutValid = payoutDraft.trim() === '' || /^\d+(\.\d{1,2})?$/.test(payoutDraft.trim());
  const payoutChanged = (payoutDraft.trim() === '' ? null : Number(payoutDraft.trim())) !== (job.driver_payout_aed ?? null);

  const handleSavePayout = async () => {
    setSavingPayout(true);
    try {
      const value = payoutDraft.trim() === '' ? null : Number(payoutDraft.trim());
      await updateJob(job.id!, { driver_payout_aed: value });
      setOverrideMessage(t('jobDetailModal.toast.payoutSaved', { defaultValue: 'Driver payout saved' }));
      setTimeout(() => setOverrideMessage(null), 2000);
      onUpdate();
    } catch (err: any) {
      alert(t('jobDetailModal.errors.savePayout', { defaultValue: 'Could not save payout: {{error}}', error: err.message || String(err) }));
    } finally {
      setSavingPayout(false);
    }
  };

  const handleUnlockOtp = async () => {
    setUnlockingOtp(true);
    try {
      await resetJobOtpAttempts(job.id!);
      setOverrideMessage(t('jobDetailModal.toast.otpUnlocked', { defaultValue: 'Code entry unlocked' }));
      setTimeout(() => setOverrideMessage(null), 2500);
      onUpdate();
    } catch (err: any) {
      alert(t('jobDetailModal.errors.unlockOtp', { defaultValue: 'Could not unlock code entry: {{error}}', error: err.message || String(err) }));
    } finally {
      setUnlockingOtp(false);
    }
  };

  // The new job appears in the pipeline via the refresh; the drawer closes itself.
  const handleDuplicateCreated = async () => {
    await onUpdate();
    setOverrideMessage(t('jobDetailModal.toast.duplicateCreated'));
    setTimeout(() => setOverrideMessage(null), 2500);
  };

  const handleDetailsSaved = async () => {
    await onUpdate();
    setOverrideMessage(t('jobDetailModal.toast.detailsUpdated'));
    setTimeout(() => setOverrideMessage(null), 2500);
  };

  const handleNextStage = async () => {
    const currentIndex = STAGE_ORDER.indexOf(job.status as any);
    if (currentIndex === -1 || currentIndex >= STAGE_ORDER.length - 1) return;
    const nextStatus = STAGE_ORDER[currentIndex + 1];
    
    setIsApplyingOverride(true);
    try {
      await overrideJobLevel(job.id!, {
        status: nextStatus,
        autoTimestampCoc: true,
        overrideNotes: operatorNotes || `Advanced to ${tEn(`stageConfig.${nextStatus}.label`)} by Command Centre`
      });
      setOverrideMessage(t('jobDetailModal.toast.advancedTo', { stage: STAGE_CONFIG[nextStatus].label }));
      setTimeout(() => setOverrideMessage(null), 3000);
      onUpdate();
    } catch (err: any) {
      alert(t('jobDetailModal.errors.advance', { error: err.message || String(err) }));
    } finally {
      setIsApplyingOverride(false);
    }
  };

  const handleApplyOverride = async () => {
    setIsApplyingOverride(true);
    try {
      await overrideJobLevel(job.id!, {
        status: targetStatus,
        autoTimestampCoc: autoTimestampCoc,
        overrideNotes: operatorNotes
      });
      setOverrideMessage(t('jobDetailModal.toast.overridden', { stage: STAGE_CONFIG[targetStatus].label }));
      setTimeout(() => setOverrideMessage(null), 3000);
      onUpdate();
    } catch (err: any) {
      alert(t('jobDetailModal.errors.override', { error: err.message || String(err) }));
    } finally {
      setIsApplyingOverride(false);
    }
  };

  const handleFailJob = async () => {
    const finalReason = customFailReason.trim()
      ? customFailReason.trim()
      : failReason === 'custom'
        ? 'Custom'
        : tEn(`failureReasons.${failReason}`);
    setIsCancelling(true);
    try {
      await cancelJob(job.id!, finalReason, operatorNotes);
      setShowFailModal(false);
      setOverrideMessage(t('jobDetailModal.toast.markedFailed'));
      setTimeout(() => setOverrideMessage(null), 3000);
      onUpdate();
    } catch (err: any) {
      alert(t('jobDetailModal.errors.cancel', { error: err.message || String(err) }));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReactivateJob = async (targetLevel: JobStatus = 'pending') => {
    setIsApplyingOverride(true);
    try {
      await reactivateJob(job.id!, targetLevel);
      setOverrideMessage(t('jobDetailModal.toast.reactivatedTo', { stage: STAGE_CONFIG[targetLevel].label }));
      setTimeout(() => setOverrideMessage(null), 3000);
      onUpdate();
    } catch (err: any) {
      alert(t('jobDetailModal.errors.reactivate', { error: err.message || String(err) }));
    } finally {
      setIsApplyingOverride(false);
    }
  };

  const handleToggleCocStep = async (
    stepKey: CocStepKey,
    currentlyConfirmed: boolean,
    note?: string
  ) => {
    setActingStep(stepKey);
    try {
      const action = !currentlyConfirmed ? 'force-confirmed' : 'reset';
      // Audit-log text is always English (see tEn above), regardless of UI language.
      const stepLabel = tEn(`jobDetailModal.verification.steps.${stepI18nKey(job, stepKey)}.label`);
      const entry = note?.trim()
        ? `[${format(new Date(), 'HH:mm')}] ${stepLabel} ${action} — ${note.trim()}`
        : `[${format(new Date(), 'HH:mm')}] ${stepLabel} ${action} via Command Centre`;
      // Append rather than overwrite — operator_notes is a single shared
      // field on the job row, and a per-step note shouldn't clobber notes
      // left on a previous step or in the main override panel.
      const combinedNotes = job.operator_notes ? `${job.operator_notes}\n${entry}` : entry;

      await overrideCocStep(job.id!, stepKey, !currentlyConfirmed, combinedNotes, job.confirmation_mode);
      setOverrideMessage(t('jobDetailModal.toast.cocStepUpdated'));
      setTimeout(() => setOverrideMessage(null), 2500);
      setStepNotes(prev => ({ ...prev, [stepKey]: '' }));
      onUpdate();
    } catch (err: any) {
      alert(t('jobDetailModal.errors.cocStep', { error: err.message || String(err) }));
    } finally {
      setActingStep(null);
    }
  };

  // NOTE: these WhatsApp messages go to external parties (sender / driver / recipient),
  // not to the operator, so they are intentionally NOT tied to the operator's UI language.
  const dispatchWhatsApp = async (type: 'sender' | 'driver' | 'recipient') => {
    let message = '';
    let phone = '';
    const cocDomain = (import.meta.env.VITE_COC_URL || 'https://nokael.ae').replace(/\/$/, '');
    
    if (type === 'sender') {
      phone = job.sender_phone;
      message = `Hi ${job.sender_name}, your Nokael pickup is confirmed.\nRoute: ${job.pickup_location} → ${job.delivery_location}\nItem: ${job.item_type} | Urgency: ${job.urgency}\n\nWhen handing over your package, tap to confirm:\n${cocDomain}/${job.token_client_pickup}/client-pickup\nNo internet? Give the driver your OTP: ${job.otp_sender}`;
    } else if (type === 'driver') {
      phone = job.driver?.phone || '';
      message = `New job assigned — Job #${job.job_ref}\nPickup: ${job.pickup_location}, ${job.pickup_emirate}\nDelivery: ${job.delivery_location}, ${job.delivery_emirate}\nItem: ${job.item_type} | Urgency: ${job.urgency}\nSender: ${job.sender_name} | Recipient: ${job.recipient_name}\n\nYour job hub (pickup + delivery, one link):\n${cocDomain}/${job.token_driver_pickup}/driver-hub`;
    } else {
      phone = job.recipient_phone;
      message = `Hi ${job.recipient_name}, a package is on its way to you.\nFrom: ${job.sender_name} | Route: ${job.pickup_location} → ${job.delivery_location}\nItem: ${job.item_type}\n\nWhen you receive it, tap to confirm:\n${cocDomain}/${job.token_client_delivery}/client-delivery\nNo internet? Give the driver your OTP: ${job.otp_recipient}`;
    }
    
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
    
    // Update local sent flag
    const updatePayload: any = {};
    if (type === 'sender') updatePayload.sender_notified = true;
    if (type === 'driver') updatePayload.driver_notified = true;
    if (type === 'recipient') updatePayload.recipient_notified = true;
    
    await updateJob(job.id!, updatePayload);
    await onUpdate();
  };

  // Which hand-offs exist depends on confirmation_mode (see verificationSteps.ts):
  // driver_only = 2 steps using the sender's / recipient's codes; four_step = 4 steps.
  const driverOnly = isDriverOnly(job);
  const verificationSteps = getVerificationSteps(job).map((def) => ({
    ...def,
    label: t(`jobDetailModal.verification.steps.${def.i18nKey}.label`),
    desc: t(`jobDetailModal.verification.steps.${def.i18nKey}.desc`),
    status: job[def.stepKey],
    otp: job[def.otpKey],
    icon: driverOnly
      ? (def.stepKey === 'driver_pickup_at' ? Package : CheckCircle2)
      : ({ client_pickup_at: Package, driver_pickup_at: Truck, driver_delivery_at: Navigation, client_delivery_at: CheckCircle2 } as const)[def.stepKey],
  }));

  const currentStageIndex = STAGE_ORDER.indexOf(job.status as any);
  
  // Calculate highest reached stage index even if job is cancelled
  let effectiveStageIndex = currentStageIndex;
  if (job.status === 'cancelled' || isReturned) {
    if (job.client_delivery_at || job.client_delivery_confirmed_at) effectiveStageIndex = 4;
    else if (job.driver_delivery_at || job.driver_delivery_confirmed_at || job.driver_arrived_delivery_at) effectiveStageIndex = 3;
    else if (job.driver_pickup_at || job.driver_pickup_confirmed_at) effectiveStageIndex = 2;
    else if (job.client_pickup_at || job.client_pickup_confirmed_at || job.sender_ready_at || job.driver_arrived_pickup_at) effectiveStageIndex = 1;
    else effectiveStageIndex = 0;
  }

  const canAdvance = currentStageIndex >= 0 && currentStageIndex < STAGE_ORDER.length - 1 && job.status !== 'cancelled';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      {showEditDrawer && (
        <JobCreateModal
          editJob={job}
          drivers={drivers}
          onClose={() => setShowEditDrawer(false)}
          onSuccess={handleDetailsSaved}
        />
      )}
      {showDuplicateDrawer && (
        <JobCreateModal
          duplicateFrom={job}
          drivers={drivers}
          onClose={() => setShowDuplicateDrawer(false)}
          onSuccess={handleDuplicateCreated}
        />
      )}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-brand-bg/90 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-6xl bg-brand-bg border border-brand-border rounded-[32px] sm:rounded-[40px] shadow-3xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Top Header Bar */}
        <div className="px-6 py-5 border-b border-brand-border flex justify-between items-center bg-brand-surface/70">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-brand-neon bg-brand-neon/10 px-3 py-1 rounded-lg border border-brand-neon/20">
              #{job.job_ref?.toString().padStart(4, '0')}
            </span>
            <div>
              <h2 className="text-lg font-display font-semibold tracking-tight text-brand-text flex items-center gap-2">
                {t('jobDetailModal.title')}
              </h2>
              <p className="text-[11px] text-brand-muted font-medium">
                {format(new Date(job.created_at || new Date()), 'PPPP · HH:mm', { locale: dateLocale })} · {t('jobDetailModal.corridor')}: <span className="text-brand-text">{job.pickup_emirate} → {job.delivery_emirate}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={cn(
              "px-3.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5",
              STAGE_CONFIG[job.status]?.color || "bg-brand-surface text-brand-text border-brand-border"
            )}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              {STAGE_CONFIG[job.status]?.label || job.status}
            </div>

            <button 
              onClick={onClose}
              className="p-2 bg-brand-input hover:bg-brand-surface rounded-full text-brand-muted hover:text-brand-text transition-colors border border-brand-border"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Alert / Toast */}
        {overrideMessage && (
          <div className="bg-brand-neon/15 border-b border-brand-neon/30 px-6 py-2 flex items-center justify-between text-xs font-semibold text-brand-neon">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{overrideMessage}</span>
            </div>
          </div>
        )}

        {/* Failed / Cancelled Banner */}
        {job.status === 'cancelled' && (
          <div className="bg-red-500/15 border-b border-red-500/30 px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2.5 text-red-400 text-xs font-medium">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
              <div>
                <span className="font-bold uppercase tracking-wider text-red-300">{t('jobDetailModal.cancelledBanner')}</span>{' '}
                <span className="italic">{job.cancellation_reason || t('jobDetailModal.manualFailureRecorded')}</span>
                {job.cancelled_at && (
                  <span className="text-[11px] text-red-400/70 ml-2">({format(new Date(job.cancelled_at), 'HH:mm')})</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleReactivateJob('pending')}
                disabled={isApplyingOverride}
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t('jobDetailModal.reactivatePending')}
              </button>
              <button
                onClick={() => handleReactivateJob('driver_pickup')}
                disabled={isApplyingOverride}
                className="px-3 py-1.5 bg-brand-neon/10 hover:bg-brand-neon/20 text-brand-neon border border-brand-neon/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t('jobDetailModal.resumeInTransit')}
              </button>
            </div>
          </div>
        )}

        {/* Returned Banner: the driver couldn't deliver. Terminal; no reactivation. */}
        {isReturned && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-6 py-3 flex items-start gap-2.5 text-amber-300 text-xs font-medium">
            <Undo2 className="w-5 h-5 shrink-0 text-amber-400" />
            <div className="space-y-1">
              <div>
                <span className="font-bold uppercase tracking-wider text-amber-200">{t('jobDetailModal.returnedBanner')}</span>{' '}
                <span className="italic">{job.return_reason || t('jobDetailModal.returnedNoReason')}</span>
                {job.returned_at && (
                  <span className="text-[11px] text-amber-400/70 ml-2">({format(new Date(job.returned_at), 'HH:mm')})</span>
                )}
              </div>
              <p className="text-[11px] text-amber-300/80 font-normal">{t('jobDetailModal.returnedHint')}</p>
            </div>
          </div>
        )}

        {/* Level Progression Stepper (Command Lifecycle) */}
        <div className="px-6 py-3.5 bg-brand-surface/40 border-b border-brand-border overflow-x-auto no-scrollbar">
          <div className="flex items-center justify-between min-w-[620px] gap-2">
            {STAGE_ORDER.map((stageKey, idx) => {
              const isPast = (job.status === 'cancelled' || isReturned) ? effectiveStageIndex >= idx : currentStageIndex > idx;
              const isCurrent = job.status !== 'cancelled' && currentStageIndex === idx;
              const config = STAGE_CONFIG[stageKey];
              const Icon = config.icon;

              return (
                <React.Fragment key={stageKey}>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border transition-all",
                      isCurrent ? "bg-brand-neon border-brand-neon text-brand-bg shadow-[0_0_12px_rgba(57,255,20,0.35)] scale-105" :
                      isPast ? "bg-brand-neon/20 border-brand-neon/40 text-brand-neon" :
                      "bg-brand-input border-brand-border text-brand-muted opacity-50"
                    )}>
                      {isPast ? <Check className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <div className="text-left">
                      <p className={cn(
                        "text-xs font-semibold leading-none mb-0.5",
                        isCurrent ? "text-brand-neon" : isPast ? "text-brand-text" : "text-brand-muted opacity-60"
                      )}>
                        {config.short}
                      </p>
                      <span className="text-[10px] text-brand-muted">L{idx + 1}</span>
                    </div>
                  </div>

                  {idx < STAGE_ORDER.length - 1 && (
                    <div className={cn(
                      "flex-1 h-0.5 min-w-[24px] mx-1 transition-all",
                      isPast ? "bg-brand-neon" : "bg-brand-border"
                    )} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Modal Main Content — every control inside is disabled for viewers */}
        <WriteGuard>
        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto no-scrollbar">
          {/* Left Column: Job Details & Mission Control */}
          <div className="md:w-1/2 p-6 sm:p-8 border-r border-brand-border overflow-y-auto no-scrollbar space-y-6">
            
            {/* Emergency Controls - Use when customer/driver isn't responding */}
            <div className="p-5 bg-brand-surface/60 border border-yellow-500/30 rounded-3xl space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text">{t('jobDetailModal.emergency.title')}</h3>
                </div>
                {canAdvance && (
                  <button
                    onClick={handleNextStage}
                    disabled={isApplyingOverride}
                    className="px-3 py-1.5 bg-brand-neon text-brand-bg rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(57,255,20,0.25)]"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    {t('jobDetailModal.emergency.moveNext')}
                  </button>
                )}
              </div>

              {isReturned ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-brand-text leading-relaxed">{t('jobDetailModal.returnedFinalNote')}</p>
                </div>
              ) : (
                <>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-brand-text leading-relaxed">
                  <strong className="text-yellow-500">{t('jobDetailModal.emergency.useOnlyIf')}</strong> {t('jobDetailModal.emergency.useOnlyIfBody')}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-brand-muted uppercase mb-1.5">
                    <div className="flex items-center gap-2">
                      <span>{t('jobDetailModal.emergency.jumpTo')}</span>
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-neon/10 border border-brand-neon/30 text-[9px] font-bold text-brand-neon">
                        {(() => {
                          const stages = ['pending', 'client_pickup', 'driver_pickup', 'driver_delivery', 'completed', 'cancelled'];
                          const current = stages.indexOf(job.status);
                          return current >= 0 ? current + 1 : '?';
                        })()}
                      </span>
                    </div>
                  </label>
                  <select
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value as JobStatus)}
                    className="w-full bg-brand-input border border-brand-input-border rounded-xl px-3 py-2 text-xs font-medium text-brand-text focus:border-brand-neon outline-none"
                  >
                    <option value="pending">{t('jobDetailModal.emergency.jumpOptions.pending')}</option>
                    <option value="client_pickup">{t('jobDetailModal.emergency.jumpOptions.client_pickup')}</option>
                    <option value="driver_pickup">{t('jobDetailModal.emergency.jumpOptions.driver_pickup')}</option>
                    <option value="driver_delivery">{t('jobDetailModal.emergency.jumpOptions.driver_delivery')}</option>
                    <option value="completed">{t('jobDetailModal.emergency.jumpOptions.completed')}</option>
                    <option value="cancelled">{t('jobDetailModal.emergency.jumpOptions.cancelled')}</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <button
                    onClick={handleApplyOverride}
                    disabled={isApplyingOverride || targetStatus === job.status}
                    className={cn(
                      "w-full py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                      targetStatus === job.status 
                        ? "bg-brand-input text-brand-muted border border-brand-border cursor-not-allowed" 
                        : "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500 border border-yellow-500/50 active:scale-95 shadow-[0_0_8px_rgba(234,179,8,0.15)]"
                    )}
                  >
                    {isApplyingOverride ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    {t('jobDetailModal.emergency.forceUpdate')}
                  </button>
                </div>
              </div>

              {/* Auto-fill Verification Timestamps Checkbox */}
              <label className="flex items-center gap-2 text-xs text-brand-text cursor-pointer select-none pt-1 bg-brand-input/50 border border-brand-border rounded-xl p-3">
                <input
                  type="checkbox"
                  checked={autoTimestampCoc}
                  onChange={(e) => setAutoTimestampCoc(e.target.checked)}
                  className="rounded border-brand-border text-brand-neon focus:ring-0 w-3.5 h-3.5"
                />
                <span>{t('jobDetailModal.emergency.autoMark')}</span>
              </label>

                </>
              )}

              {/* Operator Notes Field */}
              <div>
                <label className="block text-[11px] font-semibold text-brand-muted uppercase mb-1">
                  {t('jobDetailModal.emergency.reasonLabel')} <span className="text-yellow-500">{t('jobDetailModal.emergency.required')}</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={operatorNotes}
                    onChange={(e) => setOperatorNotes(e.target.value)}
                    placeholder={t('jobDetailModal.emergency.reasonPlaceholder')}
                    className="flex-1 bg-brand-input border border-brand-input-border rounded-xl px-3 py-1.5 text-xs text-brand-text placeholder:text-brand-muted/50 focus:border-brand-neon outline-none"
                  />
                  <button
                    onClick={async () => {
                      try {
                        await updateJob(job.id!, { operator_notes: operatorNotes });
                        setOverrideMessage(t('jobDetailModal.toast.noteSaved'));
                        setTimeout(() => setOverrideMessage(null), 2000);
                        onUpdate();
                      } catch (err: any) {
                        alert(t('jobDetailModal.errors.saveNote', { error: err.message || String(err) }));
                      }
                    }}
                    className="px-3 py-1.5 bg-brand-input hover:bg-brand-surface border border-brand-border text-brand-text rounded-xl text-xs font-semibold"
                  >
                    {t('jobDetailModal.emergency.save')}
                  </button>
                </div>
                <p className="text-[10px] text-brand-muted mt-1 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {t('jobDetailModal.emergency.auditNote')}
                </p>
              </div>

              {/* Mark as Failed Trigger */}
              {job.status !== 'cancelled' && !isReturned && (
                <div className="pt-2 border-t border-brand-border/60 flex justify-between items-center bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <Ban className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-brand-text font-medium">{t('jobDetailModal.emergency.cantComplete')}</span>
                  </div>
                  <button
                    onClick={() => setShowFailModal(true)}
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-semibold flex items-center gap-1 border border-red-500/40 transition-all"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    {t('jobDetailModal.emergency.cancelJob')}
                  </button>
                </div>
              )}
            </div>

            {/* Job Details — editable so operators can correct mistakes made at intake */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">{t('jobDetailModal.details.title')}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDuplicateDrawer(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-input hover:bg-brand-surface border border-brand-border rounded-lg text-[11px] font-semibold text-brand-muted hover:text-brand-text transition-all"
                  >
                    <Copy className="w-3 h-3" />
                    {t('jobDetailModal.details.duplicate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditDrawer(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-input hover:bg-brand-surface border border-brand-border rounded-lg text-[11px] font-semibold text-brand-muted hover:text-brand-text transition-all"
                  >
                    <Edit3 className="w-3 h-3" />
                    {t('jobDetailModal.details.edit')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">{t('jobDetailModal.details.consignor')}</p>
                  <div className="p-4 bg-brand-input rounded-2xl border border-brand-border">
                    <p className="text-sm font-semibold text-brand-text mb-0.5 truncate">{job.sender_name}</p>
                    <p className="text-xs font-mono text-brand-neon">{job.sender_phone}</p>
                    <div className="mt-2 text-xs text-brand-muted line-clamp-2">
                      <span className="text-brand-text font-medium">{job.pickup_emirate}:</span> {job.pickup_location}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">{t('jobDetailModal.details.consignee')}</p>
                  <div className="p-4 bg-brand-input rounded-2xl border border-brand-border">
                    <p className="text-sm font-semibold text-brand-text mb-0.5 truncate">{job.recipient_name}</p>
                    <p className="text-xs font-mono text-brand-neon">{job.recipient_phone}</p>
                    <div className="mt-2 text-xs text-brand-muted line-clamp-2">
                      <span className="text-brand-text font-medium">{job.delivery_emirate}:</span> {job.delivery_location}
                    </div>
                  </div>
                </div>
                <div className="col-span-2 grid grid-cols-3 gap-3">
                  <div className="p-3 bg-brand-input rounded-xl border border-brand-border">
                    <p className="text-[10px] uppercase text-brand-muted mb-1">{t('jobDetailModal.details.item')}</p>
                    <p className="text-xs font-medium text-brand-text capitalize">{job.item_type ? t(`jobDetailModal.details.itemTypes.${job.item_type}`, { defaultValue: job.item_type.replace('_', ' ') }) : '—'}</p>
                  </div>
                  <div className="p-3 bg-brand-input rounded-xl border border-brand-border">
                    <p className="text-[10px] uppercase text-brand-muted mb-1">{t('jobDetailModal.details.urgency')}</p>
                    <p className="text-xs font-medium text-brand-text capitalize">{job.urgency ? t(`jobDetailModal.details.urgencies.${job.urgency}`, { defaultValue: job.urgency }) : '—'}</p>
                  </div>
                  <div className="p-3 bg-brand-input rounded-xl border border-brand-border">
                    <p className="text-[10px] uppercase text-brand-muted mb-1">{t('jobDetailModal.details.price')}</p>
                    <p className="text-xs font-medium text-brand-text">{job.price_aed != null ? job.price_aed : '—'}</p>
                  </div>
                </div>
                {job.special_instructions && (
                  <div className="col-span-2 p-3 bg-brand-input rounded-xl border border-brand-border">
                    <p className="text-[10px] uppercase text-brand-muted mb-1">{t('jobDetailModal.details.specialInstructions')}</p>
                    <p className="text-xs text-brand-text whitespace-pre-wrap">{job.special_instructions}</p>
                  </div>
                )}
                {/* Driver payout — what the driver app shows; kept apart from the client price */}
                <div className="col-span-2 p-3 bg-brand-input rounded-xl border border-brand-border">
                  <p className="text-[10px] uppercase text-brand-muted mb-1">{t('jobDetailModal.details.driverPayout', { defaultValue: 'Driver payout (AED)' })}</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={payoutDraft}
                      onChange={(e) => setPayoutDraft(e.target.value.replace(/[^\d.]/g, ''))}
                      placeholder="—"
                      className="flex-1 bg-brand-bg border border-brand-input-border rounded-lg px-3 py-1.5 text-xs font-mono text-brand-text placeholder:text-brand-muted/50 focus:border-brand-neon outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSavePayout}
                      disabled={!payoutValid || !payoutChanged || savingPayout}
                      className="px-3 py-1.5 bg-brand-input hover:bg-brand-surface border border-brand-border text-brand-text rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {savingPayout && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {t('jobDetailModal.emergency.save')}
                    </button>
                  </div>
                  {job.driver_id && job.driver_payout_aed == null && !['completed', 'cancelled', 'returned'].includes(job.status) && (
                    <p className="text-[10px] text-yellow-500 mt-1">{t('jobDetailModal.details.payoutMissing', { defaultValue: 'No payout set — the driver sees "—" in the app.' })}</p>
                  )}
                </div>
                {job.driver_remark && (
                  <div className="col-span-2 p-3 bg-brand-input rounded-xl border border-brand-border">
                    <p className="text-[10px] uppercase text-brand-muted mb-1">{t('jobDetailModal.details.driverRemark', { defaultValue: 'Driver remark' })}</p>
                    <p className="text-xs text-brand-text whitespace-pre-wrap">{job.driver_remark}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pilot Assignment */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">{t('jobDetailModal.pilot.title')}</p>
              <div className="p-4 bg-brand-surface border border-brand-border rounded-2xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-neon/10 flex items-center justify-center border border-brand-neon/20">
                    <Truck className="w-5 h-5 text-brand-neon" />
                  </div>
                  <div>
                    {job.driver?.full_name ? (
                      <>
                        <p className="text-sm font-semibold text-brand-text">{job.driver.full_name}</p>
                        <p className="text-xs text-brand-muted font-mono">{job.driver.phone} · {job.driver.vehicle_type || t('jobDetailModal.pilot.corridorPilot')}</p>
                      </>
                    ) : (
                      <p className="text-sm font-medium text-brand-muted italic">{t('jobDetailModal.pilot.pending')}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReassigning(v => !v)}
                  className="px-3.5 py-1.5 bg-brand-input hover:bg-brand-surface border border-brand-border rounded-xl text-xs font-semibold uppercase tracking-wider"
                >
                  {job.driver?.full_name ? t('jobDetailModal.pilot.reassign') : t('jobDetailModal.pilot.assign')}
                </button>
              </div>
              {reassigning && (
                <div className="flex items-center gap-2 pt-1">
                  <select
                    defaultValue={job.driver_id || 'unassigned'}
                    disabled={assigningDriver}
                    onChange={async (e) => {
                      const val = e.target.value;
                      setAssigningDriver(true);
                      try {
                        await assignDriverToJob(job.id!, val === 'unassigned' ? null : val);
                        setReassigning(false);
                        // Refetch jobs to get updated driver info
                        await onUpdate();
                      } catch (err: any) {
                        alert(t('jobDetailModal.errors.assign', { error: err.message || String(err) }));
                      } finally {
                        setAssigningDriver(false);
                      }
                    }}
                    className="flex-1 bg-brand-input border border-brand-input-border rounded-xl px-3 py-2 text-xs font-medium text-brand-text focus:border-brand-neon outline-none"
                  >
                    <option value="unassigned">{t('jobDetailModal.pilot.unassigned')}</option>
                    {drivers.map(d => {
                      const statusIcon = d.status === 'available' ? '🟢' : d.status === 'on_job' ? '🟠' : '⚪';
                      return (
                        <option key={d.id} value={d.id}>{statusIcon} {d.full_name} ({t('jobCreateModal.tierShort')} {d.tier || 'D'} · {d.vehicle_type})</option>
                      );
                    })}
                  </select>
                  {assigningDriver && <Loader2 className="w-4 h-4 animate-spin text-brand-muted" />}
                </div>
              )}
            </div>

            {/* Quick Dispatch WhatsApp Buttons */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">{t('jobDetailModal.whatsapp.title')}</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'sender', label: t('jobDetailModal.whatsapp.sender'), sent: job.sender_notified },
                  { id: 'driver', label: t('jobDetailModal.whatsapp.pilot'), sent: job.driver_notified },
                  { id: 'recipient', label: t('jobDetailModal.whatsapp.client'), sent: job.recipient_notified }
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => dispatchWhatsApp(btn.id as any)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all gap-1.5 text-center",
                      btn.sent ? "bg-brand-surface border-brand-border text-brand-muted" : "bg-brand-input border-brand-neon/30 hover:border-brand-neon hover:shadow-[0_0_12px_rgba(57,255,20,0.15)] text-brand-text"
                    )}
                  >
                    <MessageSquare className={cn("w-4 h-4", btn.sent ? "text-brand-muted" : "text-brand-neon")} />
                    <span className="text-[11px] font-semibold">{btn.label}</span>
                    <span className={cn("text-[10px]", btn.sent ? "text-brand-muted" : "text-brand-neon font-medium")}>
                      {btn.sent ? t('jobDetailModal.whatsapp.dispatched') : t('jobDetailModal.whatsapp.ready')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Client tracking links (COC portal /:token/track) — live status,
                driver/dispatch contact, own OTP, COC PDF once delivered.
                Sent as-is to external parties, so the message isn't localised. */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">
                {t('jobDetailModal.tracking.title', { defaultValue: 'Client tracking link' })}
              </p>
              {([
                { id: 'track-sender', label: t('jobDetailModal.tracking.sender', { defaultValue: 'Sender' }), token: job.token_client_pickup, query: '', name: job.sender_name, phone: job.sender_phone },
                { id: 'track-recipient', label: t('jobDetailModal.tracking.recipient', { defaultValue: 'Recipient' }), token: job.token_client_delivery, query: '?for=recipient', name: job.recipient_name, phone: job.recipient_phone },
              ]).map((link) => {
                if (!link.token) return null;
                const cocDomain = (import.meta.env.VITE_COC_URL || 'https://nokael.ae').replace(/\/$/, '');
                const url = `${cocDomain}/${link.token}/track${link.query}`;
                const message = `Hi ${link.name}, track your Nokael delivery (Job #${job.job_ref}) live here — driver location, contact options and your Chain of Custody certificate once delivered:\n${url}`;
                return (
                  <div key={link.id} className="flex items-center gap-2 p-2.5 bg-brand-input border border-brand-input-border rounded-xl">
                    <Navigation className="w-3.5 h-3.5 text-brand-neon shrink-0" />
                    <span className="text-[11px] font-semibold text-brand-text w-16 shrink-0">{link.label}</span>
                    <span className="text-[11px] font-mono text-brand-muted truncate flex-1 min-w-0">{url.replace(/^https?:\/\//, '')}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(url);
                        setCopiedStep(link.id);
                        setTimeout(() => setCopiedStep(null), 2000);
                      }}
                      className="p-1.5 rounded-lg hover:bg-brand-surface text-brand-muted hover:text-brand-text transition-all"
                      title={t('jobDetailModal.verification.copyLinkTitle')}
                    >
                      {copiedStep === link.id ? <Check className="w-3.5 h-3.5 text-brand-neon" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    {link.phone && (
                      <a
                        href={`https://wa.me/${link.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-brand-surface text-brand-muted hover:text-brand-neon transition-all"
                        title={t('jobDetailModal.tracking.sendWhatsApp', { defaultValue: 'Send on WhatsApp' })}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-brand-surface text-brand-muted hover:text-brand-text transition-all"
                      title={t('jobDetailModal.tracking.open', { defaultValue: 'Open tracking page' })}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Right Column: Delivery Verification Steps */}
          <div className="md:w-1/2 p-6 sm:p-8 bg-brand-surface/30 flex flex-col justify-between overflow-y-auto no-scrollbar space-y-6">
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-base font-display font-bold tracking-tight text-brand-text">{t('jobDetailModal.verification.title')}</h3>
                  <p className="text-xs text-brand-muted">{t('jobDetailModal.verification.subtitle')}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-brand-muted font-mono bg-brand-input px-2.5 py-1 rounded-lg border border-brand-border">
                  <Shield className="w-3.5 h-3.5 text-brand-neon" />
                  <span>{t('jobDetailModal.verification.otpSecured')}</span>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-brand-text leading-relaxed">
                  <strong className="text-blue-400">{t('jobDetailModal.verification.howItWorks')}</strong> {t(driverOnly ? 'jobDetailModal.verification.howItWorksBodyDriverOnly' : 'jobDetailModal.verification.howItWorksBody')}
                </div>
              </div>

              {/* Code-locked: 5 wrong hand-off codes. Only dispatch can unlock. */}
              {otpLocked && !['completed', 'cancelled', 'returned'].includes(job.status) && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-brand-text leading-relaxed">
                      {t('jobDetailModal.verification.otpLocked', { defaultValue: 'Code entry is locked after 5 wrong codes. The driver cannot confirm until you unlock it.' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleUnlockOtp}
                    disabled={unlockingOtp}
                    className="shrink-0 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    {unlockingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    {t('jobDetailModal.verification.unlockOtp', { defaultValue: 'Unlock code entry' })}
                  </button>
                </div>
              )}

              {/* Verification Steps List */}
              <div className="space-y-4 relative">
                <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-brand-border" />
                
                {verificationSteps.map((step, i) => {
                  const cocDomain = (import.meta.env.VITE_COC_URL || 'https://nokael.ae').replace(/\/$/, '');
                  const stepSlug = step.tokenKey ? step.tokenKey.replace('token_', '').replace('_', '-') : '';
                  const tokenValue = step.tokenKey ? (job as any)[step.tokenKey] : undefined;
                  const stepUrl = tokenValue ? `${cocDomain}/${tokenValue}/${stepSlug}` : '';
                  const isConfirmed = !!step.status;
                  const isBusy = actingStep === step.stepKey;

                  return (
                    <div key={i} className="flex gap-4 relative z-10 p-3.5 bg-brand-bg/80 border border-brand-border rounded-2xl hover:border-brand-neon/30 transition-all">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center border transition-all shrink-0 mt-0.5",
                        isConfirmed 
                          ? "bg-brand-neon border-brand-neon text-brand-bg shadow-[0_0_12px_rgba(57,255,20,0.3)]" 
                          : "bg-brand-input border-brand-border text-brand-muted"
                      )}>
                        {isConfirmed ? <CheckCircle2 className="w-5 h-5" /> : <step.icon className="w-4 h-4" />}
                      </div>

                      <div className="flex-grow min-w-0">
                        <div className="flex justify-between items-start mb-0.5">
                          <p className={cn("text-xs font-bold", isConfirmed ? "text-brand-text" : "text-brand-muted")}>
                            {step.label}
                          </p>
                          {isConfirmed && (
                            <span className="text-[11px] font-mono text-brand-neon font-semibold bg-brand-neon/10 px-2 py-0.5 rounded border border-brand-neon/20">
                              {format(new Date(step.status!), 'HH:mm:ss')}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-brand-muted font-medium mb-2">
                          {isConfirmed 
                            ? t('jobDetailModal.verification.verified')
                            : t(`jobDetailModal.verification.${step.waitingKey}`, { code: step.otp || t('jobDetailModal.verification.codeNotSet') })
                          }
                        </p>

                        {/* Per-step audit note */}
                        <div className="pt-1">
                          <input
                            type="text"
                            value={stepNotes[step.stepKey] || ''}
                            onChange={(e) => setStepNotes(prev => ({ ...prev, [step.stepKey]: e.target.value }))}
                            placeholder={t('jobDetailModal.verification.notePlaceholder')}
                            className="w-full bg-brand-input border border-brand-input-border rounded-lg px-2.5 py-1.5 text-[11px] text-brand-text placeholder:text-brand-muted/50 focus:border-brand-neon outline-none"
                          />
                        </div>

                        {/* Override Step / Undo & Link Actions */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-brand-border/60 mt-2">
                          <button
                            onClick={() => handleToggleCocStep(step.stepKey, isConfirmed, stepNotes[step.stepKey])}
                            disabled={isBusy || isReturned}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all",
                              isConfirmed
                                ? "bg-brand-input hover:bg-brand-surface text-brand-muted hover:text-brand-text border border-brand-border"
                                : "bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-500 border border-yellow-500/40 shadow-[0_0_8px_rgba(234,179,8,0.15)]"
                            )}
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isConfirmed ? (
                              <>
                                <Undo2 className="w-3.5 h-3.5" />
                                {t('jobDetailModal.verification.undo')}
                              </>
                            ) : (
                              <>
                                <CheckSquare className="w-3.5 h-3.5" />
                                {t('jobDetailModal.verification.overrideStep')}
                              </>
                            )}
                          </button>

                          {tokenValue && (
                            <>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(stepUrl);
                                  setCopiedStep(step.tokenKey);
                                  setTimeout(() => setCopiedStep(null), 2000);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-brand-input hover:bg-brand-surface rounded-lg border border-brand-border text-[11px] font-semibold text-brand-muted hover:text-brand-text transition-all"
                                title={t('jobDetailModal.verification.copyLinkTitle')}
                              >
                                <Copy className="w-3 h-3" />
                                {copiedStep === step.tokenKey ? t('jobDetailModal.verification.copied') : t('jobDetailModal.verification.copyLink')}
                              </button>
                              <a
                                href={stepUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-brand-input hover:bg-brand-surface rounded-lg border border-brand-border text-[11px] font-semibold text-brand-muted hover:text-brand-text transition-all"
                                title={t('jobDetailModal.verification.openTitle')}
                              >
                                <ExternalLink className="w-3 h-3" />
                                {t('jobDetailModal.verification.open')}
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions: Download Proof of Delivery */}
            {(job.status === 'completed' || !!job.client_delivery_at) && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pt-4 border-t border-brand-border"
              >
                <button 
                  onClick={() => generateJobPOC(job)}
                  className="btn-primary w-full py-4 text-xs font-bold flex items-center justify-center gap-2.5"
                >
                  <Download className="w-4 h-4" />
                  {t('jobDetailModal.verification.downloadPoc')}
                </button>
              </motion.div>
            )}
          </div>
        </div>
        </WriteGuard>

        {/* Declare Failed Modal Overlay */}
        <AnimatePresence>
          {showFailModal && (
            <div className="absolute inset-0 z-50 bg-brand-bg/95 backdrop-blur-md p-6 flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-md w-full bg-brand-surface border border-red-500/40 rounded-3xl p-6 shadow-2xl space-y-4"
              >
                <div className="flex items-center gap-3 text-red-400">
                  <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/30">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-brand-text">{t('jobDetailModal.failModal.title')}</h3>
                    <p className="text-xs text-brand-muted">{t('jobDetailModal.failModal.subtitle')}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-brand-muted uppercase mb-1">{t('jobDetailModal.failModal.why')}</label>
                    <select
                      value={failReason}
                      onChange={(e) => setFailReason(e.target.value)}
                      className="w-full bg-brand-input border border-brand-input-border rounded-xl px-3 py-2 text-xs text-brand-text outline-none focus:border-red-500"
                    >
                      {FAILURE_REASON_KEYS.map((key) => (
                        <option key={key} value={key}>{t(`failureReasons.${key}`)}</option>
                      ))}
                      <option value="custom">{t('jobDetailModal.failModal.other')}</option>
                    </select>
                  </div>

                  {failReason === 'custom' && (
                    <div>
                      <label className="block text-xs font-semibold text-brand-muted uppercase mb-1">{t('jobDetailModal.failModal.explain')}</label>
                      <textarea
                        value={customFailReason}
                        onChange={(e) => setCustomFailReason(e.target.value)}
                        placeholder={t('jobDetailModal.failModal.describePlaceholder')}
                        rows={2}
                        className="w-full bg-brand-input border border-brand-input-border rounded-xl p-3 text-xs text-brand-text outline-none focus:border-red-500"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-brand-border">
                  <button
                    onClick={() => setShowFailModal(false)}
                    className="px-4 py-2 bg-brand-input hover:bg-brand-surface border border-brand-border rounded-xl text-xs font-medium text-brand-text"
                  >
                    {t('jobDetailModal.failModal.back')}
                  </button>
                  <button
                    onClick={handleFailJob}
                    disabled={isCancelling}
                    className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-red-500/20"
                  >
                    {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                    {t('jobDetailModal.failModal.confirm')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
};
