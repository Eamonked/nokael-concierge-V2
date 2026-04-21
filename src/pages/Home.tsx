import React from 'react';
import { motion } from 'motion/react';
import { MessageSquare, ArrowRight, Zap, Shield, MapPin, Clock, CheckCircle2, ChevronRight, Phone, X, Navigation, Package, Truck, Star, Building2, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WHATSAPP_NUMBER, PHONE_NUMBER, DISPLAY_PHONE, DEFAULT_WA_MESSAGE, BUSINESS_ACCOUNT_WA_MESSAGE, PRICE_TIER_SAME_DAY, PRICE_TIER_DEDICATED } from '../constants';
import { trackWhatsAppClick, trackPhoneClick } from '../lib/analytics';
import { cn } from '../lib/utils';

const Hero = () => {
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_WA_MESSAGE)}`;

  return (
    <section className="relative min-h-screen flex items-start overflow-hidden bg-brand-bg">
      {/* Hero Background Image - Optimized for LCP */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&q=80&w=1920&fm=webp" 
          alt="Dubai to Abu Dhabi Highway" 
          width="1920"
          height="1080"
          fetchPriority="high"
          className="w-full h-full object-cover opacity-20 grayscale"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-bg/80 via-brand-bg to-brand-bg" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 relative z-10 w-full">
        <div className="asymmetric-grid items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center space-x-3 px-4 py-2 rounded-lg bg-brand-input border border-brand-input-border text-brand-neon text-[11px] uppercase tracking-[0.2em] font-bold mb-6">
              <div className="w-2 h-2 rounded-full bg-brand-neon animate-pulse" />
              <span>LIVE DISPATCH ACTIVE</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-medium leading-[0.85] tracking-tighter mb-6 text-brand-text">
              Urgent Courier <br />
              <span className="text-brand-neon italic">Dubai → Abu Dhabi</span> <br />
              in 90–120 Minutes
            </h1>
            
            <p className="text-xl md:text-2xl text-brand-muted font-medium mb-12 max-w-xl leading-snug">
              The courier UAE businesses call when it cannot be late. <br />
              Dedicated driver. <span className="text-brand-neon underline decoration-brand-neon/30 underline-offset-4 font-black">No hubs.</span> Immediate dispatch.
            </p>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-12">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick('hero')}
                className="btn-primary px-10 py-6 group scale-105 origin-left"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-6 h-6" />
                  <div className="text-left">
                    <span className="block text-[10px] font-black uppercase tracking-widest opacity-80">Urgent Pickup</span>
                    <span className="text-lg">Dispatch via WhatsApp</span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 ml-4 group-hover:translate-x-1 transition-transform" />
              </a>
              
              <a
                href={`tel:${PHONE_NUMBER}`}
                onClick={trackPhoneClick}
                className="btn-secondary px-10 py-6"
              >
                <Phone className="w-5 h-5" />
                <span>Call Now: {DISPLAY_PHONE}</span>
              </a>
            </div>

            <p className="text-[10px] text-brand-neon uppercase tracking-[0.2em] font-bold mb-12 flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3" />
              Fully Licensed UAE Courier Operator • Guaranteed Dispatch in 30 Mins
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 border-t border-brand-border pt-12">
              <div>
                <p className="text-[9px] uppercase tracking-widest text-brand-muted mb-2">Average Dispatch</p>
                <p className="text-lg font-display font-medium">2-5 Mins</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-brand-muted mb-2">Same-Day Courier</p>
                <p className="text-lg font-display font-medium">AED {PRICE_TIER_SAME_DAY}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-brand-muted mb-2">Dedicated Courier</p>
                <p className="text-lg font-display font-medium">AED {PRICE_TIER_DEDICATED}</p>
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

const Differentiators = () => {
  return (
    <section className="py-24 bg-brand-bg border-y border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-neon mb-4">The Distance of Speed</p>
          <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tighter text-brand-text">Why Nokael is Faster</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'No Warehouses', desc: 'Your item never sits in a sorting hub. We move it directly from pickup to destination.', icon: Navigation },
            { title: 'Direct Assignment', desc: 'One driver is assigned to your job only. No multi-drop delays or shared routes.', icon: User },
            { title: 'Immediate Dispatch', desc: 'Driver starts moving the second your request is confirmed on WhatsApp.', icon: Zap },
            { title: 'Point-to-Point', desc: 'Direct route from your location to the receiver. The fastest line between two points.', icon: ArrowRight }
          ].map((item, i) => (
            <div key={i} className="p-8 rounded-3xl bg-brand-input border border-brand-input-border hover:border-brand-neon/20 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-brand-neon/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <item.icon className="w-6 h-6 text-brand-neon" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-brand-text whitespace-nowrap">{item.title}</h3>
              <p className="text-xs text-brand-muted leading-relaxed font-medium uppercase tracking-widest">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const SupportingSection = () => {
  const items = [
    { title: 'Legal Documents', desc: 'Contracts, court filings, title deeds, NOC letters, legal tenders', icon: Navigation },
    { title: 'Business Parcels', desc: 'Product samples, branded materials, corporate documents', icon: Package },
    { title: 'Spare Parts', desc: 'Industrial components, machinery parts, technical equipment', icon: Zap },
    { title: 'Medical Items', desc: 'Non-hazardous samples, lab reports, medical paperwork', icon: Shield },
    { title: 'Financial Docs', desc: 'Cheques, bank documents, insurance and finance paperwork', icon: Building2 }
  ];

  return (
    <section className="section-spacing bg-brand-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-20 max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-neon mb-4">Service Scope</p>
          <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tighter mb-8 text-brand-text">
            What We Carry
          </h2>
          <p className="text-xl text-brand-muted leading-relaxed">
            Nokael handles high-priority items that require a dedicated driver and synchronous delivery. We do not use hubs or sorting centers.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <div key={i} className="dispatch-card h-full">
              <div className="w-10 h-10 rounded-xl bg-brand-input flex items-center justify-center mb-6">
                <item.icon className="w-5 h-5 text-brand-neon" />
              </div>
              <h3 className="text-lg font-bold mb-3 text-brand-text">{item.title}</h3>
              <p className="text-sm text-brand-muted leading-relaxed group-hover:text-brand-text transition-colors">
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
      label: 'MOST POPULAR',
      title: 'SAME-DAY',
      price: `AED ${PRICE_TIER_SAME_DAY}`,
      subtext: 'Dispatched within 2 hours',
      features: [
        'Subject to driver availability',
        '90–120 min Dubai → Abu Dhabi',
        'Dedicated driver — direct route, no stops',
        'Real-time WhatsApp updates',
        'Fully insured transit',
        'Pay on confirmation — no account needed'
      ],
      cta: 'Book Same-Day',
      highlight: true
    },
    {
      label: 'MAXIMUM CERTAINTY',
      title: 'DEDICATED',
      price: `AED ${PRICE_TIER_DEDICATED}`,
      subtext: 'Your exact time. Guaranteed.',
      features: [
        'Choose your exact pickup time',
        'Driver assigned before your run',
        'Priority over all same-day bookings',
        '90–120 min Dubai → Abu Dhabi',
        'Real-time WhatsApp updates',
        'Fully insured transit'
      ],
      cta: 'Book Dedicated'
    }
  ];

  return (
    <section className="section-spacing bg-brand-surface/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-neon mb-4">Choose Your Service</p>
          <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tighter text-brand-text">Service Pricing</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-12">
          {services.map((s, i) => (
            <div 
              key={i} 
              className={cn(
                "dispatch-card flex flex-col p-8 sm:p-12 relative overflow-hidden",
                s.highlight ? "border-brand-neon bg-brand-neon/5 ring-1 ring-brand-neon/20 shadow-[0_0_40px_rgba(57,255,20,0.1)]" : "bg-brand-surface border-brand-border"
              )}
            >
              {s.label && (
                <div className="absolute top-0 left-0 right-0 h-10 bg-brand-neon flex items-center justify-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-bg">{s.label}</span>
                </div>
              )}
              
              <div className="pt-6 mb-8 text-center">
                <h3 className="text-3xl font-display font-medium mb-4 text-brand-text tracking-tighter uppercase">{s.title}</h3>
                <div className="flex flex-col items-center">
                  <span className="text-5xl font-display font-medium text-brand-neon leading-none tracking-tighter mb-2">{s.price}</span>
                  <span className="text-xs text-brand-muted italic font-medium">{s.subtext}</span>
                </div>
              </div>

              <div className="h-px bg-brand-border w-full mb-10" />
              
              <ul className="space-y-5 mb-12 flex-1">
                {s.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-4 text-xs text-brand-muted font-medium uppercase tracking-wide">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-brand-neon shrink-0" />
                    <span className="leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick(`service_card_${s.title.toLowerCase()}`)}
                className={cn(
                  "w-full py-5 rounded-xl font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-2 transition-all",
                  s.highlight ? "bg-brand-neon text-brand-bg hover:opacity-90" : "bg-brand-input border border-brand-input-border text-brand-text hover:border-brand-neon/30 hover:bg-brand-neon/5"
                )}
              >
                <MessageSquare className="w-5 h-5" />
                <span>{s.cta}</span>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const BusinessAccounts = () => {
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(BUSINESS_ACCOUNT_WA_MESSAGE)}`;

  return (
    <section className="section-spacing bg-brand-bg relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="bg-brand-neon text-brand-bg rounded-3xl p-12 text-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-display font-medium tracking-tighter mb-6 uppercase">
              Running 5+ deliveries a month?
            </h2>
            <p className="text-lg font-medium mb-10 max-w-2xl mx-auto leading-relaxed">
              Ask about a Corporate Account — fixed pricing, monthly invoicing & priority dispatch.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/business-account"
                className="bg-brand-bg text-brand-neon px-12 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:opacity-90 transition-all flex items-center gap-3"
              >
                <Building2 className="w-5 h-5" />
                <span>Ask About Corporate Accounts</span>
              </Link>
            </div>
          </div>
          
          {/* Accent decoration */}
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.05)_100%)]" />
        </div>
      </div>
    </section>
  );
};

