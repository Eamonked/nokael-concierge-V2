import React from 'react';
import { motion } from 'motion/react';
import { MapPin, Zap, MessageSquare, Phone, ArrowRight, Shield, Clock, CheckCircle2, Navigation, Truck, Star, User, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WHATSAPP_NUMBER, PHONE_NUMBER, DISPLAY_PHONE, PRICE_TIER_SAME_DAY } from '../constants';
import { trackWhatsAppClick, trackPhoneClick } from '../lib/analytics';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LandingProps {
  title: string;
  subtitle: string;
  city?: string;
  industry?: string;
  heroImg: string;
  content: string[];
}

export const LandingTemplate = ({ title, subtitle, city, industry, heroImg, content }: LandingProps) => {
  return (
    <div className="bg-brand-bg">
      {/* Hero */}
      <section className="relative min-h-[80vh] flex items-center overflow-hidden border-b border-brand-border">
        <div className="absolute inset-0 z-0">
          <img 
            src={heroImg} 
            alt={title} 
            className="w-full h-full object-cover opacity-30 grayscale"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-bg via-brand-bg/90 to-transparent" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-32">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl"
          >
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 mb-10 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted">
              <Link to="/" className="hover:text-brand-text transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <Link to="/services" className="hover:text-brand-text transition-colors">Services</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-brand-neon">{title.replace('.', '')}</span>
            </nav>

            <div className="flex flex-wrap items-center gap-4 mb-10">
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-lg bg-brand-input border border-brand-input-border text-brand-neon text-[10px] uppercase tracking-[0.3em] font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-neon animate-pulse" />
                <span>{city ? `Dispatch Sector: ${city}` : `Industry: ${industry}`}</span>
                <span className="opacity-40 ml-2">| Live Active</span>
              </div>
              
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-surface border border-brand-border">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} className="w-3 h-3 fill-brand-neon text-brand-neon" />
                  ))}
                </div>
                <span className="text-[10px] font-bold text-brand-text uppercase tracking-widest">4.9/5 (240+ Reviews)</span>
              </div>
            </div>
            
            <h1 className="text-5xl md:text-9xl font-display font-medium tracking-tighter mb-10 leading-[0.8] text-brand-text">
              {title}
            </h1>
            
            <p className="text-xl md:text-2xl text-brand-muted font-medium mb-12 max-w-2xl leading-relaxed">
              {subtitle} <br />
              <span className="text-brand-text italic mt-2 block">Dedicated driver. No sorting hubs. Direct delivery.</span>
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick(`landing_hero_${city || industry || 'unknown'}`)}
                className="btn-primary w-full sm:w-auto px-10 py-6 group scale-105 origin-left"
              >
                <div className="flex items-center gap-3 text-left">
                   <MessageSquare className="w-6 h-6" />
                   <div>
                     <span className="block text-[10px] font-black uppercase tracking-widest opacity-60">Instant Dispatch</span>
                     <span className="text-lg">WhatsApp Dispatch</span>
                   </div>
                </div>
                <ArrowRight className="w-5 h-5 ml-4 group-hover:translate-x-1 transition-transform" />
              </a>
              
              <a
                href={`tel:${PHONE_NUMBER}`}
                onClick={trackPhoneClick}
                className="btn-secondary w-full sm:w-auto px-10 py-6"
              >
                <Phone className="w-5 h-5" />
                <span>Call Center: {DISPLAY_PHONE}</span>
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-8 border-t border-brand-border pt-8">
              <div>
                <p className="text-[9px] uppercase tracking-widest text-brand-muted mb-1">Starting From</p>
                <p className="text-xl font-display font-medium text-brand-neon">AED {PRICE_TIER_SAME_DAY}</p>
              </div>
              <div className="w-px h-8 bg-brand-border hidden sm:block" />
              <div>
                <p className="text-[9px] uppercase tracking-widest text-brand-muted mb-1">Response Time</p>
                <p className="text-xl font-display font-medium text-brand-text">2-5 Mins</p>
              </div>
              <div className="w-px h-8 bg-brand-border hidden sm:block" />
              <div>
                <p className="text-[9px] uppercase tracking-widest text-brand-muted mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand-neon animate-pulse" />
                  <p className="text-xl font-display font-medium text-brand-text">Active</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust Bar */}
      <div className="bg-brand-surface/30 border-b border-brand-border py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center md:justify-between items-center gap-8 opacity-40 grayscale">
            <div className="flex items-center gap-2 font-display font-bold text-lg italic tracking-tighter">
              <Shield className="w-4 h-4 text-brand-neon" />
              <span>LEGAL<span className="text-brand-neon">CORP</span></span>
            </div>
            <div className="flex items-center gap-2 font-display font-bold text-lg italic tracking-tighter">
              <Zap className="w-4 h-4 text-brand-neon" />
              <span>DIFC<span className="text-brand-neon">LOGISTICS</span></span>
            </div>
            <div className="flex items-center gap-2 font-display font-bold text-lg italic tracking-tighter">
              <Navigation className="w-4 h-4 text-brand-neon" />
              <span>ADGM<span className="text-brand-neon">EXPRESS</span></span>
            </div>
            <div className="flex items-center gap-2 font-display font-bold text-lg italic tracking-tighter">
              <Truck className="w-4 h-4 text-brand-neon" />
              <span>SUPPLY<span className="text-brand-neon">CHAIN</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <section className="py-32 bg-brand-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="asymmetric-grid items-start">
            <div className="space-y-16">
              <div className="max-w-xl">
                <h2 className="text-3xl font-display font-medium tracking-tighter mb-8 text-brand-text">Operational Overview</h2>
                <div className="space-y-8 text-brand-muted leading-relaxed text-sm">
                  {content.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </div>

              <div className="bg-brand-surface border border-brand-border rounded-3xl p-8 sm:p-12">
                <h3 className="text-xl font-display font-medium tracking-tighter mb-8 text-brand-text">Service Level Agreement (SLA)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-brand-neon">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-widest">Guaranteed Dispatch</span>
                    </div>
                    <p className="text-sm text-brand-muted">Driver assigned within 5 minutes of confirmation. Immediate pickup within 30-60 minutes across major hubs.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-brand-neon">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-widest">Direct Point-to-Point</span>
                    </div>
                    <p className="text-sm text-brand-muted">No sorting hubs, no warehouses, no shared loads. Your item stays with one driver from pickup to dropoff.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-brand-neon">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-widest">Full Insurance</span>
                    </div>
                    <p className="text-sm text-brand-muted">Comprehensive transit insurance for all business documents and industrial spare parts up to AED 50,000.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-brand-neon">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-widest">Real-time Proof</span>
                    </div>
                    <p className="text-sm text-brand-muted">Instant proof of delivery (POD) sent via WhatsApp with recipient signature and timestamp.</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { title: 'Fast Dispatch', desc: 'Typically 30-60 min pickup', icon: Zap },
                  { title: 'Direct Route', desc: 'No warehouses or sorting', icon: Navigation },
                  { title: 'Secure Handling', desc: 'Chain of custody delivery', icon: Shield },
                  { title: '24/7 Response', desc: 'Emergency dispatch team', icon: Clock }
                ].map((item, i) => (
                  <div key={i} className="dispatch-card py-8">
                    <item.icon className="w-6 h-6 text-brand-neon mb-6" />
                    <h4 className="text-xs font-bold uppercase tracking-[0.2em] mb-3 text-brand-text">{item.title}</h4>
                    <p className="text-[10px] text-brand-muted uppercase tracking-widest leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* Social Proof / Testimonials */}
              <div className="pt-16 border-t border-brand-border">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-10 text-brand-muted">Client Feedback</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-3 h-3 fill-brand-neon text-brand-neon" />)}
                    </div>
                    <p className="text-sm font-medium italic text-brand-text leading-relaxed">
                      "The only service that actually delivers same-day between Dubai and Abu Dhabi without excuses. Driver was assigned in 5 minutes."
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-brand-muted">— Operations Manager, DIFC Firm</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-3 h-3 fill-brand-neon text-brand-neon" />)}
                    </div>
                    <p className="text-sm font-medium italic text-brand-text leading-relaxed">
                      "Used them for urgent spare parts delivery to a site in RAK. Saved us thousands in downtime. Highly recommended."
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-brand-muted">— Logistics Lead, Industrial Solutions</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-8 lg:mt-24">
              <div className="dispatch-card">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-10 text-brand-muted">Corridor Performance</h3>
                <div className="space-y-4">
                  {[
                    { from: city || 'Dubai', to: 'Abu Dhabi', time: '90-120 min' },
                    { from: city || 'Dubai', to: 'Sharjah', time: '45-60 min' },
                    { from: city || 'Dubai', to: 'Fujairah', time: '120-150 min' },
                    { from: city || 'Dubai', to: 'Ras Al Khaimah', time: '90-120 min' }
                  ].map((route, i) => (
                    <div key={i} className="flex items-center justify-between p-5 bg-brand-input border border-brand-input-border rounded-xl">
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-brand-text">{route.from}</span>
                        <ArrowRight className="w-3 h-3 text-brand-neon" />
                        <span className="text-xs font-bold text-brand-text">{route.to}</span>
                      </div>
                      <span className="text-[10px] font-bold text-brand-neon uppercase tracking-widest">{route.time}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-8 text-[9px] text-brand-muted uppercase tracking-[0.3em] text-center font-bold">
                  Live Corridor Data • Subject to Traffic
                </p>
              </div>
              
              <div className="p-10 bg-brand-neon rounded-3xl text-brand-bg">
                <h3 className="text-3xl font-display font-medium tracking-tighter mb-6 leading-tight">Need it Now?</h3>
                <p className="font-medium mb-10 leading-relaxed text-sm opacity-90">
                  Our dispatchers are standing by to assign a dedicated driver to your request. No waiting for the next truck.
                </p>
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackWhatsAppClick(`landing_card_${city || industry || 'unknown'}`)}
                  className="w-full py-5 bg-brand-bg text-brand-neon font-black rounded-2xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:scale-[1.02] transition-all shadow-xl mb-6"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>Instant Dispatch</span>
                </a>

                <div className="pt-6 border-t border-brand-bg/20">
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-4 opacity-70">Other Services</p>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { name: 'Document Delivery', path: '/document-delivery-uae' },
                      { name: 'Spare Parts', path: '/spare-parts-delivery-uae' },
                      { name: 'Dubai Dispatch', path: '/urgent-delivery-dubai' },
                      { name: 'Abu Dhabi Dispatch', path: '/urgent-delivery-abu-dhabi' }
                    ].filter(s => s.path !== window.location.pathname).slice(0, 2).map((s, i) => (
                      <Link 
                        key={i} 
                        to={s.path}
                        className="text-[10px] font-bold uppercase tracking-widest hover:underline flex items-center justify-between"
                      >
                        <span>{s.name}</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export const DubaiLanding = () => (
  <LandingTemplate 
    title="Dubai Dispatch."
    subtitle="Fast inter-emirate transport starting from Dubai. Pickup typically within 30–60 minutes for immediate dispatch to Abu Dhabi, Sharjah, and beyond."
    city="Dubai"
    heroImg="https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&q=80&w=1920"
    content={[
      "Dubai is the heart of UAE commerce, and when logistics fail, business stops. Nokael provides a direct-response dispatch system for companies and individuals in Dubai who need items moved to other emirates immediately.",
      "Our drivers are strategically positioned across Dubai—from Downtown and DIFC to Jebel Ali and Dubai Marina—to ensure rapid response times. We don't use sorting hubs; your item goes from the pickup point directly to the delivery destination.",
      "Whether it's a critical document for a government office in Abu Dhabi or a forgotten passport for a flight in Sharjah, our Dubai dispatch team is ready 24/7."
    ]}
  />
);

export const AbuDhabiLanding = () => (
  <LandingTemplate 
    title="Abu Dhabi Dispatch."
    subtitle="Premium inter-emirate logistics from the capital. Dedicated drivers for direct transport to Dubai and the Northern Emirates."
    city="Abu Dhabi"
    heroImg="https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&q=80&w=1920"
    content={[
      "Abu Dhabi requires a higher level of logistics precision. Nokael serves the capital's most demanding delivery needs, providing dedicated transport for government, corporate, and private clients.",
      "Our Abu Dhabi dispatch network covers the entire city, including Al Reem Island, Khalifa City, and the Industrial areas. We specialize in the Abu Dhabi ↔ Dubai corridor, offering the fastest possible transit times between the two major hubs.",
      "With Nokael, you get a dedicated driver who understands the urgency of your mission. No shared loads, no delays, just direct inter-emirate delivery."
    ]}
  />
);

export const DocumentLanding = () => (
  <LandingTemplate 
    title="Document & Legal."
    subtitle="Secure, hand-to-hand transport for sensitive documents, contracts, and legal tenders across all emirates."
    industry="Legal & Corporate"
    heroImg="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=1920"
    content={[
      "In the legal and corporate world, some documents are too important for standard courier services. Nokael provides a premium document dispatch service that prioritizes security and chain of custody.",
      "Our drivers handle your sensitive materials with the utmost care, providing hand-to-hand delivery from the sender directly to the recipient. We understand the critical nature of legal deadlines and government tender submissions.",
      "Every document delivery includes real-time tracking and immediate proof of delivery via WhatsApp, giving you total peace of mind for your most important assets."
    ]}
  />
);

export const SparePartsLanding = () => (
  <LandingTemplate 
    title="Spare Parts Logistics."
    subtitle="Emergency transport for critical machinery, automotive, and industrial parts. Direct from supplier to site."
    industry="Industrial & Automotive"
    heroImg="https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=1920"
    content={[
      "When machinery breaks down or a vehicle is off the road, every minute costs money. Nokael provides emergency spare parts logistics for the industrial and automotive sectors across the UAE.",
      "We specialize in the rapid transport of critical components that are too urgent for traditional freight. Our drivers can pick up directly from suppliers or warehouses and deliver straight to the site where the part is needed.",
      "From heavy industrial components to delicate electronic parts, our direct-response logistics system ensures your operations get back on track as quickly as possible."
    ]}
  />
);
