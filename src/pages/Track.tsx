import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, Navigation, Clock, CheckCircle2, Loader2, MessageSquare, Phone, Zap, Truck } from 'lucide-react';
import { WHATSAPP_NUMBER } from '../constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Track() {
  const [trackingId, setTrackingId] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const [status, setStatus] = React.useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingId) return;
    
    setIsSearching(true);
    setStatus('searching');
    
    // Simulate search
    setTimeout(() => {
      setIsSearching(false);
      if (trackingId.toUpperCase() === 'NK-7721') {
        setStatus('found');
      } else {
        setStatus('not_found');
      }
    }, 1500);
  };

  return (
    <div className="bg-brand-bg min-h-[80vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="max-w-2xl mx-auto">
          <div className="mb-12 text-center">
            <h1 className="text-4xl md:text-6xl font-display font-medium tracking-tighter mb-6">Live GPS Tracking</h1>
            <p className="text-brand-muted text-sm max-w-md mx-auto leading-relaxed">
              Enter your dispatch ID to monitor your driver's real-time position on the corridor.
            </p>
          </div>

          <form onSubmit={handleSearch} className="mb-12">
            <div className="relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
              <input
                type="text"
                placeholder="Enter Dispatch ID (e.g. NK-7721)"
                className="w-full bg-brand-input border border-brand-input-border rounded-2xl py-6 pl-16 pr-6 text-xl text-brand-text focus:outline-none focus:border-brand-neon/50 transition-all font-display tracking-tight"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
              />
              <button
                type="submit"
                disabled={isSearching}
                className="absolute right-3 top-1/2 -translate-y-1/2 btn-primary py-3 px-8 text-[10px]"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Monitor'}
              </button>
            </div>
            <p className="mt-4 text-[10px] text-brand-muted uppercase tracking-widest font-bold text-center">
              Example: <button type="button" onClick={() => setTrackingId('NK-7721')} className="text-brand-neon hover:underline">NK-7721</button>
            </p>
          </form>

          <AnimatePresence mode="wait">
            {status === 'searching' && (
              <motion.div
                key="searching"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="dispatch-card text-center py-20"
              >
                <Loader2 className="w-12 h-12 text-brand-neon animate-spin mx-auto mb-6" />
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-brand-muted">Pinging Driver GPS...</p>
              </motion.div>
            )}

            {status === 'not_found' && (
              <motion.div
                key="not_found"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="dispatch-card border-red-500/20 text-center py-16"
              >
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-display font-medium mb-2">Dispatch ID Not Found</h3>
                <p className="text-brand-muted text-sm mb-8">We couldn't locate a live dispatch with that ID. Please check the number or contact dispatch.</p>
                <a href={`https://wa.me/${WHATSAPP_NUMBER}`} className="btn-secondary inline-flex py-3 px-8">
                  <MessageSquare className="w-4 h-4" />
                  <span>Contact Dispatch</span>
                </a>
              </motion.div>
            )}

            {status === 'found' && (
              <motion.div
                key="found"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="dispatch-card">
                  <div className="flex items-center justify-between mb-8 pb-6 border-b border-brand-border">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted mb-1">Dispatch ID</p>
                      <p className="text-xl font-display font-medium tracking-tight text-brand-text">NK-7721</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-neon mb-1">Status: In Transit</p>
                      <p className="text-xs text-brand-muted">E11 Highway • Dubai Corridor</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="relative pl-8 border-l border-brand-border space-y-12">
                      <div className="relative">
                        <div className="absolute -left-[37px] top-0 w-4 h-4 rounded-full bg-brand-neon border-4 border-brand-bg shadow-[0_0_15px_rgba(57,255,20,0.5)]" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-neon mb-1">Current Position</p>
                        <p className="text-sm font-medium mb-1 text-brand-text">E11 Highway, near Jebel Ali</p>
                        <p className="text-[10px] text-brand-muted uppercase tracking-widest">Last ping: 12 seconds ago</p>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-[37px] top-0 w-4 h-4 rounded-full bg-brand-input border-4 border-brand-bg" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-1">Next Stop</p>
                        <p className="text-sm font-medium mb-1 text-brand-text">Abu Dhabi, Al Reem Island</p>
                        <p className="text-[10px] text-brand-muted uppercase tracking-widest">Est. Arrival: 42 mins</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="dispatch-card py-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-4">Driver Assigned</p>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-brand-input flex items-center justify-center text-brand-muted">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-brand-text">Ahmed S.</p>
                        <p className="text-[10px] text-brand-muted uppercase tracking-widest">Toyota Hiace • White</p>
                      </div>
                    </div>
                  </div>
                  <div className="dispatch-card py-6 flex items-center justify-center gap-4">
                    <a href={`https://wa.me/${WHATSAPP_NUMBER}`} className="btn-primary flex-1 py-3 text-[10px]">
                      <MessageSquare className="w-4 h-4" />
                      <span>WhatsApp Driver</span>
                    </a>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
