import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Package, Zap, User, Phone, CheckCircle2, ArrowRight, ArrowLeft, MessageSquare, Loader2, Navigation, Truck, Clock } from 'lucide-react';
import { submitQuoteRequest, type QuoteRequest } from '../lib/supabase';
import { WHATSAPP_NUMBER, DISPLAY_PHONE } from '../constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const emirates = [
  'Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'
];

const itemTypes = [
  { id: 'document', label: 'Document', icon: Navigation, desc: 'Legal, Tenders, Passports' },
  { id: 'parcel', label: 'Parcel', icon: Package, desc: 'Personal or Business items' },
  { id: 'spare_part', label: 'Spare Part', icon: Zap, desc: 'Industrial or Automotive' },
  { id: 'other', label: 'Other', icon: Truck, desc: 'Custom logistics' },
];

const urgencyLevels = [
  { id: 'immediate', label: 'Immediate Dispatch', color: 'bg-brand-neon', desc: 'Driver assigned in 2-5 mins' },
  { id: 'today', label: 'Same Day', color: 'bg-brand-blue', desc: 'Delivery by end of day' },
  { id: 'scheduled', label: 'Scheduled', color: 'bg-white/20', desc: 'Pre-book for specific time' },
];

export default function GetQuote() {
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
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
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 4) {
      nextStep();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await submitQuoteRequest(formData as QuoteRequest);
      setSubmitted(true);
      
      // Redirect to WhatsApp after 2 seconds
      setTimeout(() => {
        const message = `Hi Nokael, I need a quote for a ${formData.item_type} delivery from ${formData.pickup_location}, ${pickupEmirate} to ${formData.delivery_location}, ${deliveryEmirate}. Urgency: ${formData.urgency}. My name is ${formData.name}.`;
        window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      }, 2000);
    } catch (err: any) {
      console.error('Error submitting quote:', err);
      setError(err.message || 'There was an error submitting your request. Please check your Supabase configuration.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full dispatch-card text-center py-16"
        >
          <div className="w-20 h-20 bg-brand-neon/10 rounded-full flex items-center justify-center mx-auto mb-10">
            <CheckCircle2 className="w-10 h-10 text-brand-neon" />
          </div>
          <h2 className="text-3xl font-display font-medium tracking-tighter mb-4">Request Logged</h2>
          <p className="text-brand-muted mb-10 leading-relaxed text-sm">
            Your dispatch request has been entered into the system. Connecting you to a live dispatcher on WhatsApp...
          </p>
          <div className="flex items-center justify-center gap-3 text-brand-neon font-bold uppercase tracking-[0.3em] text-[10px]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting to Dispatch</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="asymmetric-grid items-start">
        <div>
          <div className="mb-12">
            <h1 className="text-4xl md:text-6xl font-display font-medium tracking-tighter mb-6">Request Dispatch</h1>
            <p className="text-brand-muted text-sm max-w-md leading-relaxed">
              Enter your pickup details below. A dedicated driver will be assigned to your route immediately after confirmation.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="dispatch-card relative overflow-hidden">
            {error && (
              <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs leading-relaxed">
                <p className="font-bold mb-1 uppercase tracking-widest">Dispatch Error</p>
                {error}
              </div>
            )}
            <div className="flex items-center justify-between mb-10 pb-6 border-b border-brand-border">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted">
                Step {step} / 4
              </p>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(i => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-6 h-1 rounded-full transition-all",
                      i <= step ? "bg-brand-neon" : "bg-brand-input-border"
                    )} 
                  />
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <div className="space-y-6">
                    {/* Pickup */}
                    <div className="p-5 rounded-2xl border border-brand-input-border bg-brand-input/40 space-y-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-neon">📍 Pickup</p>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-2">Emirate</label>
                        <div className="relative">
                          <select
                            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-3.5 px-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors appearance-none text-sm"
                            value={pickupEmirate}
                            onChange={e => updatePickupEmirate(e.target.value)}
                          >
                            {emirates.map(em => <option key={em} value={em} className="bg-brand-surface">{em}</option>)}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-muted">
                            <ArrowRight className="w-4 h-4 rotate-90" />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-2">Street / Area / Building</label>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                          <input
                            required
                            type="text"
                            placeholder="e.g. Marina Tower, JBR"
                            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-3.5 pl-12 pr-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors text-sm"
                            value={formData.pickup_location}
                            onChange={e => updateForm({ pickup_location: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Delivery */}
                    <div className="p-5 rounded-2xl border border-brand-input-border bg-brand-input/40 space-y-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-neon">🏁 Delivery</p>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-2">Emirate</label>
                        <div className="relative">
                          <select
                            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-3.5 px-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors appearance-none text-sm"
                            value={deliveryEmirate}
                            onChange={e => updateDeliveryEmirate(e.target.value)}
                          >
                            {emirates.map(em => <option key={em} value={em} className="bg-brand-surface">{em}</option>)}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-muted">
                            <ArrowRight className="w-4 h-4 rotate-90" />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-2">Street / Area / Building</label>
                        <div className="relative">
                          <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                          <input
                            required
                            type="text"
                            placeholder="e.g. Khalifa City, Villa 45"
                            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-3.5 pl-12 pr-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors text-sm"
                            value={formData.delivery_location}
                            onChange={e => updateForm({ delivery_location: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {itemTypes.map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => updateForm({ item_type: type.id as any })}
                        className={cn(
                          "p-6 rounded-xl border transition-all text-left group",
                          formData.item_type === type.id 
                            ? "bg-brand-neon/5 border-brand-neon/30" 
                            : "bg-brand-input border-brand-input-border hover:border-brand-neon/20"
                        )}
                      >
                        <type.icon className={cn("w-6 h-6 mb-4 transition-colors", formData.item_type === type.id ? "text-brand-neon" : "text-brand-muted")} />
                        <p className={cn("font-bold text-sm mb-1", formData.item_type === type.id ? "text-brand-text" : "text-brand-muted")}>{type.label}</p>
                        <p className="text-[10px] text-brand-muted uppercase tracking-wider">{type.desc}</p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  {urgencyLevels.map(level => (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => updateForm({ urgency: level.id as any })}
                      className={cn(
                        "w-full p-6 rounded-xl border transition-all text-left flex items-center justify-between group",
                        formData.urgency === level.id 
                          ? "bg-brand-neon/5 border-brand-neon/30" 
                          : "bg-white/[0.02] border-white/[0.05] hover:border-white/[0.1]"
                      )}
                    >
                      <div className="flex items-center gap-5">
                        <div className={cn("w-2 h-2 rounded-full", level.color)} />
                        <div>
                          <h4 className={cn("font-bold text-sm mb-1", formData.urgency === level.id ? "text-white" : "text-brand-muted")}>
                            {level.label}
                          </h4>
                          <p className="text-[10px] text-brand-muted uppercase tracking-wider">{level.desc}</p>
                        </div>
                      </div>
                      {formData.urgency === level.id && <CheckCircle2 className="w-4 h-4 text-brand-neon" />}
                    </button>
                  ))}
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-3">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                        <input
                          required
                          type="text"
                          placeholder="Your Name"
                          className="w-full bg-brand-input border border-brand-input-border rounded-xl py-4 pl-12 pr-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors text-sm"
                          value={formData.name}
                          onChange={e => updateForm({ name: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-3">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                        <input
                          required
                          type="tel"
                          placeholder={DISPLAY_PHONE}
                          className="w-full bg-brand-input border border-brand-input-border rounded-xl py-4 pl-12 pr-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors text-sm"
                          value={formData.phone}
                          onChange={e => updateForm({ phone: e.target.value })}
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center transition-all",
                        formData.whatsapp_opt_in ? "bg-brand-neon border-brand-neon" : "bg-brand-input border-brand-input-border group-hover:border-brand-neon/30"
                      )}>
                        {formData.whatsapp_opt_in && <CheckCircle2 className="w-3 h-3 text-brand-bg" />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={formData.whatsapp_opt_in}
                        onChange={e => updateForm({ whatsapp_opt_in: e.target.checked })}
                      />
                      <span className="text-xs text-brand-muted font-medium">I want to receive the quote on WhatsApp</span>
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-12 flex items-center gap-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="btn-secondary flex-1 py-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-[2] py-4"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{step === 4 ? 'Confirm Dispatch' : 'Continue'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="hidden lg:block space-y-6">
          <div className="dispatch-card">
            <h4 className="text-xs font-bold uppercase tracking-widest mb-6 text-brand-muted">System Context</h4>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-brand-neon/10 flex items-center justify-center text-brand-neon">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold mb-1">Direct Assignment</p>
                  <p className="text-[10px] text-brand-muted leading-relaxed">Your request goes directly to the driver on the corridor. No third parties.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                  <Navigation className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold mb-1">Live GPS</p>
                  <p className="text-[10px] text-brand-muted leading-relaxed">Once confirmed, you'll receive a live location pin of your driver.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-brand-input border border-brand-input-border">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-4">Urgent Support</p>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              className="flex items-center gap-3 text-brand-neon hover:underline text-sm font-bold"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat with Dispatch</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
