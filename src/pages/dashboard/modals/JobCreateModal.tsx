import React from 'react';
import { motion } from 'motion/react';
import { Zap, User, Navigation, X, MapPin, Loader2 } from 'lucide-react';
import { supabase, createJob, type Driver, type Job, type ItemType, type UrgencyType } from '../../../lib/supabase';
import { sendTelegramNotification, formatJobAssignmentNotification } from '../../../lib/notifications';

export const JobCreateModal: React.FC<{ onClose: () => void, onSuccess: () => void, initialData?: Partial<Job>, drivers: Driver[] }> = ({ onClose, onSuccess, initialData, drivers }) => {
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    sender_name: initialData?.sender_name || '',
    sender_phone: initialData?.sender_phone || '',
    recipient_name: initialData?.recipient_name || '',
    recipient_phone: initialData?.recipient_phone || '',
    pickup_emirate: initialData?.pickup_emirate || 'Dubai',
    pickup_location: initialData?.pickup_location || '',
    delivery_emirate: initialData?.delivery_emirate || 'Abu Dhabi',
    delivery_location: initialData?.delivery_location || '',
    item_type: initialData?.item_type || 'parcel' as ItemType,
    urgency: initialData?.urgency || 'immediate' as UrgencyType,
    driver_id: initialData?.driver_id || '',
    notes: (initialData as any)?.notes || initialData?.special_instructions || '',
    quote_id: initialData?.quote_id || null,
    // 'driver_only' (2-step, driver-confirmed) is the default going forward.
    // 'four_step' brings back the confirm.nokael.com sender/recipient portal
    // steps for jobs that specifically need them.
    confirmation_mode: (initialData?.confirmation_mode || 'driver_only') as 'four_step' | 'driver_only'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const genOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
      const tokens = {
        token_client_pickup: crypto.randomUUID(),
        token_driver_pickup: crypto.randomUUID(),
        token_driver_delivery: crypto.randomUUID(),
        token_client_delivery: crypto.randomUUID()
      };

      const otpVal = genOtp();
      const payload: Partial<Job> = {
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
        special_instructions: formData.notes,
        operator_notes: formData.notes,
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
      console.error('Error creating job:', err);
      alert('Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
        className="relative w-full max-w-4xl bg-brand-bg border border-brand-border rounded-[40px] shadow-3xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-6 border-b border-brand-border flex justify-between items-center bg-brand-surface/20">
           <div>
              <h2 className="text-2xl font-display font-medium tracking-tighter mb-1">Manual Job Intake.</h2>
              <p className="text-xs text-brand-muted uppercase tracking-wide font-medium font-mono">Operator manual dispatch override</p>
           </div>
           <button onClick={onClose} className="p-2 bg-brand-input rounded-full text-brand-muted hover:text-brand-text transition-colors">
              <X className="w-6 h-6" />
           </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto no-scrollbar space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-6">
                 <h3 className="text-xs font-medium text-brand-neon flex items-center gap-2">
                   <User className="w-3 h-3" />
                   Sender Information
                 </h3>
                 <div className="space-y-4">
                   <input required value={formData.sender_name} onChange={e => setFormData({...formData, sender_name: e.target.value})} type="text" placeholder="Full Name / Company" className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm focus:border-brand-neon/50 outline-none" />
                   <input required value={formData.sender_phone} onChange={e => setFormData({...formData, sender_phone: e.target.value})} type="tel" placeholder="WhatsApp Number" className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm focus:border-brand-neon/50 outline-none" />
                 </div>
               </div>
               <div className="space-y-6">
                 <h3 className="text-xs font-medium text-brand-neon flex items-center gap-2">
                   <User className="w-3 h-3" />
                   Recipient Information
                 </h3>
                 <div className="space-y-4">
                   <input required value={formData.recipient_name} onChange={e => setFormData({...formData, recipient_name: e.target.value})} type="text" placeholder="Full Name / Company" className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm focus:border-brand-neon/50 outline-none" />
                   <input required value={formData.recipient_phone} onChange={e => setFormData({...formData, recipient_phone: e.target.value})} type="tel" placeholder="WhatsApp Number" className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm focus:border-brand-neon/50 outline-none" />
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-6">
                 <h3 className="text-xs font-medium text-brand-neon flex items-center gap-2">
                   <MapPin className="w-3 h-3" />
                   Pickup Logistics
                 </h3>
                 <div className="space-y-4">
                   <select required value={formData.pickup_emirate} onChange={e => setFormData({...formData, pickup_emirate: e.target.value})} className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm outline-none">
                     {['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'RAK', 'Fujairah', 'UMM Al Quwain'].map(e => <option key={e} value={e}>{e}</option>)}
                   </select>
                   <input required value={formData.pickup_location} onChange={e => setFormData({...formData, pickup_location: e.target.value})} type="text" placeholder="Specific Pickup Address / Area" className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm focus:border-brand-neon/50 outline-none" />
                 </div>
               </div>
               <div className="space-y-6">
                 <h3 className="text-xs font-medium text-brand-neon flex items-center gap-2">
                   <Navigation className="w-3 h-3" />
                   Delivery Logistics
                 </h3>
                 <div className="space-y-4">
                    <select required value={formData.delivery_emirate} onChange={e => setFormData({...formData, delivery_emirate: e.target.value})} className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm outline-none">
                     {['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'RAK', 'Fujairah', 'UMM Al Quwain'].map(e => <option key={e} value={e}>{e}</option>)}
                   </select>
                   <input required value={formData.delivery_location} onChange={e => setFormData({...formData, delivery_location: e.target.value})} type="text" placeholder="Specific Delivery Address / Area" className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm focus:border-brand-neon/50 outline-none" />
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="space-y-4">
                  <p className="text-xs font-medium text-brand-muted">Item Category</p>
                  <select value={formData.item_type} onChange={e => setFormData({...formData, item_type: e.target.value as any})} className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm outline-none">
                    <option value="parcel">Standard Parcel</option>
                    <option value="document">Legal Document</option>
                    <option value="spare_part">Machine Spare Part</option>
                    <option value="other">Other Manifest</option>
                  </select>
               </div>
               <div className="space-y-4">
                  <p className="text-xs font-medium text-brand-muted">Urgency Status</p>
                  <select value={formData.urgency} onChange={e => setFormData({...formData, urgency: e.target.value as any})} className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm outline-none">
                    <option value="immediate">Immediate Dispatch</option>
                    <option value="today">Same Day UAE</option>
                    <option value="scheduled">Scheduled Logistics</option>
                  </select>
               </div>
               <div className="space-y-4">
                  <p className="text-xs font-medium text-brand-muted">Driver Assignment</p>
                  <select
                    value={formData.driver_id}
                    onChange={e => setFormData({...formData, driver_id: e.target.value})}
                    className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm outline-none"
                  >
                    <option value="">Unassigned — assign later</option>
                    {drivers.map(d => {
                      const statusIcon = d.status === 'available' ? '🟢' : d.status === 'on_job' ? '🟠' : '⚪';
                      return (
                        <option key={d.id} value={d.id}>{statusIcon} {d.full_name} (Tier {d.tier || 'D'} · {d.vehicle_type})</option>
                      );
                    })}
                  </select>
               </div>
            </div>

            <div className="space-y-4">
               <p className="text-xs font-medium text-brand-muted">Chain-of-Custody Confirmation</p>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, confirmation_mode: 'driver_only' })}
                    className={`text-left p-5 rounded-2xl border transition-all ${formData.confirmation_mode === 'driver_only' ? 'border-brand-neon bg-brand-neon/10' : 'border-brand-input-border bg-brand-input'}`}
                  >
                     <p className="text-sm font-semibold text-brand-text mb-1">2-Step · Driver-Confirmed</p>
                     <p className="text-xs text-brand-muted leading-relaxed">Driver enters both OTPs in the app (pickup + delivery). No sender/recipient portal step. Default.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, confirmation_mode: 'four_step' })}
                    className={`text-left p-5 rounded-2xl border transition-all ${formData.confirmation_mode === 'four_step' ? 'border-brand-neon bg-brand-neon/10' : 'border-brand-input-border bg-brand-input'}`}
                  >
                     <p className="text-sm font-semibold text-brand-text mb-1">4-Step · Sender + Driver + Recipient</p>
                     <p className="text-xs text-brand-muted leading-relaxed">Sender and recipient each confirm via confirm.nokael.com in addition to the driver. Use for high-value or client-mandated chain-of-custody.</p>
                  </button>
               </div>
            </div>

            <button disabled={loading} type="submit" className="btn-primary w-full py-6 flex items-center justify-center gap-4 text-sm font-semibold transition-all">
               {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6" />}
               Commit Dispatch to Pipeline
            </button>
        </form>
      </motion.div>
    </div>
  );
};
