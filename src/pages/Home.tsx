import React from 'react';
import { motion } from 'motion/react';
import { MessageSquare, ArrowRight, Zap, Shield, MapPin, Clock, CheckCircle2, ChevronRight, Phone, X, Navigation, Package, Truck, Star, Building2, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WHATSAPP_NUMBER, PHONE_NUMBER, DISPLAY_PHONE, DEFAULT_WA_MESSAGE, BUSINESS_ACCOUNT_WA_MESSAGE, PRICE_HERO_BUSINESS, PRICE_HERO_DEDICATED, PRICE_TIER_STANDARD, PRICE_TIER_PRIORITY, PRICE_TIER_DEDICATED } from '../constants';
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
              <span>LIVE DISPATCH ACTIVE</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-medium leading-[0.85] tracking-tighter mb-6 text-brand-text">
              Urgent Courier <br />
              <span className="text-brand-neon italic">Dubai → Abu Dhabi</span> <br />
              in 90–120 Minutes
            </h1>
            
            <p className="text-xl md:text-2xl text-brand-muted font-medium mb-12 max-w-xl leading-snug">
              Dedicated driver. <span className="text-brand-neon underline decoration-brand-neon/30 underline-offset-4 font-black">No hubs.</span> Immediate dispatch.
            </p>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-12">
              <a
                href={waUrl}
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
  return (
    <section className="section-spacing bg-brand-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-20 max-w-3xl">
          <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tighter mb-8 text-brand-text">
            Same-Day Courier <br />
            <span className="text-brand-muted italic">Dubai to Abu Dhabi</span>
          </h2>
          <p className="text-xl text-brand-text font-bold leading-relaxed mb-6">
            We provide same-day courier services from Dubai to Abu Dhabi, including express document delivery, urgent parcel transport, and dedicated business logistics across the UAE.
          </p>
          <p className="text-lg text-brand-muted leading-relaxed">
            Nokael helps businesses move critical items between Dubai and Abu Dhabi without relying on slow, low-priority courier networks. Used for legal, corporate, and time-critical deliveries.
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
              <div className="flex flex-col mb-8">
                <span className="text-[10px] text-brand-muted uppercase tracking-widest mb-1">From</span>
                <span className="text-5xl font-display font-medium text-brand-neon leading-none tracking-tighter">{s.price}</span>
              </div>
              
              <ul className="space-y-6 mb-12 flex-1">
                <li className="flex items-center gap-4 text-xs font-bold text-brand-text uppercase tracking-widest p-3 rounded-lg bg-brand-neon/10 border border-brand-neon/20">
                  <Clock className="w-5 h-5 text-brand-neon" />
                  <span>90–120 Min Delivery</span>
                </li>
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

const BusinessAccounts = () => {
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(BUSINESS_ACCOUNT_WA_MESSAGE)}`;

  return (
    <section className="section-spacing bg-brand-bg relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="asymmetric-grid items-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-neon mb-4">For Repeat Business Needs</p>
            <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tighter mb-8 text-brand-text">
              Open a Business <br />
              <span className="text-brand-muted italic">Account With Nokael</span>
            </h2>
            <p className="text-lg text-brand-muted leading-relaxed mb-10 max-w-xl">
              If your team needs urgent deliveries more than once in a while, Nokael can support you as a business account. That means faster quoting, smoother repeat dispatch, and a more reliable way to move urgent items.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link
                to="/business-account"
                className="btn-primary w-full sm:w-auto px-10 py-5"
              >
                <Building2 className="w-5 h-5" />
                <span>Ask About Business Accounts</span>
              </Link>
              
              <a
                href={waUrl}
                onClick={() => trackWhatsAppClick('business_section')}
                className="btn-secondary w-full sm:w-auto px-10 py-5"
              >
                <MessageSquare className="w-5 h-5" />
                <span>Get Quote on WhatsApp</span>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: 'Faster Repeat Dispatch', desc: 'Request jobs faster with less back-and-forth once we know your routes.' },
              { title: 'Priority Handling', desc: 'Repeat business clients get faster response and smoother coordination.' },
              { title: 'Account-Level Support', desc: 'Better continuity and cleaner communication for recurring requests.' },
              { title: 'Built for Operators', desc: 'Ideal for legal, offices, suppliers, and time-sensitive teams.' }
            ].map((benefit, i) => (
              <div key={i} className="dispatch-card p-8">
                <h4 className="text-sm font-bold text-brand-text mb-3">{benefit.title}</h4>
                <p className="text-[10px] text-brand-muted uppercase tracking-widest leading-relaxed">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[600px] h-[600px] bg-brand-neon/5 blur-[120px] rounded-full pointer-events-none" />
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
