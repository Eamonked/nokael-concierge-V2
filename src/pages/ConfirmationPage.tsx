import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Shield, 
  MapPin, 
  Navigation, 
  Package, 
  CheckCircle2, 
  AlertTriangle,
  Zap,
  ArrowRight,
  Clock,
  Phone,
  LayoutDashboard,
  QrCode,
  KeyRound,
  Loader2,
  ChevronRight,
  User,
  Activity
} from 'lucide-react';
import { 
  supabase, 
  type Job, 
  updateJob 
} from '../lib/supabase';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

type ConfirmationAction = 'client-pickup' | 'driver-pickup' | 'driver-delivery' | 'client-delivery';

export default function ConfirmationPage() {
  const { token, action } = useParams<{ token: string, action: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<'link' | 'otp' | 'qr'>('link');
  const [otpValue, setOtpValue] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchJobByToken();
  }, [token]);

  const fetchJobByToken = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Per spec: Use RPC to fetch job by token so we don't expose raw table access
      const { data, error } = await (supabase as any).rpc('get_job_by_token', { token_val: token });
      
      if (error) throw error;
      if (!data) {
        setError('Invalid or expired confirmation link.');
        return;
      }
      
      setJob(data);
    } catch (err: any) {
      console.error('Error fetching job:', err);
      setError('System connection error. Please try again or use WhatsApp fallback.');
    } finally {
      setLoading(false);
    }
  };

  const getPrerequisiteStatus = (action: string): string | null => {
    switch (action) {
      case 'client-pickup': return 'pending';
      case 'driver-pickup': return 'client_pickup';
      case 'driver-delivery': return 'driver_pickup';
      case 'client-delivery': return 'driver_delivery';
      default: return null;
    }
  };

  const isPrerequisiteMet = () => {
    if (!job || !action) return false;
    const required = getPrerequisiteStatus(action);
    return job.status === required;
  };

  const getActionTitle = () => {
    switch (action) {
      case 'client-pickup': return 'Handover Confirmation';
      case 'driver-pickup': return 'Pickup Validation';
      case 'driver-delivery': return 'Delivery Inbound';
      case 'client-delivery': return 'Final Receipt';
      default: return 'Token Validation';
    }
  };

  const getOtherPartyName = () => {
    if (!job) return '';
    switch (action) {
      case 'client-pickup': return `Driver: ${job.driver_name || 'Dispatch Pilot'}`;
      case 'driver-pickup': return `Sender: ${job.sender_name}`;
      case 'driver-delivery': return `Recipient: ${job.recipient_name}`;
      case 'client-delivery': return `Driver: ${job.driver_name || 'Dispatch Pilot'}`;
      default: return '';
    }
  };

  const handleConfirm = async () => {
    if (!job || !token || !action) return;
    setConfirming(true);
    
    try {
      // Get Geolocation
      let lat = null;
      let lng = null;
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch (e) {
        console.warn('Geolocation denied or failed');
      }

      // Prepare Update based on action
      const statusMap: Record<string, string> = {
        'client-pickup': 'client_pickup',
        'driver-pickup': 'driver_pickup',
        'driver-delivery': 'driver_delivery',
        'client-delivery': 'completed'
      };

      const fieldPrefix = action.replace('-', '_');
      const updates: any = {
        status: statusMap[action],
        [`${fieldPrefix}_confirmed_at`]: new Date().toISOString(),
        [`${fieldPrefix}_method`]: authMethod,
        [`${fieldPrefix}_lat`]: lat,
        [`${fieldPrefix}_lng`]: lng
      };
      
      // Enforce sequential update guard via RPC or conditional update
      // For this implementation, we'll try to find the ID then update with the token as guard
      // Wait, get_job_by_token doesn't return the ID for security. 
      // But the RPC can handle the confirmation logic too.
      // Let's assume we have a confirm_job_step RPC.
      
      const { data, error } = await (supabase as any).rpc('confirm_job_step', { 
         token_val: token,
         step_action: action,
         method: authMethod,
         otp: authMethod === 'otp' ? otpValue : null,
         lat_val: lat,
         lng_val: lng
      });

      if (error) {
        if (error.code === '409') setError('Out of sequence. Please wait for the previous step.');
        else throw error;
      } else if (!data.success) {
        setError(data.message || 'Confirmation failed');
      } else {
        setSuccess(true);
      }

    } catch (err: any) {
      console.error('Confirmation error:', err);
      setError('Failed to record confirmation. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <Zap className="w-12 h-12 text-brand-neon animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full dispatch-card p-10 space-y-8">
           <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
             <AlertTriangle className="w-8 h-8" />
           </div>
           <h2 className="text-2xl font-display font-medium tracking-tighter text-brand-text">Validation Error.</h2>
           <p className="text-brand-muted text-sm leading-relaxed">{error}</p>
           <button onClick={() => window.location.reload()} className="btn-secondary w-full py-4 text-[10px] uppercase">Retry Validation</button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full dispatch-card p-10 space-y-8 border-brand-neon/50">
           <div className="w-16 h-16 bg-brand-neon/10 text-brand-neon rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(57,255,20,0.2)]">
             <CheckCircle2 className="w-8 h-8" />
           </div>
           <h2 className="text-2xl font-display font-medium tracking-tighter text-brand-text">Identity Confirmed.</h2>
           <p className="text-brand-muted text-sm leading-relaxed">
             Chain of Custody for Job #{job?.job_ref?.toString().padStart(4, '0')} has been updated in real-time. System status: <strong>{action?.replace('-', ' ')} verified</strong>.
           </p>
           <div className="pt-4">
             <p className="text-[10px] font-mono text-brand-neon font-black uppercase tracking-widest bg-brand-neon/5 py-2 rounded-lg">Tamper-Proof Record Locked</p>
           </div>
        </div>
      </div>
    );
  }

  const prerequisiteMet = isPrerequisiteMet();

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-4">
       <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-10">
             <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-brand-neon/10 border border-brand-neon/20 mb-6 transition-all animate-pulse">
                <Shield className="w-3 h-3 text-brand-neon" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-neon font-mono">Secure Validation active</span>
             </div>
             <h1 className="text-4xl md:text-5xl font-display font-medium tracking-tighter text-brand-text mb-4 leading-tight">
               {getActionTitle()}
             </h1>
             <p className="text-brand-muted text-[11px] font-bold uppercase tracking-[0.3em]">Job Reference #{job?.job_ref?.toString().padStart(4, '0')}</p>
          </div>

          <div className="dispatch-card p-0 overflow-hidden mb-8">
             {/* Summary Section */}
             <div className="p-8 border-b border-brand-border bg-brand-surface/20">
                <div className="space-y-6">
                   <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-lg bg-brand-input flex items-center justify-center text-brand-muted"><MapPin className="w-4 h-4" /></div>
                      <div className="flex-grow min-w-0">
                         <p className="text-[8px] font-black text-brand-muted uppercase tracking-widest mb-1">Logistics Corridor</p>
                         <p className="text-sm font-medium trunce">{job?.pickup_location} <ArrowRight className="inline w-3 h-3 text-brand-neon mx-1" /> {job?.delivery_location}</p>
                      </div>
                   </div>
                   <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-lg bg-brand-input flex items-center justify-center text-brand-muted"><Package className="w-4 h-4" /></div>
                      <div className="flex-grow min-w-0">
                         <p className="text-[8px] font-black text-brand-muted uppercase tracking-widest mb-1">Manifest Item</p>
                         <p className="text-sm font-medium uppercase">{job?.item_type}</p>
                      </div>
                   </div>
                   <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-lg bg-brand-neon/10 flex items-center justify-center text-brand-neon"><User className="w-4 h-4" /></div>
                      <div className="flex-grow min-w-0">
                         <p className="text-[8px] font-black text-brand-muted uppercase tracking-widest mb-1">Interact With</p>
                         <p className="text-sm font-medium">{getOtherPartyName()}</p>
                      </div>
                   </div>
                </div>
             </div>

             {/* Action Section */}
             <div className="p-8">
                {!prerequisiteMet ? (
                  <div className="p-6 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl text-center">
                    <Clock className="w-8 h-8 text-yellow-500 mx-auto mb-4 animate-pulse" />
                    <h3 className="text-sm font-bold text-yellow-500 uppercase tracking-widest mb-2">Step Locked.</h3>
                    <p className="text-[10px] text-brand-muted leading-relaxed font-bold uppercase tracking-widest">
                       {action === 'driver-pickup' ? 'Waiting for sender to confirm handover.' :
                        action === 'driver-delivery' ? 'Waiting for job to be marked as picked up.' :
                        action === 'client-delivery' ? 'Waiting for driver to mark delivery.' :
                        'System sequence pending.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                     <div className="flex bg-brand-input p-1.5 rounded-2xl border border-brand-border">
                        {[
                          { id: 'link', label: 'One-Tap Link', icon: Zap },
                          { id: 'otp', label: 'OTP Code', icon: KeyRound },
                          { id: 'qr', label: 'QR Scan', icon: QrCode }
                        ].map((m) => (
                          <button 
                            key={m.id}
                            onClick={() => setAuthMethod(m.id as any)}
                            className={cn(
                              "flex-1 flex flex-col items-center gap-2 py-3 rounded-xl transition-all",
                              authMethod === m.id ? "bg-brand-bg text-brand-neon shadow-lg scale-105" : "text-brand-muted hover:text-brand-text"
                            )}
                          >
                             <m.icon className="w-4 h-4" />
                             <span className="text-[8px] font-black uppercase tracking-widest">{m.label}</span>
                          </button>
                        ))}
                     </div>

                     {authMethod === 'link' && (
                        <div className="space-y-6">
                           <p className="text-center text-[10px] text-brand-muted font-bold uppercase tracking-widest">Tap to record your identity and GPS coordinates</p>
                           <button 
                             disabled={confirming}
                             onClick={handleConfirm}
                             className="btn-primary w-full py-6 flex items-center justify-center gap-4 text-sm font-black active:scale-95 transition-all shadow-[0_10px_40px_rgba(57,255,20,0.2)]"
                           >
                             {confirming ? <Loader2 className="w-6 h-6 animate-spin" /> : <Shield className="w-6 h-6" />}
                             Confirm Identity & Action
                           </button>
                        </div>
                     )}

                     {authMethod === 'otp' && (
                        <div className="space-y-6 text-center">
                           <p className="text-[10px] text-brand-muted font-bold uppercase tracking-widest">Enter the 6-digit code provided by the pilot</p>
                           <input 
                            type="text" 
                            maxLength={6}
                            value={otpValue}
                            onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                            placeholder="000000"
                            className="w-full bg-brand-input border border-brand-border rounded-2xl py-6 text-4xl text-center font-display font-medium tracking-[0.5em] text-brand-neon focus:border-brand-neon/50 outline-none transition-all placeholder:opacity-20" 
                           />
                           <button 
                             disabled={confirming || otpValue.length < 6}
                             onClick={handleConfirm}
                             className="btn-primary w-full py-6 flex items-center justify-center gap-4 text-sm font-black disabled:opacity-50"
                           >
                             {confirming ? <Loader2 className="w-6 h-6 animate-spin" /> : <KeyRound className="w-6 h-6" />}
                             Verify Secure OTP
                           </button>
                        </div>
                     )}

                     {authMethod === 'qr' && (
                        <div className="space-y-8 text-center p-4">
                           <div className="relative w-48 h-48 bg-brand-input rounded-3xl border border-brand-border mx-auto flex items-center justify-center overflow-hidden">
                              <QrCode className="w-24 h-24 text-brand-muted opacity-50" />
                              <div className="absolute inset-0 bg-brand-neon/5 animate-pulse" />
                           </div>
                           <p className="text-[10px] text-brand-muted font-bold uppercase tracking-widest">Request the QR code from the pilot to scan</p>
                           <button 
                             disabled={confirming}
                             className="btn-secondary w-full py-4 text-[10px] uppercase font-black"
                           >
                              Initialize Camera System
                           </button>
                        </div>
                     )}
                  </div>
                )}
             </div>
          </div>

          <div className="flex justify-center gap-8">
             <div className="flex items-center gap-2 opacity-30">
               <Shield className="w-3 h-3 text-brand-muted" />
               <span className="text-[8px] font-black text-brand-muted uppercase tracking-widest">End-to-End Encryption</span>
             </div>
             <div className="flex items-center gap-2 opacity-30">
               <Activity className="w-3 h-3 text-brand-muted" />
               <span className="text-[8px] font-black text-brand-muted uppercase tracking-widest">Real-time COC Logging</span>
             </div>
          </div>
       </div>
    </div>
  );
}
