import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, MessageSquare, Zap, Shield, Navigation, Package, Truck,
  ExternalLink, Copy, X, Loader2, Download, AlertTriangle, RotateCcw,
  CheckSquare, XCircle, FastForward, Edit3, Check, Undo2, HelpCircle, Ban
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/utils';
import { format } from 'date-fns';
import { generateJobPOC } from '../../../lib/pdf-export';
import {
  assignDriverToJob, updateJob, overrideJobLevel, overrideCocStep, cancelJob, reactivateJob,
  type Driver, type Job, type JobStatus, type ItemType, type UrgencyType, type JobWithDriver
} from '../../../lib/supabase';
import { STAGE_ORDER, STAGE_CONFIG, COMMON_FAILURE_REASONS } from '../constants';

export const JobDetailModal = ({ job, drivers, onClose, onUpdate }: { job: JobWithDriver, drivers: Driver[], onClose: () => void, onUpdate: () => void }) => {
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
  const [failReason, setFailReason] = React.useState(COMMON_FAILURE_REASONS[0]);
  const [customFailReason, setCustomFailReason] = React.useState('');
  const [isCancelling, setIsCancelling] = React.useState(false);

  // COC Step Force-action state
  const [actingStep, setActingStep] = React.useState<string | null>(null);
  const [stepNotes, setStepNotes] = React.useState<Record<string, string>>({});

  // Editable Job Details (sender/recipient/route/item — for correcting mistakes
  // made at intake without having to cancel and re-create the whole job)
  const [editingDetails, setEditingDetails] = React.useState(false);
  const [savingDetails, setSavingDetails] = React.useState(false);
  const buildDetailsForm = (j: JobWithDriver) => {
    // Sanitize emirate fields - legacy jobs may have concatenated values like "Dubai → Abu Dhabi"
    const sanitizePickupEmirate = (emirate: string | undefined | null): string => {
      if (!emirate) return 'Dubai';
      // If the emirate contains an arrow, extract the first part (pickup origin)
      if (emirate.includes('→')) {
        const parts = emirate.split('→').map(p => p.trim());
        const cleaned = parts[0] || 'Dubai';
        console.log('[Dashboard] Sanitized pickup emirate:', emirate, '→', cleaned);
        return cleaned;
      }
      return emirate;
    };
    
    const sanitizeDeliveryEmirate = (emirate: string | undefined | null, pickup: string | undefined | null): string => {
      if (!emirate) return 'Abu Dhabi';
      // If the emirate contains an arrow, extract the second part (delivery destination)
      if (emirate.includes('→')) {
        const parts = emirate.split('→').map(p => p.trim());
        const cleaned = parts[1] || 'Abu Dhabi';
        console.log('[Dashboard] Sanitized delivery emirate:', emirate, '→', cleaned);
        return cleaned;
      }
      // If delivery and pickup are the same concatenated string, try to extract second part
      if (pickup && emirate === pickup && emirate.includes('→')) {
        const parts = emirate.split('→').map(p => p.trim());
        const cleaned = parts[1] || 'Abu Dhabi';
        console.log('[Dashboard] Sanitized delivery emirate (matched pickup):', emirate, '→', cleaned);
        return cleaned;
      }
      return emirate;
    };
    
    const cleanPickup = sanitizePickupEmirate(j.pickup_emirate);
    const cleanDelivery = sanitizeDeliveryEmirate(j.delivery_emirate, j.pickup_emirate);
    
    return {
      sender_name: j.sender_name || '',
      sender_phone: j.sender_phone || '',
      recipient_name: j.recipient_name || '',
      recipient_phone: j.recipient_phone || '',
      pickup_emirate: cleanPickup,
      pickup_location: j.pickup_location || '',
      delivery_emirate: cleanDelivery,
      delivery_location: j.delivery_location || '',
      item_type: (j.item_type || 'parcel') as ItemType,
      urgency: (j.urgency || 'immediate') as UrgencyType,
      price_aed: j.price_aed != null ? String(j.price_aed) : '',
      special_instructions: j.special_instructions || '',
    };
  };
  const [detailsForm, setDetailsForm] = React.useState(buildDetailsForm(job));

  // Keep targetStatus in sync when job updates
  React.useEffect(() => {
    setTargetStatus(job.status || 'pending');
    setOperatorNotes(job.operator_notes || '');
    // Only reset the details form from server data while not actively
    // editing, so a realtime refresh mid-edit doesn't clobber unsaved input.
    if (!editingDetails) {
      setDetailsForm(buildDetailsForm(job));
    }
  }, [job.status, job.operator_notes, job.sender_name, job.sender_phone, job.recipient_name, job.recipient_phone, job.pickup_emirate, job.pickup_location, job.delivery_emirate, job.delivery_location, job.item_type, job.urgency, job.price_aed, job.special_instructions, editingDetails, job]);

  const handleSaveDetails = async () => {
    setSavingDetails(true);
    try {
      const priceVal = detailsForm.price_aed.trim() === '' ? null : Number(detailsForm.price_aed);
      const updates = {
        sender_name: detailsForm.sender_name,
        sender_phone: detailsForm.sender_phone,
        recipient_name: detailsForm.recipient_name,
        recipient_phone: detailsForm.recipient_phone,
        pickup_emirate: detailsForm.pickup_emirate,
        pickup_location: detailsForm.pickup_location,
        delivery_emirate: detailsForm.delivery_emirate,
        delivery_location: detailsForm.delivery_location,
        item_type: detailsForm.item_type,
        urgency: detailsForm.urgency,
        price_aed: priceVal !== null && !isNaN(priceVal) ? priceVal : null,
        special_instructions: detailsForm.special_instructions,
      };
      
      console.log('[Dashboard] Saving job details:', updates);
      const result = await updateJob(job.id!, updates);
      console.log('[Dashboard] Job updated, result:', result);
      
      // Exit editing mode BEFORE refreshing so the useEffect can update the form
      setEditingDetails(false);
      
      // Refetch to get updated data and trigger parent refresh
      await onUpdate();
      
      setOverrideMessage('Job details updated.');
      setTimeout(() => setOverrideMessage(null), 2500);
    } catch (err: any) {
      console.error('[Dashboard] Failed to update job details:', err);
      alert(`Failed to update job details: ${err.message || err}`);
    } finally {
      setSavingDetails(false);
    }
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
        overrideNotes: operatorNotes || `Advanced to ${STAGE_CONFIG[nextStatus].label} by Command Centre`
      });
      setOverrideMessage(`Job advanced to ${STAGE_CONFIG[nextStatus].label}`);
      setTimeout(() => setOverrideMessage(null), 3000);
      onUpdate();
    } catch (err: any) {
      alert(`Failed to advance job stage: ${err.message || err}`);
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
      setOverrideMessage(`Level manually overridden to ${STAGE_CONFIG[targetStatus].label}`);
      setTimeout(() => setOverrideMessage(null), 3000);
      onUpdate();
    } catch (err: any) {
      alert(`Failed to apply override: ${err.message || err}`);
    } finally {
      setIsApplyingOverride(false);
    }
  };

  const handleFailJob = async () => {
    const finalReason = customFailReason.trim() ? customFailReason.trim() : failReason;
    setIsCancelling(true);
    try {
      await cancelJob(job.id!, finalReason, operatorNotes);
      setShowFailModal(false);
      setOverrideMessage('Job marked as Failed / Cancelled');
      setTimeout(() => setOverrideMessage(null), 3000);
      onUpdate();
    } catch (err: any) {
      alert(`Failed to cancel job: ${err.message || err}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReactivateJob = async (targetLevel: JobStatus = 'pending') => {
    setIsApplyingOverride(true);
    try {
      await reactivateJob(job.id!, targetLevel);
      setOverrideMessage(`Job reactivated to ${STAGE_CONFIG[targetLevel].label}`);
      setTimeout(() => setOverrideMessage(null), 3000);
      onUpdate();
    } catch (err: any) {
      alert(`Failed to reactivate job: ${err.message || err}`);
    } finally {
      setIsApplyingOverride(false);
    }
  };

  const handleToggleCocStep = async (
    stepKey: 'client_pickup_at' | 'driver_pickup_at' | 'driver_delivery_at' | 'client_delivery_at',
    currentlyConfirmed: boolean,
    stepLabel?: string,
    note?: string
  ) => {
    setActingStep(stepKey);
    try {
      const action = !currentlyConfirmed ? 'force-confirmed' : 'reset';
      const entry = note?.trim()
        ? `[${format(new Date(), 'HH:mm')}] ${stepLabel || stepKey} ${action} — ${note.trim()}`
        : `[${format(new Date(), 'HH:mm')}] ${stepLabel || stepKey} ${action} via Command Centre`;
      // Append rather than overwrite — operator_notes is a single shared
      // field on the job row, and a per-step note shouldn't clobber notes
      // left on a previous step or in the main override panel.
      const combinedNotes = job.operator_notes ? `${job.operator_notes}\n${entry}` : entry;

      await overrideCocStep(job.id!, stepKey, !currentlyConfirmed, combinedNotes);
      setOverrideMessage(`COC Step updated.`);
      setTimeout(() => setOverrideMessage(null), 2500);
      setStepNotes(prev => ({ ...prev, [stepKey]: '' }));
      onUpdate();
    } catch (err: any) {
      alert(`Failed to update COC step: ${err.message || err}`);
    } finally {
      setActingStep(null);
    }
  };

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

  const currentStageIndex = STAGE_ORDER.indexOf(job.status as any);
  
  // Calculate highest reached stage index even if job is cancelled
  let effectiveStageIndex = currentStageIndex;
  if (job.status === 'cancelled') {
    if (job.client_delivery_at || job.client_delivery_confirmed_at) effectiveStageIndex = 4;
    else if (job.driver_delivery_at || job.driver_delivery_confirmed_at || job.driver_arrived_delivery_at) effectiveStageIndex = 3;
    else if (job.driver_pickup_at || job.driver_pickup_confirmed_at) effectiveStageIndex = 2;
    else if (job.client_pickup_at || job.client_pickup_confirmed_at || job.sender_ready_at || job.driver_arrived_pickup_at) effectiveStageIndex = 1;
    else effectiveStageIndex = 0;
  }

  const canAdvance = currentStageIndex >= 0 && currentStageIndex < STAGE_ORDER.length - 1 && job.status !== 'cancelled';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
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
                Mission Command Center
              </h2>
              <p className="text-[11px] text-brand-muted font-medium">
                {format(new Date(job.created_at || new Date()), 'PPPP · HH:mm')} · Corridor: <span className="text-brand-text">{job.pickup_emirate} → {job.delivery_emirate}</span>
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
                <span className="font-bold uppercase tracking-wider text-red-300">Job Marked as Failed / Cancelled:</span>{' '}
                <span className="italic">{job.cancellation_reason || 'Manual Failure Recorded'}</span>
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
                Reactivate (Pending)
              </button>
              <button
                onClick={() => handleReactivateJob('driver_pickup')}
                disabled={isApplyingOverride}
                className="px-3 py-1.5 bg-brand-neon/10 hover:bg-brand-neon/20 text-brand-neon border border-brand-neon/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Resume (In-Transit)
              </button>
            </div>
          </div>
        )}

        {/* Level Progression Stepper (Command Lifecycle) */}
        <div className="px-6 py-3.5 bg-brand-surface/40 border-b border-brand-border overflow-x-auto no-scrollbar">
          <div className="flex items-center justify-between min-w-[620px] gap-2">
            {STAGE_ORDER.map((stageKey, idx) => {
              const isPast = job.status === 'cancelled' ? effectiveStageIndex >= idx : currentStageIndex > idx;
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

        {/* Modal Main Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto no-scrollbar">
          {/* Left Column: Job Details & Mission Control */}
          <div className="md:w-1/2 p-6 sm:p-8 border-r border-brand-border overflow-y-auto no-scrollbar space-y-6">
            
            {/* Emergency Controls - Use when customer/driver isn't responding */}
            <div className="p-5 bg-brand-surface/60 border border-yellow-500/30 rounded-3xl space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text">Emergency Status Control</h3>
                </div>
                {canAdvance && (
                  <button
                    onClick={handleNextStage}
                    disabled={isApplyingOverride}
                    className="px-3 py-1.5 bg-brand-neon text-brand-bg rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(57,255,20,0.25)]"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    Move to Next Stage
                  </button>
                )}
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-brand-text leading-relaxed">
                  <strong className="text-yellow-500">Use this only if:</strong> Customer or driver is unresponsive and you need to manually advance the job. This bypasses the normal verification system.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-brand-muted uppercase mb-1.5">
                    <div className="flex items-center gap-2">
                      <span>Jump Job To</span>
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
                    <option value="pending">1️⃣ Pending - Waiting for driver</option>
                    <option value="client_pickup">2️⃣ Pickup - Driver collecting from sender</option>
                    <option value="driver_pickup">3️⃣ In Transit - Driver has package</option>
                    <option value="driver_delivery">4️⃣ Arrived - Driver at recipient</option>
                    <option value="completed">5️⃣ Delivered - Job complete ✅</option>
                    <option value="cancelled">❌ Cancelled - Job failed</option>
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
                    Force Update Status
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
                <span>✓ Automatically mark all previous steps as verified (recommended)</span>
              </label>

              {/* Operator Notes Field */}
              <div>
                <label className="block text-[11px] font-semibold text-brand-muted uppercase mb-1">
                  Reason for Manual Update <span className="text-yellow-500">(Required)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={operatorNotes}
                    onChange={(e) => setOperatorNotes(e.target.value)}
                    placeholder="e.g., Customer confirmed delivery by phone"
                    className="flex-1 bg-brand-input border border-brand-input-border rounded-xl px-3 py-1.5 text-xs text-brand-text placeholder:text-brand-muted/50 focus:border-brand-neon outline-none"
                  />
                  <button
                    onClick={async () => {
                      try {
                        await updateJob(job.id!, { operator_notes: operatorNotes });
                        setOverrideMessage('Note saved.');
                        setTimeout(() => setOverrideMessage(null), 2000);
                        onUpdate();
                      } catch (err: any) {
                        alert(`Failed to save note: ${err.message || err}`);
                      }
                    }}
                    className="px-3 py-1.5 bg-brand-input hover:bg-brand-surface border border-brand-border text-brand-text rounded-xl text-xs font-semibold"
                  >
                    Save
                  </button>
                </div>
                <p className="text-[10px] text-brand-muted mt-1 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  This note is saved to the job audit log for compliance
                </p>
              </div>

              {/* Mark as Failed Trigger */}
              {job.status !== 'cancelled' && (
                <div className="pt-2 border-t border-brand-border/60 flex justify-between items-center bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <Ban className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-brand-text font-medium">Job can't be completed?</span>
                  </div>
                  <button
                    onClick={() => setShowFailModal(true)}
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-semibold flex items-center gap-1 border border-red-500/40 transition-all"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Cancel Job
                  </button>
                </div>
              )}
            </div>

            {/* Job Details — editable so operators can correct mistakes made at intake */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">Job Details</p>
                {!editingDetails ? (
                  <button
                    type="button"
                    onClick={() => { setDetailsForm(buildDetailsForm(job)); setEditingDetails(true); }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-input hover:bg-brand-surface border border-brand-border rounded-lg text-[11px] font-semibold text-brand-muted hover:text-brand-text transition-all"
                  >
                    <Edit3 className="w-3 h-3" />
                    Edit Details
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={savingDetails}
                      onClick={() => { setDetailsForm(buildDetailsForm(job)); setEditingDetails(false); }}
                      className="px-2.5 py-1 bg-brand-input hover:bg-brand-surface border border-brand-border rounded-lg text-[11px] font-semibold text-brand-muted disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={savingDetails}
                      onClick={handleSaveDetails}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-neon text-brand-bg rounded-lg text-[11px] font-bold disabled:opacity-50"
                    >
                      {savingDetails ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Save Changes
                    </button>
                  </div>
                )}
              </div>

              {!editingDetails ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">Consignor (Sender)</p>
                    <div className="p-4 bg-brand-input rounded-2xl border border-brand-border">
                      <p className="text-sm font-semibold text-brand-text mb-0.5 truncate">{job.sender_name}</p>
                      <p className="text-xs font-mono text-brand-neon">{job.sender_phone}</p>
                      <div className="mt-2 text-xs text-brand-muted line-clamp-2">
                        <span className="text-brand-text font-medium">{job.pickup_emirate}:</span> {job.pickup_location}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">Consignee (Recipient)</p>
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
                      <p className="text-[10px] uppercase text-brand-muted mb-1">Item</p>
                      <p className="text-xs font-medium text-brand-text capitalize">{job.item_type?.replace('_', ' ') || '—'}</p>
                    </div>
                    <div className="p-3 bg-brand-input rounded-xl border border-brand-border">
                      <p className="text-[10px] uppercase text-brand-muted mb-1">Urgency</p>
                      <p className="text-xs font-medium text-brand-text capitalize">{job.urgency || '—'}</p>
                    </div>
                    <div className="p-3 bg-brand-input rounded-xl border border-brand-border">
                      <p className="text-[10px] uppercase text-brand-muted mb-1">Price (AED)</p>
                      <p className="text-xs font-medium text-brand-text">{job.price_aed != null ? job.price_aed : '—'}</p>
                    </div>
                  </div>
                  {job.special_instructions && (
                    <div className="col-span-2 p-3 bg-brand-input rounded-xl border border-brand-border">
                      <p className="text-[10px] uppercase text-brand-muted mb-1">Special Instructions</p>
                      <p className="text-xs text-brand-text whitespace-pre-wrap">{job.special_instructions}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 p-4 bg-brand-input/60 border border-brand-neon/30 rounded-2xl">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">Consignor (Sender)</p>
                      <input
                        value={detailsForm.sender_name}
                        onChange={(e) => setDetailsForm(prev => ({ ...prev, sender_name: e.target.value }))}
                        placeholder="Sender name"
                        className="w-full bg-brand-bg border border-brand-input-border rounded-xl px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-neon"
                      />
                      <input
                        value={detailsForm.sender_phone}
                        onChange={(e) => setDetailsForm(prev => ({ ...prev, sender_phone: e.target.value }))}
                        placeholder="Sender phone"
                        className="w-full bg-brand-bg border border-brand-input-border rounded-xl px-3 py-2 text-xs font-mono text-brand-text outline-none focus:border-brand-neon"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={detailsForm.pickup_emirate}
                          onChange={(e) => setDetailsForm(prev => ({ ...prev, pickup_emirate: e.target.value }))}
                          className="bg-brand-bg border border-brand-input-border rounded-xl px-2 py-2 text-xs text-brand-text outline-none focus:border-brand-neon"
                        >
                          {['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'RAK', 'Fujairah', 'UMM Al Quwain'].map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                        <input
                          value={detailsForm.pickup_location}
                          onChange={(e) => setDetailsForm(prev => ({ ...prev, pickup_location: e.target.value }))}
                          placeholder="Pickup address"
                          className="bg-brand-bg border border-brand-input-border rounded-xl px-2 py-2 text-xs text-brand-text outline-none focus:border-brand-neon"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">Consignee (Recipient)</p>
                      <input
                        value={detailsForm.recipient_name}
                        onChange={(e) => setDetailsForm(prev => ({ ...prev, recipient_name: e.target.value }))}
                        placeholder="Recipient name"
                        className="w-full bg-brand-bg border border-brand-input-border rounded-xl px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-neon"
                      />
                      <input
                        value={detailsForm.recipient_phone}
                        onChange={(e) => setDetailsForm(prev => ({ ...prev, recipient_phone: e.target.value }))}
                        placeholder="Recipient phone"
                        className="w-full bg-brand-bg border border-brand-input-border rounded-xl px-3 py-2 text-xs font-mono text-brand-text outline-none focus:border-brand-neon"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={detailsForm.delivery_emirate}
                          onChange={(e) => setDetailsForm(prev => ({ ...prev, delivery_emirate: e.target.value }))}
                          className="bg-brand-bg border border-brand-input-border rounded-xl px-2 py-2 text-xs text-brand-text outline-none focus:border-brand-neon"
                        >
                          {['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'RAK', 'Fujairah', 'UMM Al Quwain'].map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                        <input
                          value={detailsForm.delivery_location}
                          onChange={(e) => setDetailsForm(prev => ({ ...prev, delivery_location: e.target.value }))}
                          placeholder="Delivery address"
                          className="bg-brand-bg border border-brand-input-border rounded-xl px-2 py-2 text-xs text-brand-text outline-none focus:border-brand-neon"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase text-brand-muted mb-1">Item</label>
                      <select
                        value={detailsForm.item_type}
                        onChange={(e) => setDetailsForm(prev => ({ ...prev, item_type: e.target.value as ItemType }))}
                        className="w-full bg-brand-bg border border-brand-input-border rounded-xl px-2 py-2 text-xs text-brand-text outline-none focus:border-brand-neon"
                      >
                        <option value="parcel">Parcel</option>
                        <option value="document">Document</option>
                        <option value="spare_part">Spare Part</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-brand-muted mb-1">Urgency</label>
                      <select
                        value={detailsForm.urgency}
                        onChange={(e) => setDetailsForm(prev => ({ ...prev, urgency: e.target.value as UrgencyType }))}
                        className="w-full bg-brand-bg border border-brand-input-border rounded-xl px-2 py-2 text-xs text-brand-text outline-none focus:border-brand-neon"
                      >
                        <option value="immediate">Immediate</option>
                        <option value="today">Today</option>
                        <option value="scheduled">Scheduled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-brand-muted mb-1">Price (AED)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={detailsForm.price_aed}
                        onChange={(e) => setDetailsForm(prev => ({ ...prev, price_aed: e.target.value }))}
                        placeholder="e.g. 45"
                        className="w-full bg-brand-bg border border-brand-input-border rounded-xl px-2 py-2 text-xs font-mono text-brand-text outline-none focus:border-brand-neon"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase text-brand-muted mb-1">Special Instructions</label>
                    <textarea
                      value={detailsForm.special_instructions}
                      onChange={(e) => setDetailsForm(prev => ({ ...prev, special_instructions: e.target.value }))}
                      placeholder="e.g. Fragile, call before arrival, gate code..."
                      rows={2}
                      className="w-full bg-brand-bg border border-brand-input-border rounded-xl px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-neon"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Pilot Assignment */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">Assigned Pilot</p>
              <div className="p-4 bg-brand-surface border border-brand-border rounded-2xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-neon/10 flex items-center justify-center border border-brand-neon/20">
                    <Truck className="w-5 h-5 text-brand-neon" />
                  </div>
                  <div>
                    {job.driver?.full_name ? (
                      <>
                        <p className="text-sm font-semibold text-brand-text">{job.driver.full_name}</p>
                        <p className="text-xs text-brand-muted font-mono">{job.driver.phone} · {job.driver.vehicle_type || 'Corridor Pilot'}</p>
                      </>
                    ) : (
                      <p className="text-sm font-medium text-brand-muted italic">Pilot Pending Assignment</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReassigning(v => !v)}
                  className="px-3.5 py-1.5 bg-brand-input hover:bg-brand-surface border border-brand-border rounded-xl text-xs font-semibold uppercase tracking-wider"
                >
                  {job.driver?.full_name ? 'Reassign' : 'Assign'}
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
                        alert(`Failed to assign driver: ${err.message || err}`);
                      } finally {
                        setAssigningDriver(false);
                      }
                    }}
                    className="flex-1 bg-brand-input border border-brand-input-border rounded-xl px-3 py-2 text-xs font-medium text-brand-text focus:border-brand-neon outline-none"
                  >
                    <option value="unassigned">Unassigned</option>
                    {drivers.map(d => {
                      const statusIcon = d.status === 'available' ? '🟢' : d.status === 'on_job' ? '🟠' : '⚪';
                      return (
                        <option key={d.id} value={d.id}>{statusIcon} {d.full_name} (Tier {d.tier || 'D'} · {d.vehicle_type})</option>
                      );
                    })}
                  </select>
                  {assigningDriver && <Loader2 className="w-4 h-4 animate-spin text-brand-muted" />}
                </div>
              )}
            </div>

            {/* Quick Dispatch WhatsApp Buttons */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">Operational WhatsApp Links</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'sender', label: 'Sender Dsp.', sent: job.sender_notified },
                  { id: 'driver', label: 'Pilot Dsp.', sent: job.driver_notified },
                  { id: 'recipient', label: 'Client Dsp.', sent: job.recipient_notified }
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
                      {btn.sent ? 'Dispatched' : 'Ready'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Delivery Verification Steps */}
          <div className="md:w-1/2 p-6 sm:p-8 bg-brand-surface/30 flex flex-col justify-between overflow-y-auto no-scrollbar space-y-6">
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-base font-display font-bold tracking-tight text-brand-text">Delivery Verification Steps</h3>
                  <p className="text-xs text-brand-muted">Track each handoff from sender → driver → recipient</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-brand-muted font-mono bg-brand-input px-2.5 py-1 rounded-lg border border-brand-border">
                  <Shield className="w-3.5 h-3.5 text-brand-neon" />
                  <span>OTP Secured</span>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-brand-text leading-relaxed">
                  <strong className="text-blue-400">How this works:</strong> Each step requires either an OTP code or your manual verification. Use "Override Step" only if the person isn't responding but you've confirmed by phone.
                </div>
              </div>

              {/* Verification Steps List */}
              <div className="space-y-4 relative">
                <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-brand-border" />
                
                {[
                  { 
                    label: '1. Sender Handed Package to Driver', 
                    stepKey: 'client_pickup_at' as const,
                    status: job.client_pickup_at, 
                    tokenKey: 'token_client_pickup', 
                    icon: Package,
                    otp: job.otp_sender,
                    desc: 'Sender confirms driver collected the package'
                  },
                  { 
                    label: '2. Driver Confirmed Pickup', 
                    stepKey: 'driver_pickup_at' as const,
                    status: job.driver_pickup_at, 
                    tokenKey: 'token_driver_pickup', 
                    icon: Truck,
                    otp: job.otp_driver_pickup,
                    desc: 'Driver confirms they have the package and are on the way'
                  },
                  { 
                    label: '3. Driver Arrived at Destination', 
                    stepKey: 'driver_delivery_at' as const,
                    status: job.driver_delivery_at, 
                    tokenKey: 'token_driver_delivery', 
                    icon: Navigation,
                    otp: job.otp_driver_delivery,
                    desc: 'Driver confirms arrival at recipient location'
                  },
                  { 
                    label: '4. Recipient Received Package', 
                    stepKey: 'client_delivery_at' as const,
                    status: job.client_delivery_at, 
                    tokenKey: 'token_client_delivery', 
                    icon: CheckCircle2,
                    otp: job.otp_recipient,
                    desc: 'Recipient confirms they received the package'
                  }
                ].map((step, i) => {
                  const cocDomain = (import.meta.env.VITE_COC_URL || 'https://nokael.ae').replace(/\/$/, '');
                  const stepSlug = step.tokenKey.replace('token_', '').replace('_', '-');
                  const tokenValue = (job as any)[step.tokenKey];
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
                            ? '✓ Verified & Complete'
                            : `⏳ Waiting · Security Code: ${step.otp || 'Not set'}`
                          }
                        </p>

                        {/* Per-step audit note */}
                        <div className="pt-1">
                          <input
                            type="text"
                            value={stepNotes[step.stepKey] || ''}
                            onChange={(e) => setStepNotes(prev => ({ ...prev, [step.stepKey]: e.target.value }))}
                            placeholder="Add note if manually verifying (optional)..."
                            className="w-full bg-brand-input border border-brand-input-border rounded-lg px-2.5 py-1.5 text-[11px] text-brand-text placeholder:text-brand-muted/50 focus:border-brand-neon outline-none"
                          />
                        </div>

                        {/* Override Step / Undo & Link Actions */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-brand-border/60 mt-2">
                          <button
                            onClick={() => handleToggleCocStep(step.stepKey, isConfirmed, step.label, stepNotes[step.stepKey])}
                            disabled={isBusy}
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
                                Undo
                              </>
                            ) : (
                              <>
                                <CheckSquare className="w-3.5 h-3.5" />
                                Override Step
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
                                title="Copy verification link to send via WhatsApp"
                              >
                                <Copy className="w-3 h-3" />
                                {copiedStep === step.tokenKey ? 'Copied!' : 'Copy Link'}
                              </button>
                              <a
                                href={stepUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-brand-input hover:bg-brand-surface rounded-lg border border-brand-border text-[11px] font-semibold text-brand-muted hover:text-brand-text transition-all"
                                title="Open verification page in new tab"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Open
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
                  Download Proof of Delivery (PDF)
                </button>
              </motion.div>
            )}
          </div>
        </div>

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
                    <h3 className="text-base font-bold text-brand-text">Cancel This Job</h3>
                    <p className="text-xs text-brand-muted">Record why the delivery couldn't be completed</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-brand-muted uppercase mb-1">Why is this job being cancelled?</label>
                    <select
                      value={failReason}
                      onChange={(e) => setFailReason(e.target.value)}
                      className="w-full bg-brand-input border border-brand-input-border rounded-xl px-3 py-2 text-xs text-brand-text outline-none focus:border-red-500"
                    >
                      {COMMON_FAILURE_REASONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                      <option value="Custom">Other reason (specify below)</option>
                    </select>
                  </div>

                  {failReason === 'Custom' && (
                    <div>
                      <label className="block text-xs font-semibold text-brand-muted uppercase mb-1">Explain the reason</label>
                      <textarea
                        value={customFailReason}
                        onChange={(e) => setCustomFailReason(e.target.value)}
                        placeholder="Describe what happened..."
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
                    Back
                  </button>
                  <button
                    onClick={handleFailJob}
                    disabled={isCancelling}
                    className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-red-500/20"
                  >
                    {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                    Confirm Failure Status
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
