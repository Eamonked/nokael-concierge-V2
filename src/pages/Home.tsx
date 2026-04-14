import React from 'react';
import { motion } from 'motion/react';
import { MessageSquare, ArrowRight, Zap, Shield, MapPin, Clock, CheckCircle2, ChevronRight, Phone, X, Navigation, Package, Truck, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WHATSAPP_NUMBER, PHONE_NUMBER, DISPLAY_PHONE, DEFAULT_WA_MESSAGE, PRICE_HERO_BUSINESS, PRICE_HERO_DEDICATED, PRICE_TIER_STANDARD, PRICE_TIER_PRIORITY, PRICE_TIER_DEDICATED } from '../constants';
import { trackWhatsAppClick, trackPhoneClick } from '../lib/analytics';
import { cn } from '../lib/utils';

const Hero = () => {
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_WA_MESSAGE)}`;

  return (
    <section className="relative min-h-screen flex items-start overflow-hidden highway-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 relative z-10">
        <div className="asymmetric-grid items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center space-x-3 px-4 py-2 rounded-lg bg-brand-input border border-brand-input-border text-brand-neon text-[11px] uppercase tracking-[0.2em] font-bold mb-6">
              <div className="w-2 h-2 rounded-full bg-brand-neon animate-pulse" />
              <span>Business-Only Urgent Courier</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-medium leading-[0.85] tracking-tighter mb-6 text-brand-text">
              Dedicated Business <br />
              <span className="text-brand-neon italic">Courier</span> <br />
              for Fast Inter-Emirate Deliveries
            </h1>
            
            <p className="text-lg md:text-xl text-brand-muted font-medium mb-6 max-w-xl leading-relaxed">
              Same-day, express, and dedicated courier service for time-critical documents, parcels, tenders, spare parts, and sensitive business items.
            </p>

            <p className="text-sm text-brand-neon font-bold uppercase tracking-widest mb-12">
              Direct driver assignment. No warehouses. No sorting hubs. Fast quote on WhatsApp.
            </p>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6">
              <a
                href={waUrl}
                onClick={() => trackWhatsAppClick('hero')}
                className="btn-primary px-10 py-5"
              >
                <MessageSquare className="w-5 h-5" />
                <span>Get Quote on WhatsApp</span>
              </a>
              
              <a
                href={`tel:${PHONE_NUMBER}`}
                onClick={trackPhoneClick}
                className="btn-secondary px-10 py-5"
              >
                <Phone className="w-5 h-5" />
                <span>Call Dispatch</span>
              </a>
            </div>

            <p className="text-[10px] text-brand-muted uppercase tracking-[0.2em] font-bold mb-12">
              Driver assigned immediately after confirmation
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 border-t border-brand-border pt-12">
              <div>
                <p className="text-[9px] uppercase tracking-widest text-brand-muted mb-2">Average Dispatch</p>
                <p className="text-lg font-display font-medium">2-5 Mins</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-brand-muted mb-2">Business Delivery</p>
                <p className="text-lg font-display font-medium">From AED {PRICE_TIER_STANDARD}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-brand-muted mb-2">Dedicated Courier</p>
                <p className="text-lg font-display font-medium">From AED {PRICE_TIER_DEDICATED}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-brand-muted mb-2">Tracking</p>
                <p className="text-lg font-display font-medium">Real-time WhatsApp Updates</p>
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
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Live Dispatch Feed</span>
                <span className="text-[10px] font-bold text-brand-neon">ACTIVE</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-3 rounded-xl bg-brand-input border border-brand-input-border">
                  <div className="w-8 h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-brand-text">Direct Assignment</p>
                    <p className="text-[10px] text-brand-muted">Dubai ↔ Abu Dhabi Corridor</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-3 rounded-xl bg-brand-input border border-brand-input-border">
                  <div className="w-8 h-8 rounded-lg bg-brand-neon/10 flex items-center justify-center text-brand-neon">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-brand-text">No Sorting Hubs</p>
                    <p className="text-[10px] text-brand-muted">Point-to-Point Delivery</p>
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

const SupportingSection = () => {
  return (
    <section className="section-spacing bg-brand-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-20 max-w-3xl">
          <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tighter mb-8 text-brand-text">
            Built for businesses that <br />
            <span className="text-brand-muted italic">cannot afford logistics delays.</span>
          </h2>
          <p className="text-lg text-brand-muted leading-relaxed">
            Nokael helps businesses move critical items between Dubai and Abu Dhabi without relying on slow, low-priority courier networks.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title: 'Urgent Documents', desc: 'Legal tenders, contracts, and sensitive business files.', icon: Navigation },
            { title: 'Office Parcels', desc: 'Sensitive items and high-priority business packages.', icon: Package },
            { title: 'Spare Parts', desc: 'Business-critical machinery and automotive parts.', icon: Zap },
            { title: 'Direct Assignment', desc: 'Dedicated drivers for high-priority jobs only.', icon: Truck }
          ].map((item, i) => (
            <div key={i} className="dispatch-card">
              <div className="w-10 h-10 rounded-xl bg-brand-input flex items-center justify-center mb-6">
                <item.icon className="w-5 h-5 text-brand-neon" />
              </div>
              <h3 className="text-lg font-bold mb-3 text-brand-text">{item.title}</h3>
              <p className="text-sm text-brand-muted leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const ServiceCards = () => {
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_WA_MESSAGE)}`;

  const services = [
    {
      title: 'Standard Inter-Emirate Delivery',
      price: `AED ${PRICE_TIER_STANDARD}`,
      features: ['Same-day delivery', 'Business-to-business', 'WhatsApp tracking'],
      cta: 'Get Quote'
    },
    {
      title: 'Priority Express Dispatch',
      price: `AED ${PRICE_TIER_PRIORITY}`,
      features: ['Fast-track pickup', 'Direct route delivery', 'Priority dispatch'],
      cta: 'Fast-Track Now',
      highlight: true
    },
    {
      title: 'Dedicated Critical Courier',
      price: `AED ${PRICE_TIER_DEDICATED}`,
      features: ['Exclusive driver', 'No shared loads', 'Immediate assignment'],
      cta: 'Book Dedicated'
    }
  ];

  return (
    <section className="section-spacing bg-brand-surface/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-neon mb-4">Service Options</p>
          <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tighter text-brand-text">Operational Tiers</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {services.map((s, i) => (
            <div 
              key={i} 
              className={cn(
                "dispatch-card flex flex-col p-10",
                s.highlight ? "border-brand-neon/40 bg-brand-neon/5 scale-105 z-10" : ""
              )}
            >
              <h3 className="text-xl font-bold mb-2 text-brand-text leading-tight">{s.title}</h3>
              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-[10px] text-brand-muted uppercase tracking-widest">From</span>
                <span className="text-3xl font-display font-medium text-brand-neon">{s.price}</span>
              </div>
              
              <ul className="space-y-4 mb-12 flex-1">
                {s.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-3 text-xs text-brand-muted">
                    <CheckCircle2 className="w-4 h-4 text-brand-neon" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={waUrl}
                onClick={() => trackWhatsAppClick(`service_card_${i}`)}
                className={cn(
                  "w-full py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all",
                  s.highlight ? "bg-brand-neon text-brand-bg" : "bg-brand-input border border-brand-input-border text-brand-text hover:border-brand-neon/30"
                )}
              >
                <MessageSquare className="w-4 h-4" />
                <span>{s.cta}</span>
              </a>
            </div>
          ))}
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
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_WA_MESSAGE)}`;

  return (
    <section className="py-40 bg-brand-bg relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h2 className="text-6xl md:text-9xl font-display font-medium tracking-tighter mb-16 leading-[0.8] text-brand-text">
          Send it now. <br />
          <span className="text-brand-neon">We'll handle the rest.</span>
        </h2>
        
        <div className="flex flex-col md:flex-row items-center justify-center gap-6">
          <a
            href={waUrl}
            onClick={() => trackWhatsAppClick('final_cta')}
            className="btn-primary px-12 py-6 text-lg"
          >
            <MessageSquare className="w-6 h-6" />
            <span>WhatsApp Dispatch</span>
          </a>
          
          <a
            href={`tel:${PHONE_NUMBER}`}
            onClick={trackPhoneClick}
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
      <SupportingSection />
      <ServiceCards />
      <CorridorStatus />
      <TrustGrounded />
      <FinalAction />
    </div>
  );
}
