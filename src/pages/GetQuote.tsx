import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Package, Zap, User, Phone, CheckCircle2, ArrowRight, ArrowLeft, MessageSquare, Loader2, Navigation, Truck, Clock, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { submitQuoteRequest, type QuoteRequest } from '../lib/supabase';
import { captureUTMs, getStoredUTMs } from '../lib/analytics';
import { WHATSAPP_NUMBER, DISPLAY_PHONE, PRICE_TIER_SAME_DAY, PRICE_TIER_DEDICATED } from '../constants';
import { trackWhatsAppClick, trackFormSubmission } from '../lib/analytics';
import { cn } from '../lib/utils';

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
  const navigate = useNavigate();
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
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
    customer_type: 'business',
    company_name: '',
    repeat_business: false,
  });

  // Capture UTMs on page load — this is where most Google Ads traffic arrives
  React.useEffect(() => {
    captureUTMs();
  }, []);

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
      // Merge UTM attribution data into the lead record before saving
      const utms = getStoredUTMs();
      const enrichedData: QuoteRequest = {
        ...(formData as QuoteRequest),
        // UTM fields — these map to columns added via the SQL migration
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        utm_term: utms.utm_term,
        gclid: utms.gclid,
      };

      await submitQuoteRequest(enrichedData);
      
      // Build the pre-filled WhatsApp message
      const message = encodeURIComponent(
        `Hi Nokael, I need a quote for a ${formData.item_type} delivery from ${formData.pickup_location}, ${pickupEmirate} to ${formData.delivery_location}, ${deliveryEmirate}. Urgency: ${formData.urgency}. My name is ${formData.name}.`
      );

      // Navigate to /thank-you — this is where the Google Ads conversion pixel fires.
      // The WhatsApp redirect happens from that page after a short delay.
      navigate(`/thank-you?wa=${message}`, { 
        state: { 
          userData: {
            phone_number: formData.phone,
            first_name: formData.name
          } 
        } 
      });

    } catch (err: any) {
      console.error('Error submitting quote:', err);
      setError(err.message || 'There was an error submitting your request. Please check your Supabase configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="asymmetric-grid items-start">
        <div>
          <div className="mb-12">
            <h1 className="text-4xl md:text-6xl font-display font-medium tracking-tighter mb-6">Request a Quote</h1>
            <p className="text-brand-muted text-sm max-w-md leading-relaxed">
              Send the route, item type, and deadline. We’ll confirm the fastest available option.
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
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => updateForm({ customer_type: 'business' })}
                        className={cn(
                          "py-3 px-4 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all",
                          formData.customer_type === 'business' ? "bg-brand-neon border-brand-neon text-brand-bg" : "bg-brand-input border-brand-input-border text-brand-muted"
                        )}
                      >
                        Business
                      </button>
                      <button
                        type="button"
                        onClick={() => updateForm({ customer_type: 'personal' })}
                        className={cn(
                          "py-3 px-4 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all",
                          formData.customer_type === 'personal' ? "bg-brand-neon border-brand-neon text-brand-bg" : "bg-brand-input border-brand-input-border text-brand-muted"
                        )}
                      >
                        Personal
                      </button>
                    </div>

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

                    {formData.customer_type === 'business' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-3">Company Name (Optional)</label>
                          <input
                            type="text"
                            placeholder="Your Company"
                            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-4 px-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors text-sm"
                            value={formData.company_name}
                            onChange={e => updateForm({ company_name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-3">Corporate ID / Ref Code (If Account Holder)</label>
                          <div className="relative">
                            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-neon" />
                            <input
                              type="text"
                              placeholder="e.g. NOK-9241"
                              className="w-full bg-brand-input border border-brand-neon/20 rounded-xl py-4 pl-12 pr-4 text-brand-neon focus:outline-none focus:border-brand-neon transition-colors text-sm font-mono placeholder:text-brand-neon/30"
                              value={formData.corporate_code || ''}
                              onChange={e => updateForm({ corporate_code: e.target.value.toUpperCase() })}
                            />
                          </div>
                        </div>
                      </div>
                    )}

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

                    <div className="space-y-4">
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

                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center transition-all",
                          formData.repeat_business ? "bg-brand-neon border-brand-neon" : "bg-brand-input border-brand-input-border group-hover:border-brand-neon/30"
                        )}>
                          {formData.repeat_business && <CheckCircle2 className="w-3 h-3 text-brand-bg" />}
                        </div>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={formData.repeat_business}
                          onChange={e => updateForm({ repeat_business: e.target.checked })}
                        />
                        <span className="text-xs text-brand-muted font-medium">Is this a repeat business need?</span>
                      </label>
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
                  <div className="space-y-6">
                    {/* Pickup */}
                    <div className="p-5 rounded-2xl border border-brand-input-border bg-brand-input/40 space-y-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-neon">📍 Pickup</p>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-2">Emirate</label>
                        <select
                          className="w-full bg-brand-input border border-brand-input-border rounded-xl py-3.5 px-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors appearance-none text-sm"
                          value={pickupEmirate}
                          onChange={e => updatePickupEmirate(e.target.value)}
                        >
                          {emirates.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-2">Specific Location</label>
                        <input
                          required
                          type="text"
                          placeholder="e.g. JLT Cluster A, Tower 1"
                          className="w-full bg-brand-input border border-brand-input-border rounded-xl py-3.5 px-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors text-sm"
                          value={formData.pickup_location}
                          onChange={e => updateForm({ pickup_location: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Delivery */}
                    <div className="p-5 rounded-2xl border border-brand-input-border bg-brand-input/40 space-y-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-blue">🏁 Delivery</p>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-2">Emirate</label>
                        <select
                          className="w-full bg-brand-input border border-brand-input-border rounded-xl py-3.5 px-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors appearance-none text-sm"
                          value={deliveryEmirate}
                          onChange={e => updateDeliveryEmirate(e.target.value)}
                        >
                          {emirates.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-2">Specific Location</label>
                        <input
                          required
                          type="text"
                          placeholder="e.g. Al Reem Island, Gate Tower"
                          className="w-full bg-brand-input border border-brand-input-border rounded-xl py-3.5 px-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors text-sm"
                          value={formData.delivery_location}
                          onChange={e => updateForm({ delivery_location: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="grid grid-cols-2 gap-4"
                >
                  {itemTypes.map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => updateForm({ item_type: type.id as any })}
                      className={cn(
                        "p-6 rounded-xl border transition-all text-left",
                        formData.item_type === type.id
                          ? "bg-brand-neon/5 border-brand-neon/30"
                          : "bg-white/[0.02] border-white/[0.05] hover:border-white/[0.1]"
                      )}
                    >
                      <type.icon className={cn("w-6 h-6 mb-4", formData.item_type === type.id ? "text-brand-neon" : "text-brand-muted")} />
                      <p className={cn("text-sm font-bold mb-1", formData.item_type === type.id ? "text-white" : "text-brand-muted")}>
                        {type.label}
                      </p>
                      <p className="text-[10px] text-brand-muted uppercase tracking-wider">{type.desc}</p>
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
                    <span>{step === 4 ? 'Get My Quote' : 'Continue'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            {step === 4 && (
              <p className="mt-6 text-[9px] text-brand-muted uppercase tracking-[0.2em] text-center font-bold">
                Same-Day AED {PRICE_TIER_SAME_DAY || 280} • Dedicated AED {PRICE_TIER_DEDICATED || 380}
              </p>
            )}
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
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsAppClick('quote_sidebar', {
                phone_number: formData.phone,
                first_name: formData.name
              })}
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