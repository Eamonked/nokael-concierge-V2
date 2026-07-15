import React from 'react';
import { motion } from 'motion/react';
import { Shield, Zap, Navigation, Truck, Package, Clock, CheckCircle2, Building2, UserCheck, MessageSquare } from 'lucide-react';
import { WHATSAPP_NUMBER } from '../constants';
import { trackWhatsAppClick } from '../lib/analytics';

const StatCard = ({ label, value, subtext }: { label: string; value: string; subtext: string }) => (
  <div className="p-8 rounded-3xl bg-brand-input border border-brand-input-border">
    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-neon mb-4">{label}</p>
    <h3 className="text-4xl font-display font-medium text-brand-text mb-2 tracking-tighter">{value}</h3>
    <p className="text-xs text-brand-muted uppercase tracking-widest leading-relaxed">{subtext}</p>
  </div>
);

export default function About() {
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}`;

  return (
    <div className="bg-brand-bg">
      {/* Hero */}
      <section className="py-24 border-b border-brand-border overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="asymmetric-grid items-end"
          >
            <div className="max-w-3xl">
              <p className="text-brand-neon font-bold uppercase tracking-[0.4em] text-[10px] mb-6">The Nokael Mission</p>
              <h1 className="text-5xl md:text-8xl font-display font-medium tracking-tighter mb-10 leading-[0.85] text-brand-text">
                Logistics at the 
                <br />
                <span className="text-brand-neon italic">Speed of Trust.</span>
              </h1>
              <p className="text-xl md:text-2xl text-brand-muted font-medium leading-relaxed max-w-xl">
                We didn’t build a courier company. We built a direct-response dispatch system for items that simply cannot be late.
              </p>
            </div>
          </motion.div>
        </div>
        
        {/* Background Accent */}
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[800px] h-[800px] bg-brand-neon/5 blur-[150px] rounded-full pointer-events-none" />
      </section>

      {/* Stats */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
              label="Efficiency" 
              value="0 Hubs" 
              subtext="Your items go directly from pickup to destination. No warehouses, no sorting delays."
            />
            <StatCard 
              label="Response" 
              value="< 5 Mins" 
              subtext="Average time to assign a dedicated driver to your request once confirmed via WhatsApp."
            />
            <StatCard 
              label="Velocity" 
              value="90 Mins" 
              subtext="Target door-to-door transit time for core Dubai ↔ Abu Dhabi corridors."
            />
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="py-32 bg-brand-surface/20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-7">
              <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tighter mb-12 text-brand-text">
                The Anti-Courier <br />
                <span className="text-brand-muted">Operational Model.</span>
              </h2>
              
              <div className="space-y-12">
                <div className="flex gap-6">
                  <div className="w-12 h-12 rounded-2xl bg-brand-neon/10 flex items-center justify-center shrink-0">
                    <Navigation className="w-6 h-6 text-brand-neon" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-4 text-brand-text">Synchronous Logistics</h3>
                    <p className="text-brand-muted leading-relaxed max-w-lg">
                      Traditional couriers are asynchronous—packets sit in hubs waiting for the next truck. Nokael is synchronous. The moment we pick up, the driver is heading to your destination.
                    </p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="w-12 h-12 rounded-2xl bg-brand-blue/10 flex items-center justify-center shrink-0">
                    <Truck className="w-6 h-6 text-brand-blue" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-4 text-brand-text">Dedicated Capacity</h3>
                    <p className="text-brand-muted leading-relaxed max-w-lg">
                      Every "Urgent" booking gets a dedicated driver. They are not juggling 50 other deliveries. Their only mission is your item.
                    </p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="w-12 h-12 rounded-2xl bg-brand-input-border/20 flex items-center justify-center shrink-0">
                    <Shield className="w-6 h-6 text-brand-text" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-4 text-brand-text">Ironclad Accountability</h3>
                    <p className="text-brand-muted leading-relaxed max-w-lg">
                      We track every movement via GPS and provide real-time updates directly on WhatsApp. You have a direct line to the system handling your cargo.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="dispatch-card scale-105 p-10 bg-brand-bg relative z-10 overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-brand-neon mb-8">System Compliance</h3>
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-brand-input flex items-center justify-center text-brand-neon">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-widest text-brand-text">UAE Licensed Logistics Operator</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-brand-input flex items-center justify-center text-brand-neon">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-widest text-brand-text">Fully Insured Transit</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-brand-input flex items-center justify-center text-brand-neon">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-widest text-brand-text">Vetted Professional Drivers</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-brand-input flex items-center justify-center text-brand-neon">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-widest text-brand-text">24/7 Dispatch Control</span>
                    </div>
                  </div>
                  
                  <div className="mt-12 pt-12 border-t border-brand-border">
                    <p className="text-xs text-brand-muted italic leading-relaxed">
                      "Built for the legal firms, industrial sites, and business operators who value time as their most expensive asset."
                    </p>
                  </div>
                </div>
                
                {/* Decorative Pattern */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-neon/5 blur-[60px] rounded-full -translate-y-16 translate-x-16" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="py-24 bg-brand-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-display font-medium tracking-tighter mb-4 text-brand-text">Who Trusts Nokael?</h2>
            <p className="text-brand-muted uppercase tracking-widest text-[10px] font-bold">The most time-critical sectors in the UAE</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Legal & Finance', icon: Building2, desc: 'Original contracts and tenders for DIFC, ADGM, and government offices.' },
              { title: 'Industrial & Parts', icon: Package, desc: 'Aviation, machinery, and automotive parts required to restore operations.' },
              { title: 'Medical Logistics', icon: Shield, desc: 'Sensitive samples and time-critical medical supplies across emirates.' },
              { title: 'Personal Urgency', icon: Clock, desc: 'Emergency passports, forgotten keys, and high-value personal assets.' }
            ].map((industry, i) => (
              <div key={i} className="p-8 rounded-3xl bg-brand-input border border-brand-input-border text-center hover:border-brand-neon/20 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-brand-surface border border-brand-border flex items-center justify-center mx-auto mb-6 text-brand-neon">
                  <industry.icon className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-brand-text mb-3">{industry.title}</h3>
                <p className="text-[10px] text-brand-muted uppercase tracking-widest leading-relaxed">{industry.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-40 bg-brand-bg text-center relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <h2 className="text-6xl md:text-8xl font-display font-medium tracking-tighter mb-12 text-brand-text">Ready for Dispatch?</h2>
          <p className="text-xl text-brand-muted mb-16 max-w-2xl mx-auto font-medium">
            Join the network of businesses that never worry about delivery deadlines.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <a 
              href={waUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={() => trackWhatsAppClick('about_page_cta')}
              className="btn-primary px-12 py-6 text-lg"
            >
              <MessageSquare className="w-6 h-6" />
              <span>WhatsApp Dispatch</span>
            </a>
            <a 
              href="/get-quote"
              className="btn-secondary px-12 py-6 text-lg"
            >
              <span>Request Quote</span>
            </a>
          </div>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-brand-neon/5 blur-[180px] rounded-full pointer-events-none" />
      </section>
    </div>
  );
}
