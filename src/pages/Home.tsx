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
      {/* Hero Background Image - Optimized for LCP and Mobile responsive */}
      <div className="absolute inset-0 z-0">
        <picture>
          <source 
            media="(max-width: 640px)" 
            srcSet="https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&q=60&w=640&fm=webp" 
          />
          <source 
            media="(max-width: 1024px)" 
            srcSet="https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&q=60&w=1024&fm=webp" 
          />
          <img 
            src="https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&q=40&w=1200&fm=webp" 
            alt="Dubai to Abu Dhabi Highway" 
            width="1200"
            height="675"
            fetchPriority="high"
            className="w-full h-full object-cover opacity-40"
            referrerPolicy="no-referrer"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-b from-brand-bg/60 via-brand-bg/85 to-brand-bg" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 relative z-10 w-full">
        <div className="asymmetric-grid items-center">
          <motion.div
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ 
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1] // Custom easing for more natural feel
            }}
          >
            <div className="inline-flex items-center space-x-3 px-4 py-2.5 rounded-full bg-brand-surface/80 backdrop-blur-sm border border-brand-neon/20 text-brand-neon text-[11px] uppercase tracking-wider font-bold mb-6 shadow-lg shadow-brand-neon/10">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-neon" />
              <span>Drivers on corridor now</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-medium leading-[1.1] tracking-[-0.02em] mb-6 text-brand-text">
              Urgent Logistics<br />
              <span className="text-brand-neon font-normal">Dubai → Abu Dhabi</span><br />
              <span className="text-brand-muted text-3xl md:text-5xl lg:text-6xl font-normal">in 90–120 Minutes</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-brand-muted font-normal mb-12 max-w-xl leading-relaxed">
              One driver. Your item. Straight there.<br />
              No sorting hubs, no shared loads, no waiting.
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

            <div className="flex flex-wrap items-center gap-4 mb-12">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-neon/10 border border-brand-neon/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-neon" />
                <span className="text-[11px] font-semibold text-brand-neon">Licensed UAE Operator</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-surface border border-brand-border">
                <Clock className="w-3.5 h-3.5 text-brand-muted" />
                <span className="text-[11px] font-semibold text-brand-text">Dispatch in 30 min</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 border-t border-brand-border pt-12">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-brand-muted mb-3 font-semibold">Avg. Dispatch</p>
                <p className="text-3xl font-display font-semibold tracking-tight">2–5 min</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-brand-muted mb-3 font-semibold">Same-Day</p>
                <p className="text-3xl font-display font-semibold tracking-tight text-brand-neon">AED {PRICE_TIER_SAME_DAY}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-brand-muted mb-3 font-semibold">Dedicated</p>
                <p className="text-3xl font-display font-semibold tracking-tight">AED {PRICE_TIER_DEDICATED}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-brand-muted mb-3 font-semibold">Tracking</p>
                <p className="text-3xl font-display font-semibold tracking-tight">Live GPS</p>
              </div>
            </div>
          </motion.div>

          <div
            className="hidden lg:block relative"
          >
            <div className="dispatch-card relative z-10 rotate-2 translate-x-4">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Live Dispatch</span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-brand-neon">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-neon animate-pulse inline-block" />
                  ACTIVE
                </span>
              </div>
              <div className="space-y-3">
                {[
                  { time: '08:14', from: 'DIFC', to: 'ADGM', item: 'Legal tender', status: 'Delivered' },
                  { time: '09:32', from: 'JLT', to: 'Mussafah', item: 'Spare part', status: 'In transit' },
                  { time: '11:05', from: 'Downtown', to: 'Khalifa City', item: 'Document', status: 'Dispatched' },
                ].map((job, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-brand-input border border-brand-input-border">
                    <span className="text-[10px] font-mono text-brand-muted w-10 shrink-0">{job.time}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-brand-text truncate">{job.from} → {job.to}</p>
                      <p className="text-[10px] text-brand-muted">{job.item}</p>
                    </div>
                    <span className={cn(
                      'text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0',
                      job.status === 'Delivered' ? 'bg-brand-neon/10 text-brand-neon' :
                      job.status === 'In transit' ? 'bg-brand-blue/10 text-brand-blue' :
                      'bg-brand-border text-brand-muted'
                    )}>{job.status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute inset-0 bg-brand-neon/5 blur-[100px] rounded-full" />
          </div>
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-neon/10 border border-brand-neon/20 mb-6">
            <div className="w-1 h-1 rounded-full bg-brand-neon" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-neon">How it works</p>
          </div>
          <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tight text-brand-text">Why it gets there faster</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title: 'No warehouses', desc: 'Your item never sits waiting. The driver picks it up and goes — nothing in between.', icon: Navigation, accent: 'neon' },
            { title: 'One driver, one job', desc: 'They are not running 40 other drops. From the moment we confirm, your item is all they have.', icon: User, accent: 'blue' },
            { title: 'We move when you call', desc: 'Not in a batch. Not at the next scheduled run. The driver is assigned inside five minutes.', icon: Zap, accent: 'neon' },
            { title: 'Straight line, every time', desc: 'Dubai to Abu Dhabi is one road. We use it. No detours, no consolidation points.', icon: ArrowRight, accent: 'blue' }
          ].map((item, i) => (
            <div key={i} className="p-8 rounded-3xl bg-brand-input border border-brand-input-border hover:border-brand-neon/20 transition-all duration-300 group relative overflow-hidden">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300",
                item.accent === 'neon' ? 'bg-brand-neon/10' : 'bg-brand-blue/10'
              )}>
                <item.icon className={cn(
                  "w-6 h-6",
                  item.accent === 'neon' ? 'text-brand-neon' : 'text-brand-blue'
                )} />
              </div>
              <h3 className="text-xl font-bold mb-4 text-brand-text">{item.title}</h3>
              <p className="text-sm text-brand-muted leading-relaxed">{item.desc}</p>
              
              {/* Subtle gradient accent */}
              <div className={cn(
                "absolute -bottom-24 -right-24 w-48 h-48 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700",
                item.accent === 'neon' ? 'bg-brand-neon/10' : 'bg-brand-blue/10'
              )} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const SupportingSection = () => {
  const items = [
    { title: 'Legal documents', desc: 'Contracts, court filings, title deeds, NOC letters. Hand-delivered, chain of custody intact.', icon: Navigation },
    { title: 'Business parcels', desc: 'Product samples, tender packs, branded materials that need to look right on arrival.', icon: Package },
    { title: 'Spare parts', desc: 'The component that has a machine sitting idle. We get it there while the job still makes sense.', icon: Zap },
    { title: 'Medical items', desc: 'Non-hazardous samples, lab reports, time-sensitive medical paperwork.', icon: Shield },
    { title: 'Financial documents', desc: 'Cheques, bank letters, insurance and finance paperwork with hard submission deadlines.', icon: Building2 }
  ];

  return (
    <section className="section-spacing bg-brand-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-20 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-neon/10 border border-brand-neon/20 mb-6">
            <div className="w-1 h-1 rounded-full bg-brand-neon" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-neon">What we move</p>
          </div>
          <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tight mb-8 text-brand-text">
            If it can't be late,<br />we carry it.
          </h2>
          <p className="text-xl text-brand-muted leading-relaxed">
            Contracts, parts, samples, passports. Anything that has a hard deadline and cannot go through a sorting hub.
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
      subtext: 'Driver assigned within the hour',
      features: [
      '90–120 min Dubai ↔ Abu Dhabi',
      'One driver, your item only — no shared loads',
      'WhatsApp updates at pickup and delivery',
      'Fully insured transit',
      'Pay on confirmation — no account needed',
      'Best for: same-day documents, parts, parcels'
      ],
      cta: 'Book Same-Day',
      highlight: true
    },
    {
      label: 'MAXIMUM CERTAINTY',
      title: 'DEDICATED',
      price: `AED ${PRICE_TIER_DEDICATED}`,
      subtext: 'Your time, locked in advance.',
      features: [
      'Choose exact pickup time — we hold it',
      'Driver assigned the night before',
      'Priority over all same-day bookings',
      '90–120 min Dubai ↔ Abu Dhabi',
      'WhatsApp updates at every stage',
      'Best for: tenders, court filings, flights'
      ],
      cta: 'Book Dedicated'
    }
  ];

  return (
    <section className="section-spacing bg-brand-surface/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-neon/10 border border-brand-neon/20 mb-6">
            <div className="w-1 h-1 rounded-full bg-brand-neon" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-neon">Pricing</p>
          </div>
          <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tight text-brand-text">Simple. No surprises.</h2>
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
                  <li key={j} className="flex items-start gap-3 text-sm text-brand-muted">
                    <div className="mt-2 w-1.5 h-1.5 rounded-full bg-brand-neon shrink-0" />
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
        <div className="bg-gradient-to-br from-brand-neon to-brand-neon/90 text-brand-bg rounded-3xl p-12 md:p-16 text-center relative overflow-hidden shadow-2xl shadow-brand-neon/20">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-bg/20 backdrop-blur-sm border border-brand-bg/30 mb-8">
              <Building2 className="w-4 h-4" />
              <span className="text-[11px] font-black uppercase tracking-wider">For Businesses</span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-display font-semibold tracking-tight mb-6 leading-tight">
              Sending more than five runs a month?
            </h2>
            <p className="text-lg font-medium mb-10 max-w-2xl mx-auto leading-relaxed opacity-90">
              Corporate accounts get fixed rates, monthly invoicing, and a dedicated dispatcher who knows your routes.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/business-account"
                className="bg-brand-bg text-brand-neon px-10 py-5 rounded-2xl font-bold uppercase tracking-wider text-xs hover:bg-brand-bg/90 transition-all flex items-center gap-3 shadow-xl"
              >
                <Building2 className="w-5 h-5" />
                <span>Corporate Accounts</span>
              </Link>
            </div>
          </div>
          
          {/* Accent decoration */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,_rgba(255,255,255,0.1)_0%,_transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,_rgba(0,0,0,0.05)_0%,_transparent_50%)]" />
        </div>
      </div>
    </section>
  );
};

const CorridorStatus = () => {
  const corridors = [
    { name: 'DIFC', context: 'Law firms, banks, financial filings', status: 'Active' },
    { name: 'Downtown Dubai', context: 'Offices, retail, same-day commercial', status: 'Active' },
    { name: 'Jebel Ali', context: 'Industrial sites, spare parts, port runs', status: 'Active' },
    { name: 'ADGM', context: 'Regulatory docs, corporate filings', status: 'Active' },
    { name: 'Mussafah', context: 'Factories, workshops, equipment parts', status: 'Active' },
    { name: 'Khalifa City', context: 'Residential and business addresses', status: 'Active' },
  ];

  return (
    <section className="section-spacing bg-brand-surface/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-neon/10 border border-brand-neon/20 mb-6">
              <div className="w-1 h-1 rounded-full bg-brand-neon" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-neon">Coverage</p>
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-medium tracking-tight text-brand-text">Where our drivers are</h2>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-brand-neon/10 border border-brand-neon/20">
            <div className="w-2 h-2 rounded-full bg-brand-neon animate-pulse" />
            <span className="text-xs font-bold text-brand-neon uppercase tracking-wider">Real-time availability</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {corridors.map((c, i) => (
            <div key={i} className="p-8 rounded-3xl bg-gradient-to-br from-brand-input to-brand-surface border border-brand-input-border hover:border-brand-neon/30 transition-all duration-500 group overflow-hidden relative">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-neon/10 border border-brand-neon/20">
                    <div className="w-1 h-1 rounded-full bg-brand-neon" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand-neon">{c.status}</span>
                  </div>
                  <MapPin className="w-5 h-5 text-brand-muted group-hover:text-brand-neon transition-colors duration-300" />
                </div>
                <h3 className="text-2xl font-display font-semibold text-brand-text mb-3 tracking-tight">{c.name}</h3>
                <p className="text-xs text-brand-muted uppercase tracking-wider font-semibold leading-relaxed">{c.context}</p>
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
              The call you make<br />
              <span className="text-brand-neon italic">when nothing else will do.</span>
            </h2>
            
            <div className="space-y-12">
              <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-3 text-brand-text">
                  <div className="w-1 h-6 bg-brand-neon rounded-full" />
                  Personal emergencies
                </h3>
                <p className="text-brand-muted leading-relaxed">
                  Passport in Dubai, flight from Abu Dhabi in three hours. We have handled this exact situation. Call us.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-3 text-brand-text">
                  <div className="w-1 h-6 bg-brand-blue rounded-full" />
                  Tenders and filings
                </h3>
                <p className="text-brand-muted leading-relaxed">
                  Physical submission deadlines do not move. We have delivered contracts to government offices in Abu Dhabi before the 2 PM cutoff for clients who called at 10.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-3 text-brand-text">
                  <div className="w-1 h-6 bg-brand-border rounded-full" />
                  Machinery and parts
                </h3>
                <p className="text-brand-muted leading-relaxed">
                  A machine sitting idle costs more per hour than our delivery. We move the part from supplier to site so the job gets finished today.
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
    <section className="py-32 md:py-40 bg-brand-bg relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h2 className="text-5xl md:text-8xl lg:text-9xl font-display font-semibold tracking-tighter mb-12 leading-[0.9] text-brand-text">
          Send it now. <br />
          <span className="text-brand-neon font-medium">We'll handle the rest.</span>
        </h2>
        
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-16">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick('final_cta')}
            className="btn-primary px-12 py-6 text-lg relative group"
          >
            <MessageSquare className="w-6 h-6" />
            <span>WhatsApp Dispatch</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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
        
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-surface border border-brand-border">
            <CheckCircle2 className="w-4 h-4 text-brand-neon" />
            <span className="text-xs font-semibold text-brand-text">Licensed UAE operator</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-surface border border-brand-border">
            <Shield className="w-4 h-4 text-brand-blue" />
            <span className="text-xs font-semibold text-brand-text">Fully insured</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-surface border border-brand-border">
            <Zap className="w-4 h-4 text-brand-neon" />
            <span className="text-xs font-semibold text-brand-text">Direct driver assignment</span>
          </div>
        </div>
      </div>
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-brand-neon/5 blur-[180px] rounded-full pointer-events-none" />
    </section>
  );
};

const TrustBar = () => {
  const stats = [
    { value: '90 min', label: 'Dubai → Abu Dhabi', icon: Clock, color: 'neon' },
    { value: '30 min', label: 'Guaranteed dispatch', icon: Zap, color: 'neon' },
    { value: '100%', label: 'Dedicated driver, no hubs', icon: Shield, color: 'blue' },
    { value: '24/7', label: 'Dispatch available', icon: CheckCircle2, color: 'blue' },
  ];

  return (
    <div className="bg-brand-surface/40 border-y border-brand-border py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                s.color === 'neon' ? 'bg-brand-neon/10' : 'bg-brand-blue/10'
              )}>
                <s.icon className={cn(
                  "w-5 h-5",
                  s.color === 'neon' ? 'text-brand-neon' : 'text-brand-blue'
                )} />
              </div>
              <div>
                <p className="text-2xl font-display font-semibold text-brand-text leading-none mb-1.5 tracking-tight">{s.value}</p>
                <p className="text-[11px] text-brand-muted font-medium leading-snug">{s.label}</p>
              </div>
            </div>
          ))}
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
