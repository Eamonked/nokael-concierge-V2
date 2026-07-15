import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, User, Phone, Mail, MapPin, Package, BarChart3, Zap, CheckCircle2, ArrowRight, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { submitBusinessInquiry, type BusinessInquiry } from '../lib/supabase';
import { captureUTMs, getStoredUTMs } from '../lib/analytics';
import { WHATSAPP_NUMBER, BUSINESS_ACCOUNT_WA_MESSAGE } from '../constants';
import { trackWhatsAppClick, trackFormSubmission } from '../lib/analytics';
import { cn } from '../lib/utils';

export default function BusinessAccountInquiry() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [formData, setFormData] = React.useState<Partial<BusinessInquiry>>({
    invoicing_required: false
  });

  const nextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const prevStep = () => setStep(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const utms = getStoredUTMs();
      await submitBusinessInquiry({
        ...formData,
        ...utms
      } as BusinessInquiry);
      
      setIsSuccess(true);
      const message = encodeURIComponent(BUSINESS_ACCOUNT_WA_MESSAGE);
      setTimeout(() => navigate(`/thank-you?wa=${message}`, { 
        state: { 
          userData: {
            email: formData.email,
            phone_number: formData.phone_whatsapp,
            first_name: formData.contact_person,
          } 
        } 
      }), 2000);
    } catch (error) {
      console.error('Error submitting inquiry:', error);
      alert('There was an error submitting your inquiry. Please try again or contact us via WhatsApp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(BUSINESS_ACCOUNT_WA_MESSAGE)}`;

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-brand-neon/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="w-10 h-10 text-brand-neon" />
          </div>
          <h1 className="text-4xl font-display font-medium text-brand-text mb-4">Inquiry Received</h1>
          <p className="text-brand-muted">Our business team will contact you shortly.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-brand-bg min-h-screen py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="asymmetric-grid items-start">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <div className="inline-flex items-center space-x-3 px-4 py-2 rounded-lg bg-brand-neon/10 border border-brand-neon/20 text-brand-neon text-[10px] uppercase tracking-[0.3em] font-bold mb-8">
                <Building2 className="w-3 h-3" />
                <span>Enterprise Logistics</span>
              </div>
              <h1 className="text-5xl md:text-8xl font-display font-medium tracking-tighter text-brand-text mb-6 leading-[0.85]">
                Open a Business <br />
                <span className="text-brand-neon italic">Account</span>
              </h1>
              <p className="text-xl text-brand-muted leading-relaxed max-w-xl font-medium">
                Consolidate your urgent dispatch. Dedicated drivers for law firms, medical suppliers, and high-frequency corporate teams.
              </p>
              <p className="text-xs text-brand-muted uppercase tracking-widest font-bold mt-4">
+                Custom account pricing based on monthly volume — no fixed rate card.
+              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
              {[
                { title: 'Zero Sorting Hubs', desc: 'Direct pickup to delivery. No warehouses.', icon: Zap },
                { title: 'Dedicated Fleet', icon: CheckCircle2 },
                { title: 'Priority Dispatch', icon: User },
                { title: 'Corporate Invoicing', icon: Building2 }
              ].map((benefit, i) => (
                <div key={i} className="dispatch-card p-6 group hover:border-brand-neon/30 transition-all">
                  <benefit.icon className="w-6 h-6 text-brand-neon mb-4 group-hover:scale-110 transition-transform" />
                  <h4 className="text-xs font-black uppercase tracking-widest text-brand-text italic mb-1">{benefit.title}</h4>
                  {benefit.desc && <p className="text-[10px] text-brand-muted uppercase tracking-wider font-bold">{benefit.desc}</p>}
                </div>
              ))}
            </div>

            <div className="p-10 bg-brand-surface border border-brand-border rounded-3xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <MessageSquare className="w-24 h-24 text-brand-neon" />
              </div>
              <p className="text-lg font-medium text-brand-text mb-8 relative z-10 leading-relaxed italic">
                "Nokael becomes your invisible logistics layer. No chaos, just confirmed delivery."
              </p>
              <a 
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick('business_account_inquiry', {
                  email: formData.email,
                  phone_number: formData.phone_whatsapp,
                  first_name: formData.contact_person
                })}
                className="inline-flex items-center gap-3 text-brand-neon text-xs font-bold uppercase tracking-[0.2em] group"
              >
                <span>Direct Dispatch Support</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="dispatch-card p-8 md:p-12 border-2 border-brand-border"
          >
            <div className="flex items-center justify-between mb-12 pb-6 border-b border-brand-border">
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-brand-text italic">
                Application <span className="text-brand-neon">Step {step}/2</span>
              </h2>
              <div className="flex gap-1.5">
                {[1, 2].map(i => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-8 h-1 rounded-full transition-all duration-500",
                      i <= step ? "bg-brand-neon shadow-[0_0_10px_rgba(154,255,10,0.5)]" : "bg-brand-border"
                    )} 
                  />
                ))}
              </div>
            </div>

            <form onSubmit={step === 1 ? nextStep : handleSubmit} className="space-y-10">
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="grid grid-cols-1 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black italic">Organization Details</label>
                        <div className="relative group">
                          <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
                          <input
                            required
                            type="text"
                            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-5 pl-14 pr-5 focus:outline-none focus:border-brand-neon/50 transition-all font-medium placeholder:text-brand-muted/30"
                            placeholder="e.g. Al Tamimi Legal"
                            value={formData.company_name || ''}
                            onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black italic">Account Manager</label>
                        <div className="relative group">
                          <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
                          <input
                            required
                            type="text"
                            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-5 pl-14 pr-5 focus:outline-none focus:border-brand-neon/50 transition-all font-medium placeholder:text-brand-muted/30"
                            placeholder="Your Name"
                            value={formData.contact_person || ''}
                            onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black italic">WhatsApp</label>
                        <div className="relative group">
                          <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
                          <input
                            required
                            type="tel"
                            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-5 pl-14 pr-5 focus:outline-none focus:border-brand-neon/50 transition-all font-medium placeholder:text-brand-muted/30"
                            placeholder="+971"
                            value={formData.phone_whatsapp || ''}
                            onChange={e => setFormData({ ...formData, phone_whatsapp: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black italic">Professional Email</label>
                        <div className="relative group">
                          <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
                          <input
                            required
                            type="email"
                            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-5 pl-14 pr-5 focus:outline-none focus:border-brand-neon/50 transition-all font-medium placeholder:text-brand-muted/30"
                            placeholder="name@firm.com"
                            value={formData.email || ''}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black italic">Primary Logistics Corridors</label>
                      <div className="relative group">
                        <MapPin className="absolute left-5 top-6 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
                        <textarea
                          required
                          className="w-full bg-brand-input border border-brand-input-border rounded-xl py-5 pl-14 pr-5 focus:outline-none focus:border-brand-neon/50 transition-all font-medium placeholder:text-brand-muted/30 min-h-[120px]"
                          placeholder="e.g. DIFC to ADGM, JAFZA to Khalifa City..."
                          value={formData.typical_routes || ''}
                          onChange={e => setFormData({ ...formData, typical_routes: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black italic">Service Type</label>
                        <div className="relative group">
                          <Package className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
                          <input
                            type="text"
                            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-5 pl-14 pr-5 focus:outline-none focus:border-brand-neon/50 transition-all font-medium placeholder:text-brand-muted/30"
                            placeholder="e.g. Legal Docs"
                            value={formData.item_types || ''}
                            onChange={e => setFormData({ ...formData, item_types: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black italic">Est. Frequency</label>
                        <div className="relative group">
                          <BarChart3 className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
                          <input
                            type="text"
                            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-5 pl-14 pr-5 focus:outline-none focus:border-brand-neon/50 transition-all font-medium placeholder:text-brand-muted/30"
                            placeholder="Jobs per month"
                            value={formData.estimated_monthly_volume || ''}
                            onChange={e => setFormData({ ...formData, estimated_monthly_volume: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <div 
                      className={cn(
                        "flex items-center gap-4 p-6 rounded-2xl border transition-all cursor-pointer group",
                        formData.invoicing_required ? "bg-brand-neon/5 border-brand-neon/30" : "bg-brand-input border-brand-input-border hover:border-brand-neon/20"
                      )}
                      onClick={() => setFormData({ ...formData, invoicing_required: !formData.invoicing_required })}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded border flex items-center justify-center transition-all",
                        formData.invoicing_required ? "bg-brand-neon border-brand-neon" : "bg-brand-bg border-brand-border"
                      )}>
                        {formData.invoicing_required && <CheckCircle2 className="w-4 h-4 text-brand-bg" />}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-text italic">Invoicing Required</p>
                        <p className="text-[9px] text-brand-muted uppercase tracking-wider font-bold">Standard 30-day corporate terms</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-4 pt-4 border-t border-brand-border">
                {step === 2 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="btn-secondary flex-1 py-5"
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-[2] py-5 group"
                >
                  <span className="flex items-center justify-center gap-3">
                    {isSubmitting ? 'Transmitting...' : step === 1 ? 'Configure Logistics' : 'Establish Account'}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </div>
              
              <p className="text-[9px] text-brand-muted uppercase tracking-[0.4em] text-center font-bold">
                Secure Enterprise Application Portal
              </p>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}