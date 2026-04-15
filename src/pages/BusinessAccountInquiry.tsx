import React from 'react';
import { motion } from 'motion/react';
import { Building2, User, Phone, Mail, MapPin, Package, BarChart3, Zap, CheckCircle2, ArrowRight, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { submitBusinessInquiry, type BusinessInquiry } from '../lib/supabase';
import { captureUTMs, getStoredUTMs } from '../lib/analytics';
import { WHATSAPP_NUMBER, BUSINESS_ACCOUNT_WA_MESSAGE } from '../constants';
import { trackWhatsAppClick } from '../lib/analytics';
import { cn } from '../lib/utils';

export default function BusinessAccountInquiry() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [formData, setFormData] = React.useState<Partial<BusinessInquiry>>({
    invoicing_required: false
  });

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
      setTimeout(() => navigate('/thank-you'), 2000);
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
                <span>For Repeat Business Needs</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-display font-medium tracking-tighter text-brand-text mb-6">
                Open a Business <br />
                <span className="text-brand-neon italic">Account</span>
              </h1>
              <p className="text-lg text-brand-muted leading-relaxed max-w-xl">
                If your team needs urgent deliveries more than once in a while, Nokael can support you as a business account for faster quoting and smoother repeat dispatch.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
              {[
                { title: 'Faster Repeat Dispatch', desc: 'Request jobs faster with less back-and-forth once we know your routes.', icon: Zap },
                { title: 'Priority Handling', desc: 'Get faster response and smoother coordination for urgent jobs.', icon: CheckCircle2 },
                { title: 'Account-Level Support', desc: 'Better continuity and cleaner communication for recurring requests.', icon: User },
                { title: 'Built for Operators', desc: 'Ideal for legal, offices, suppliers, and time-sensitive teams.', icon: Building2 }
              ].map((benefit, i) => (
                <div key={i} className="dispatch-card p-6">
                  <benefit.icon className="w-5 h-5 text-brand-neon mb-4" />
                  <h4 className="text-sm font-bold text-brand-text mb-2">{benefit.title}</h4>
                  <p className="text-[11px] text-brand-muted leading-relaxed uppercase tracking-wider">{benefit.desc}</p>
                </div>
              ))}
            </div>

            <div className="p-8 bg-brand-input border border-brand-input-border rounded-2xl">
              <p className="text-sm font-medium text-brand-text mb-6">
                "Nokael becomes your urgent dispatch layer, so your team does not need to manage last-minute courier chaos internally."
              </p>
              <a 
                href={waUrl}
                onClick={() => trackWhatsAppClick('business_account_inquiry')}
                className="inline-flex items-center gap-2 text-brand-neon text-[10px] font-bold uppercase tracking-widest hover:gap-3 transition-all"
              >
                <span>Talk on WhatsApp First</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="dispatch-card p-10 md:p-14"
          >
            <h2 className="text-2xl font-display font-medium text-brand-text mb-10">Account Application</h2>
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-widest text-brand-muted font-bold">Company Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                    <input
                      required
                      type="text"
                      className="form-input pl-12 h-14"
                      placeholder="e.g. DIFC Law Firm"
                      value={formData.company_name || ''}
                      onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-widest text-brand-muted font-bold">Contact Person</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                    <input
                      required
                      type="text"
                      className="form-input pl-12 h-14"
                      placeholder="Your Name"
                      value={formData.contact_person || ''}
                      onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-widest text-brand-muted font-bold">Phone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                    <input
                      required
                      type="tel"
                      className="form-input pl-12 h-14"
                      placeholder="+971"
                      value={formData.phone_whatsapp || ''}
                      onChange={e => setFormData({ ...formData, phone_whatsapp: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-widest text-brand-muted font-bold">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                    <input
                      required
                      type="email"
                      className="form-input pl-12 h-14"
                      placeholder="name@company.com"
                      value={formData.email || ''}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] uppercase tracking-widest text-brand-muted font-bold">Typical Routes</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 w-4 h-4 text-brand-muted" />
                  <textarea
                    className="form-input pl-12 min-h-[110px] py-4"
                    placeholder="e.g. Dubai to Abu Dhabi, Downtown to JAFZA"
                    value={formData.typical_routes || ''}
                    onChange={e => setFormData({ ...formData, typical_routes: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-widest text-brand-muted font-bold">Item Types</label>
                  <div className="relative">
                    <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                    <input
                      type="text"
                      className="form-input pl-12 h-14"
                      placeholder="e.g. Documents"
                      value={formData.item_types || ''}
                      onChange={e => setFormData({ ...formData, item_types: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-widest text-brand-muted font-bold">Monthly Volume</label>
                  <div className="relative">
                    <BarChart3 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                    <input
                      type="text"
                      className="form-input pl-12 h-14"
                      placeholder="e.g. 5-10 deliveries"
                      value={formData.estimated_monthly_volume || ''}
                      onChange={e => setFormData({ ...formData, estimated_monthly_volume: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-5 bg-brand-input rounded-xl border border-brand-input-border">
                <input
                  type="checkbox"
                  id="invoicing"
                  className="w-4 h-4 rounded border-brand-border bg-brand-bg text-brand-neon focus:ring-brand-neon"
                  checked={formData.invoicing_required || false}
                  onChange={e => setFormData({ ...formData, invoicing_required: e.target.checked })}
                />
                <label htmlFor="invoicing" className="text-xs font-bold text-brand-text uppercase tracking-widest cursor-pointer">
                  Invoicing Required?
                </label>
              </div>

              <button
                disabled={isSubmitting}
                className="btn-primary w-full py-6 text-sm"
              >
                {isSubmitting ? 'Processing Application...' : 'Submit Application'}
              </button>
              
              <p className="text-[9px] text-brand-muted uppercase tracking-[0.2em] text-center font-bold">
                By submitting, you agree to our Terms of Service.
              </p>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}