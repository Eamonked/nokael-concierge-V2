import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Phone, Mail, MapPin, Truck, Clock, CheckCircle2, Upload, FileText, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { submitDriverApplication, uploadDriverDocument, type Driver } from '../lib/supabase';

const DOCUMENT_TYPES = [
  { id: 'emirates_id', label: 'Emirates ID (Front & Back)', icon: FileText },
  { id: 'license', label: 'Driving License', icon: FileText },
  { id: 'registration', label: 'Vehicle Registration (Mulkiya)', icon: FileText },
  { id: 'vehicle_photo', label: 'Vehicle Photo (Clear view)', icon: Truck },
];

export default function DriverApplication() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [driverId, setDriverId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<Partial<Driver>>({
    full_name: '',
    phone: '',
    whatsapp: '',
    email: '',
    base_location: '',
    vehicle_type: 'Sedan',
    inter_emirate_yes_no: true,
    availability_hours: '',
  });

  const [uploads, setUploads] = React.useState<Record<string, { file: File | null, status: 'idle' | 'uploading' | 'success' | 'error' }>>({
    emirates_id: { file: null, status: 'idle' },
    license: { file: null, status: 'idle' },
    registration: { file: null, status: 'idle' },
    vehicle_photo: { file: null, status: 'idle' },
  });

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const driver = await submitDriverApplication(formData as Driver);
      setDriverId(driver.id!);
      setStep(2);
    } catch (error) {
      console.error('Error submitting application:', error);
      alert('Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (type: string, file: File) => {
    if (!driverId) return;

    setUploads(prev => ({ ...prev, [type]: { ...prev[type], status: 'uploading' } }));

    const uploadData = new FormData();
    uploadData.append('file', file);

    const apiKey = import.meta.env.VITE_NOKAEL_API_KEY;

    try {
      const response = await fetch('/api/upload-driver-doc', {
        method: 'POST',
        headers: {
          ...(apiKey ? { 'x-nokael-key': apiKey } : {}),
        },
        body: uploadData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const result = await response.json();

      await uploadDriverDocument({
        driver_id: driverId,
        document_type: type as any,
        file_url: result.file_url,
        drive_file_id: result.drive_file_id,
      });

      setUploads(prev => ({ ...prev, [type]: { file, status: 'success' } }));
    } catch (error) {
      console.error('Upload error:', error);
      setUploads(prev => ({ ...prev, [type]: { ...prev[type], status: 'error' } }));
    }
  };

  const allUploaded = Object.values(uploads).every(u => (u as any).status === 'success');

  return (
    <div className="bg-brand-bg min-h-screen py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="inline-flex items-center space-x-3 px-4 py-2 rounded-lg bg-brand-neon/10 border border-brand-neon/20 text-brand-neon text-[10px] uppercase tracking-[0.3em] font-bold mb-8">
              <Truck className="w-3 h-3" />
              <span>Join the Dispatch Network</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-display font-medium tracking-tighter text-brand-text mb-6">
              Become a <span className="text-brand-neon italic">Nokael Driver</span>
            </h1>
            <p className="text-lg text-brand-muted max-w-2xl mx-auto">
              We provide direct-response logistics across the UAE. Apply today to start receiving high-priority inter-emirate delivery jobs.
            </p>
          </motion.div>
        </div>

        <div className="dispatch-card p-8 md:p-12">
          <div className="flex items-center justify-between mb-12">
            {[
              { step: 1, label: 'Personal Info' },
              { step: 2, label: 'Documents' },
              { step: 3, label: 'Complete' }
            ].map((s, i) => (
              <div key={i} className="flex items-center flex-1 last:flex-none">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                  step >= s.step ? 'bg-brand-neon text-brand-bg' : 'bg-brand-surface border border-brand-border text-brand-muted'
                }`}>
                  {step > s.step ? <CheckCircle2 className="w-5 h-5" /> : s.step}
                </div>
                {i < 2 && (
                  <div className={`h-[1px] flex-grow mx-4 ${step > s.step ? 'bg-brand-neon' : 'bg-brand-border'}`} />
                )}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.form
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleFormSubmit}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-widest text-brand-muted font-bold">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                      <input
                        required
                        type="text"
                        className="form-input pl-12 h-14"
                        placeholder="As per Emirates ID"
                        value={formData.full_name}
                        onChange={e => setFormData({ ...formData, full_name: e.target.value })}
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
                        placeholder="name@example.com"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-widest text-brand-muted font-bold">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                      <input
                        required
                        type="tel"
                        className="form-input pl-12 h-14"
                        placeholder="+971"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-widest text-brand-muted font-bold">WhatsApp Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                      <input
                        required
                        type="tel"
                        className="form-input pl-12 h-14"
                        placeholder="+971"
                        value={formData.whatsapp}
                        onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-widest text-brand-muted font-bold">Base Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                      <input
                        required
                        type="text"
                        className="form-input pl-12 h-14"
                        placeholder="e.g. Al Barsha, Dubai"
                        value={formData.base_location}
                        onChange={e => setFormData({ ...formData, base_location: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-widest text-brand-muted font-bold">Vehicle Type</label>
                    <div className="relative">
                      <Truck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                      <select
                        className="form-input pl-12 h-14 appearance-none"
                        value={formData.vehicle_type}
                        onChange={e => setFormData({ ...formData, vehicle_type: e.target.value })}
                      >
                        <option>Sedan</option>
                        <option>SUV</option>
                        <option>Van</option>
                        <option>Motorcycle</option>
                        <option>Pickup Truck</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-widest text-brand-muted font-bold">Availability & Hours</label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-4 w-4 h-4 text-brand-muted" />
                    <textarea
                      required
                      className="form-input pl-12 min-h-[100px] py-4"
                      placeholder="e.g. Mon-Fri, 8 AM - 8 PM"
                      value={formData.availability_hours}
                      onChange={e => setFormData({ ...formData, availability_hours: e.target.value })}
                    />
                  </div>
                </div>

                <button
                  disabled={isSubmitting}
                  className="btn-primary w-full py-6 text-sm"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue to Document Upload'}
                </button>
              </motion.form>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {DOCUMENT_TYPES.map((doc) => (
                    <div key={doc.id} className="dispatch-card p-6 border-brand-border hover:border-brand-neon/50 transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded bg-brand-neon/10 flex items-center justify-center text-brand-neon">
                          <doc.icon className="w-5 h-5" />
                        </div>
                        {uploads[doc.id].status === 'success' && (
                          <CheckCircle2 className="w-5 h-5 text-brand-neon" />
                        )}
                        {uploads[doc.id].status === 'error' && (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-brand-text uppercase tracking-widest mb-2">{doc.label}</h4>
                      
                      <div className="relative">
                        <input
                          type="file"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(doc.id, file);
                          }}
                          disabled={uploads[doc.id].status === 'uploading'}
                        />
                        <div className={`flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-brand-border text-[10px] font-bold uppercase tracking-widest ${
                          uploads[doc.id].status === 'uploading' ? 'bg-brand-surface animate-pulse' : 'hover:bg-brand-surface'
                        }`}>
                          {uploads[doc.id].status === 'uploading' ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3 h-3" />
                              <span>{uploads[doc.id].status === 'success' ? 'Replace File' : 'Upload File'}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep(1)}
                    className="btn-secondary flex-1 py-6 text-sm"
                  >
                    Back
                  </button>
                  <button
                    disabled={!allUploaded}
                    onClick={() => setStep(3)}
                    className="btn-primary flex-1 py-6 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Complete Application
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <div className="w-24 h-24 bg-brand-neon/10 rounded-full flex items-center justify-center mx-auto mb-8">
                  <CheckCircle2 className="w-12 h-12 text-brand-neon" />
                </div>
                <h2 className="text-4xl font-display font-medium text-brand-text mb-4">Application Submitted</h2>
                <p className="text-brand-muted mb-12 max-w-md mx-auto">
                  Thank you for applying to join Nokael. Our team will review your documents and contact you within 24-48 hours for the next steps.
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="btn-primary px-12 py-5"
                >
                  Return Home
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