const CorridorStatus = () => {
  const corridors = [
    { name: 'DIFC', context: 'Legal & financial documents', status: 'Active' },
    { name: 'Downtown Dubai', context: 'Business & retail deliveries', status: 'Active' },
    { name: 'Jebel Ali', context: 'Industrial & spare parts', status: 'Active' },
    { name: 'ADGM', context: 'Corporate & regulatory documents', status: 'Active' },
    { name: 'Mussafah', context: 'Manufacturing & logistics', status: 'Active' },
    { name: 'Khalifa City', context: 'Residential & corporate', status: 'Active' },
  ];

  return (
    <section className="section-spacing bg-brand-surface/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-neon mb-4">Areas We Serve</p>
            <h2 className="text-3xl md:text-5xl font-display font-medium tracking-tighter text-brand-text">Dubai and Abu Dhabi Service Hubs</h2>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-brand-muted">
            <div className="w-2 h-2 rounded-full bg-brand-neon animate-pulse" />
            <span>Real-time availability</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {corridors.map((c, i) => (
            <div key={i} className="p-8 rounded-3xl bg-brand-input border border-brand-input-border hover:border-brand-neon/20 transition-all group overflow-hidden relative">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-neon">{c.status}</span>
                  <MapPin className="w-4 h-4 text-brand-muted group-hover:text-brand-neon transition-colors" />
                </div>
                <h3 className="text-2xl font-display font-medium text-brand-text mb-2 tracking-tight">{c.name}</h3>
                <p className="text-xs text-brand-muted uppercase tracking-widest font-bold">{c.context}</p>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-neon/5 blur-3xl -translate-y-16 translate-x-16 group-hover:translate-y-0 group-hover:translate-x-0 transition-transform duration-700" />
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
                src="https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&q=80&w=1000&fm=webp" 
                alt="UAE Logistics" 
                width="1000"
                height="1250"
                loading="lazy"
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
            target="_blank"
            rel="noopener noreferrer"
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

const TrustBar = () => {
  return (
    <div className="bg-brand-surface/30 border-y border-brand-border py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center md:justify-between items-center gap-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
          <div className="flex items-center gap-2 font-display font-bold text-xl italic tracking-tighter">
            <Shield className="w-5 h-5 text-brand-neon" />
            <span>LEGAL<span className="text-brand-neon">CORP</span></span>
          </div>
          <div className="flex items-center gap-2 font-display font-bold text-xl italic tracking-tighter">
            <Building2 className="w-5 h-5 text-brand-neon" />
            <span>DIFC<span className="text-brand-neon">LOGISTICS</span></span>
          </div>
          <div className="flex items-center gap-2 font-display font-bold text-xl italic tracking-tighter">
            <Zap className="w-5 h-5 text-brand-neon" />
            <span>ADGM<span className="text-brand-neon">EXPRESS</span></span>
          </div>
          <div className="flex items-center gap-2 font-display font-bold text-xl italic tracking-tighter">
            <Package className="w-5 h-5 text-brand-neon" />
            <span>SUPPLY<span className="text-brand-neon">CHAIN</span></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  return (
    <div className="bg-brand-bg">
      <Hero />
      <TrustBar />
      <Differentiators />
      <SupportingSection />
      <ServiceCards />
      <BusinessAccounts />
      <CorridorStatus />
      <TrustGrounded />
      <FinalAction />
    </div>
  );
}
