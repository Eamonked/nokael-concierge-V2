import React from 'react';
import { motion } from 'motion/react';
import { MessageSquare, ArrowRight, Zap, Shield, MapPin, Clock, CheckCircle2, ChevronRight, Phone, X, Navigation, Package, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WHATSAPP_NUMBER, PHONE_NUMBER } from '../constants';

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden highway-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 relative z-10">
        <div className="asymmetric-grid items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center space-x-3 px-4 py-2 rounded-lg bg-brand-input border border-brand-input-border text-brand-neon text-[11px] uppercase tracking-[0.2em] font-bold mb-10">
              <div className="w-2 h-2 rounded-full bg-brand-neon animate-pulse" />
              <span>Dispatch Network Active</span>
            </div>
            
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-display font-medium leading-[0.85] tracking-tighter mb-10 text-brand-text">
              Urgent <br />
              <span className="text-brand-neon italic">Dispatch</span> <br />
              UAE
            </h1>
            
            <p className="text-lg md:text-xl text-brand-muted font-medium mb-12 max-w-xl leading-relaxed">
              Need it in another emirate today? We assign a dedicated driver immediately. No warehouses. No sorting. Just direct pickup and delivery.
            </p>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-16">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                className="btn-primary"
              >
                <MessageSquare className="w-5 h-5" />
                <span>Send Pickup Location</span>
              </a>
              
              <Link
                to="/get-quote"
                className="btn-secondary"
              >
                <span>Request Dispatch</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="flex items-center gap-12 border-t border-brand-border pt-12">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-brand-muted mb-2">Typical Response</p>
                <p className="text-2xl font-display font-medium">2-5 Mins</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-brand-muted mb-2">Inter-Emirate</p>
                <p className="text-2xl font-display font-medium">Same Day</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="hidden lg:block relative"
          >
            <div className="dispatch-card relative z-10 rotate-2 translate-x-4">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Live Feed</span>
                <span className="text-[10px] font-bold text-brand-neon">07:42 AM</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-3 rounded-xl bg-brand-input border border-brand-input-border">
                  <div className="w-8 h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-brand-text">Driver Assigned</p>
                    <p className="text-[10px] text-brand-muted">Dubai ↔ Abu Dhabi Corridor</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-3 rounded-xl bg-brand-input border border-brand-input-border">
                  <div className="w-8 h-8 rounded-lg bg-brand-neon/10 flex items-center justify-center text-brand-neon">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-brand-text">Pickup Confirmed</p>
                    <p className="text-[10px] text-brand-muted">Urgent Documents • JLT, Dubai</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute inset-0 bg-brand-neon/5 blur-[100px] rounded-full" />
          </motion.div>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-brand-bg to-transparent" />
    </section>
  );
};

