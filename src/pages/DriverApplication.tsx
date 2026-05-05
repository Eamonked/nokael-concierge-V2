import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Phone, Mail, MapPin, Truck, Clock, CheckCircle2, Upload, FileText, AlertCircle, ArrowRight, Loader2, Calendar, Globe, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { submitDriverApplication, uploadDriverDocument, type Driver } from '../lib/supabase';
import { trackFormSubmission } from '../lib/analytics';

const DOCUMENT_TYPES = [
  { id: 'emirates_id', label: 'Emirates ID (Front & Back)', icon: FileText, description: 'High resolution scan or photo' },
  { id: 'license', label: 'Driving License', icon: FileText, description: 'Valid UAE driving license' },
  { id: 'registration', label: 'Vehicle Registration (Mulkiya)', icon: FileText, description: 'Current registration card' },
  { id: 'vehicle_photo', label: 'Vehicle Photo (Clear view)', icon: Truck, description: 'Show front and side profile' },
];

const DAYS_OF_WEEK = [
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' },
  { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
];

export default function DriverApplication() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [driverId, setDriverId] = React.useState<string | null>(null);
  
  // Availability structure
  const [selectedDays, setSelectedDays] = React.useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [startTime, setStartTime] = React.useState('08:00');
  const [endTime, setEndTime] = React.useState('20:00');

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

  // Re-calculate availability string whenever days or times change
  React.useEffect(() => {
    const daysStr = selectedDays.map(id => DAYS_OF_WEEK.find(d => d.id === id)?.label).join(', ');
    setFormData(prev => ({
      ...prev,
      availability_hours: `${daysStr} | ${startTime} - ${endTime}`
    }));
  }, [selectedDays, startTime, endTime]);

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

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || errData.error || 'Upload failed');
      }

      const result = await response.json();

      await uploadDriverDocument({
        driver_id: driverId,
        document_type: type as any,
        file_url: result.file_url,
        drive_file_id: result.drive_file_id,
      });

      setUploads(prev => ({ ...prev, [type]: { file, status: 'success' } }));
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploads(prev => ({ ...prev, [type]: { ...prev[type], status: 'error' } }));
      alert(`Upload failed: ${error.message}`);
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
            <h1 className="text-5xl md:text-7xl font-display font-medium tracking-tighter text-brand-text mb-6">
              Join our <span className="text-brand-neon italic">Elite Fleet.</span>
            </h1>
            <p className="text-lg text-brand-muted max-w-2xl mx-auto leading-relaxed">
              Experience the highest volume corridor logistics in the UAE. We manage the jobs, you manage the drive. Direct driver dispatch, zero hub delays.
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black">Full Name</label>
                    <div className="group relative">
                      <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
                      <input
                        required
                        type="text"
                        className="form-input pl-14 h-16 bg-brand-surface/50 border-brand-border/50"
                        placeholder="As per Emirates ID"
                        value={formData.full_name}
                        onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black">Email Address</label>
                    <div className="group relative">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
                      <input
                        required
                        type="email"
                        className="form-input pl-14 h-16 bg-brand-surface/50 border-brand-border/50"
                        placeholder="logistics@nokael.com"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black">Phone Number</label>
                    <div className="group relative">
                      <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
                      <input
                        required
                        type="tel"
                        className="form-input pl-14 h-16 bg-brand-surface/50 border-brand-border/50"
                        placeholder="+971"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black">WhatsApp Number</label>
                    <div className="group relative">
                      <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
                      <input
                        required
                        type="tel"
                        className="form-input pl-14 h-16 bg-brand-surface/50 border-brand-border/50"
                        placeholder="+971"
                        value={formData.whatsapp}
                        onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black">Base Location (Area/City)</label>
                    <div className="group relative">
                      <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
                      <input
                        required
                        type="text"
                        className="form-input pl-14 h-16 bg-brand-surface/50 border-brand-border/50"
                        placeholder="e.g. Al Barsha, Dubai"
                        value={formData.base_location}
                        onChange={e => setFormData({ ...formData, base_location: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black">Vehicle Category</label>
                    <div className="group relative">
                      <Truck className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
                      <select
                        className="form-input pl-14 h-16 bg-brand-surface/50 border-brand-border/50 appearance-none"
                        value={formData.vehicle_type}
                        onChange={e => setFormData({ ...formData, vehicle_type: e.target.value })}
                      >
                        <option>Sedan</option>
                        <option>Executive SUV</option>
                        <option>Panel Van</option>
                        <option>Motorcycle (License R)</option>
                        <option>3-Ton Pickup</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-brand-border/50 space-y-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-[0.3em] text-brand-text mb-1">Availability Window</h3>
                      <p className="text-[10px] text-brand-muted uppercase tracking-widest">Select your active dispatch days and hours</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            setSelectedDays(prev => 
                              prev.includes(day.id) ? prev.filter(d => d !== day.id) : [...prev, day.id]
                            );
                          }}
                          className={`w-10 h-10 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                            selectedDays.includes(day.id) 
                              ? "bg-brand-neon text-brand-bg border-brand-neon shadow-[0_4px_12px_rgba(57,255,20,0.3)]" 
                              : "bg-brand-surface text-brand-muted border-brand-border hover:border-brand-neon/50"
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black">Start Shift</label>
                      <div className="relative">
                        <Clock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                        <input 
                          type="time" 
                          className="form-input pl-14 h-16 bg-brand-surface/50 border-brand-border/50"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black">End Shift</label>
                      <div className="relative">
                        <Clock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                        <input 
                          type="time" 
                          className="form-input pl-14 h-16 bg-brand-surface/50 border-brand-border/50"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-brand-neon/5 border border-brand-neon/10 rounded-2xl p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-brand-bg">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-brand-text mb-1">Inter-Emirate Dispatch</h4>
                    <p className="text-[10px] text-brand-muted uppercase tracking-widest">Are you comfortable driving between Dubai, Abu Dhabi, and Northern Emirates?</p>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    {['Yes', 'No'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFormData({ ...formData, inter_emirate_yes_no: opt === 'Yes' })}
                        className={`px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          (formData.inter_emirate_yes_no && opt === 'Yes') || (!formData.inter_emirate_yes_no && opt === 'No')
                            ? "bg-brand-neon text-brand-bg shadow-[0_0_15px_rgba(57,255,20,0.2)]"
                            : "bg-brand-surface text-brand-muted border border-brand-border"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
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
                    <div key={doc.id} className="dispatch-card p-6 border-brand-border/30 hover:border-brand-neon/50 transition-all duration-300 bg-brand-surface/20">
                      <div className="flex items-start justify-between mb-6">
                        <div className="w-12 h-12 rounded-xl bg-brand-neon/10 flex items-center justify-center text-brand-neon">
                          <doc.icon className="w-6 h-6" />
                        </div>
                        <div className="flex items-center gap-2">
                          {uploads[doc.id].status === 'success' && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-brand-neon/10 text-brand-neon rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              <span className="text-[8px] font-black uppercase tracking-widest">Verified</span>
                            </div>
                          )}
                          {uploads[doc.id].status === 'error' && (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      </div>
                      <h4 className="text-[10px] font-black text-brand-text uppercase tracking-[0.3em] mb-1">{doc.label}</h4>
                      <p className="text-[9px] text-brand-muted uppercase tracking-widest mb-6">{(doc as any).description}</p>
                      
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
                    onClick={() => {
                      const message = encodeURIComponent(`Hi Nokael, I've just submitted my driver application (Name: ${formData.full_name}).`);
                      navigate(`/thank-you?wa=${message}`, { 
                        state: { 
                          userData: {
                            email: formData.email,
                            phone_number: formData.phone,
                            first_name: formData.full_name,
                          } 
                        } 
                      });
                    }}
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