const OperationalReality = () => {
  return (
    <section className="section-spacing bg-brand-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-20 max-w-3xl">
          <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tighter mb-8 text-brand-text">
            We handle the pressure. <br />
            <span className="text-brand-muted italic">You handle your business.</span>
          </h2>
          <p className="text-lg text-brand-muted leading-relaxed">
            Nokael is built for operators, not browsers. When a contract is left behind or a spare part is needed on-site, we don't put it in a warehouse. We put it in a car and drive.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="dispatch-card">
            <div className="w-10 h-10 rounded-xl bg-brand-input flex items-center justify-center mb-6">
              <Truck className="w-5 h-5 text-brand-neon" />
            </div>
            <h3 className="text-lg font-bold mb-3 text-brand-text">Direct-to-Site</h3>
            <p className="text-sm text-brand-muted leading-relaxed">
              No sorting hubs. No handovers. The driver who picks up your item is the one who delivers it.
            </p>
          </div>
          
          <div className="dispatch-card md:translate-y-8">
            <div className="w-10 h-10 rounded-xl bg-brand-input flex items-center justify-center mb-6">
              <Navigation className="w-5 h-5 text-brand-blue" />
            </div>
            <h3 className="text-lg font-bold mb-3 text-brand-text">WhatsApp Tracking</h3>
            <p className="text-sm text-brand-muted leading-relaxed">
              We send you a live location pin on WhatsApp. You see exactly where your driver is on the E11.
            </p>
          </div>
          
          <div className="dispatch-card lg:translate-y-16">
            <div className="w-10 h-10 rounded-xl bg-brand-input flex items-center justify-center mb-6">
              <Shield className="w-5 h-5 text-brand-neon" />
            </div>
            <h3 className="text-lg font-bold mb-3 text-brand-text">Chain of Custody</h3>
            <p className="text-sm text-brand-muted leading-relaxed">
              High-value items, passports, and legal tenders are handled with strict 1-to-1 accountability.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

const CorridorStatus = () => {
  const corridors = [
    { from: 'Dubai', to: 'Abu Dhabi', status: 'Active', time: '90m' },
    { from: 'Abu Dhabi', to: 'Dubai', status: 'Active', time: '95m' },
    { from: 'Dubai', to: 'Sharjah', status: 'Active', time: '40m' },
    { from: 'Dubai', to: 'RAK', status: 'High Demand', time: '120m' },
  ];

  return (
    <section className="section-spacing bg-brand-surface/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-neon mb-4">Network Status</p>
            <h2 className="text-3xl md:text-5xl font-display font-medium tracking-tighter text-brand-text">Current Inter-Emirate Corridors</h2>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-brand-muted">
            <div className="w-2 h-2 rounded-full bg-brand-neon" />
            <span>Real-time availability</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {corridors.map((c, i) => (
            <div key={i} className="p-6 rounded-2xl bg-brand-input border border-brand-input-border hover:border-brand-neon/20 transition-all">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{c.status}</span>
                <Clock className="w-3 h-3 text-brand-muted" />
              </div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-lg font-bold text-brand-text">{c.from}</span>
                <ArrowRight className="w-4 h-4 text-brand-muted" />
                <span className="text-lg font-bold text-brand-text">{c.to}</span>
              </div>
              <p className="text-xs text-brand-muted">Est. Transit: {c.time}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const TrustGrounded = () => {
  return (
    <section className="section-spacing bg-brand-bg relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="asymmetric-grid items-center">
          <div className="order-2 lg:order-1">
            <div className="relative aspect-[4/5] rounded-3xl overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&q=80&w=1000" 
                alt="UAE Logistics" 
                className="w-full h-full object-cover grayscale opacity-40"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-bg via-transparent to-transparent" />
              <div className="absolute bottom-8 left-8 right-8 p-6 glass rounded-2xl">
                <p className="text-xs font-medium leading-relaxed italic">
                  "Used for urgent personal and business deliveries across UAE. Direct driver assignment, no third parties."
                </p>
              </div>
            </div>
          </div>
          
          <div className="order-1 lg:order-2">
            <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tighter mb-12 text-brand-text">
              Built for <br />
              <span className="text-brand-neon italic">Urgent Situations.</span>
            </h2>
            
            <div className="space-y-12">
              <div>
                <h4 className="text-lg font-bold mb-4 flex items-center gap-3 text-brand-text">
                  <div className="w-1 h-6 bg-brand-neon rounded-full" />
                  Emergency Items
                </h4>
                <p className="text-brand-muted leading-relaxed">
                  Left your passport in Dubai but flying from Abu Dhabi? We assign a driver to your door in 30 minutes.
                </p>
              </div>
              
              <div>
                <h4 className="text-lg font-bold mb-4 flex items-center gap-3 text-brand-text">
                  <div className="w-1 h-6 bg-brand-blue rounded-full" />
                  Business Tenders
                </h4>
                <p className="text-brand-muted leading-relaxed">
                  When a physical contract needs to be in a government office by 2 PM, we are the only reliable option.
                </p>
              </div>

              <div>
                <h4 className="text-lg font-bold mb-4 flex items-center gap-3 text-brand-text">
                  <div className="w-1 h-6 bg-brand-border rounded-full" />
                  Spare Parts
                </h4>
                <p className="text-brand-muted leading-relaxed">
                  Critical machinery down? We transport parts directly from supplier to site, anywhere in the UAE.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const FinalAction = () => {
  return (
    <section className="py-40 bg-brand-bg relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h2 className="text-6xl md:text-9xl font-display font-medium tracking-tighter mb-16 leading-[0.8] text-brand-text">
          Send it now. <br />
          <span className="text-brand-neon">We'll handle the rest.</span>
        </h2>
        
        <div className="flex flex-col md:flex-row items-center justify-center gap-6">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            className="btn-primary px-12 py-6 text-lg"
          >
            <MessageSquare className="w-6 h-6" />
            <span>WhatsApp Dispatch</span>
          </a>
          
          <a
            href={`tel:${PHONE_NUMBER}`}
            className="btn-secondary px-12 py-6 text-lg"
          >
            <Phone className="w-6 h-6" />
            <span>Call Dispatch</span>
          </a>
        </div>
        
        <p className="mt-16 text-[10px] uppercase tracking-[0.4em] text-brand-muted font-bold">
          Direct Driver Assignment • No Third Parties • Live GPS
        </p>
      </div>
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-brand-neon/5 blur-[180px] rounded-full pointer-events-none" />
    </section>
  );
};

export default function Home() {
  return (
    <div className="bg-brand-bg">
      <Hero />
      <OperationalReality />
      <CorridorStatus />
      <TrustGrounded />
      <FinalAction />
    </div>
  );
}
