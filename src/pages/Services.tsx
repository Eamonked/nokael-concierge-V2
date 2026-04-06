import React from 'react';
import { motion } from 'motion/react';
import { Shield, Zap, MapPin, Clock, CheckCircle2, ArrowRight, Package, Truck, Navigation, FileText, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WHATSAPP_NUMBER } from '../constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ServiceCard = ({ title, desc, icon: Icon, features, link, index }: any) => (
  <div className={cn(
    "dispatch-card group",
    index % 2 === 1 ? "md:mt-12" : ""
  )}>
    <div className="w-12 h-12 bg-brand-neon/10 rounded-lg flex items-center justify-center mb-8 group-hover:bg-brand-neon group-hover:text-brand-bg transition-all duration-500">
      <Icon className="w-6 h-6" />
    </div>
    <h3 className="text-2xl font-display font-medium tracking-tighter mb-4 text-brand-text">{title}</h3>
    <p className="text-brand-muted text-sm leading-relaxed mb-8">{desc}</p>
    <ul className="space-y-3 mb-10">
      {features.map((f: string, i: number) => (
        <li key={i} className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-brand-muted">
          <div className="w-1 h-1 rounded-full bg-brand-neon" />
          <span>{f}</span>
        </li>
      ))}
    </ul>
    <Link 
      to={link} 
      className="inline-flex items-center gap-2 text-brand-neon font-bold uppercase tracking-[0.2em] text-[10px] group-hover:gap-4 transition-all"
    >
      <span>Deploy Dispatch</span>
      <ArrowRight className="w-3 h-3" />
    </Link>
  </div>
);

export default function Services() {
  const services = [
    {
      title: 'Urgent Inter-Emirate',
      desc: 'Direct pickup and delivery between any two points in the UAE. No sorting hubs. No delays.',
      icon: Navigation,
      link: '/urgent-delivery-dubai',
      features: [
        '30-60 min pickup',
        'Direct corridor route',
        'Live WhatsApp tracking',
        'Dedicated driver'
      ]
    },
    {
      title: 'Document & Legal',
      desc: 'Secure transport for sensitive contracts, legal tenders, and original documents requiring chain of custody.',
      icon: FileText,
      link: '/document-delivery-uae',
      features: [
        'Hand-to-hand delivery',
        'Confidential handling',
        'Immediate delivery proof',
        'Tamper-evident'
      ]
    },
    {
      title: 'Spare Parts Logistics',
      desc: 'Emergency transport for critical machinery parts, automotive components, and industrial hardware.',
      icon: Settings,
      link: '/spare-parts-delivery-uae',
      features: [
        'Heavy handling',
        'Supplier-to-site',
        '24/7 emergency dispatch',
        'UAE-wide access'
      ]
    }
  ];

  return (
    <div className="bg-brand-bg">
      {/* Hero */}
      <section className="py-32 border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="asymmetric-grid items-end">
            <div className="max-w-2xl">
              <p className="text-brand-neon font-bold uppercase tracking-[0.4em] text-[10px] mb-6">Operational Capabilities</p>
              <h1 className="text-5xl md:text-8xl font-display font-medium tracking-tighter mb-8 leading-[0.85]">
                Direct Response<br />
                Logistics.
              </h1>
              <p className="text-lg text-brand-muted leading-relaxed max-w-lg">
                We provide specialized, high-speed transport solutions across the UAE. Built for speed, security, and direct accountability.
              </p>
            </div>
            <div className="hidden md:block pb-4">
              <div className="p-6 rounded-2xl bg-brand-input border border-brand-input-border max-w-xs">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">System Load</p>
                <div className="h-1 bg-brand-input-border rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-brand-neon w-[65%]" />
                </div>
                <p className="text-[10px] text-brand-muted uppercase tracking-widest">Typical Pickup: 42 mins</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {services.map((s, i) => <ServiceCard key={i} {...s} index={i} />)}
          </div>
        </div>
      </section>

      {/* Operational Depth */}
      <section className="py-32 bg-brand-surface/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-4">
              <h2 className="text-3xl font-display font-medium tracking-tighter mb-8">UAE Express Logistics Expertise</h2>
              <p className="text-brand-muted text-sm leading-relaxed mb-8">
                Traditional courier services rely on sorting hubs and shared vehicle loads. We bypass the traditional warehouse model entirely.
              </p>
              <div className="p-6 rounded-2xl border border-brand-neon/20 bg-brand-neon/5">
                <p className="text-xs italic text-brand-text leading-relaxed">
                  "One driver, one item, one direct route. We eliminate the friction of traditional logistics."
                </p>
              </div>
            </div>
            
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-brand-text uppercase tracking-[0.2em]">Urgent Delivery UAE</h3>
                <p className="text-xs text-brand-muted leading-relaxed">
                  Whether you are in Dubai, Abu Dhabi, or the Northern Emirates, our dispatch network is positioned to respond immediately. When you book a dispatch with Nokael, a dedicated driver is assigned to your specific job, ensuring the fastest possible transit time.
                </p>
              </div>
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-brand-text uppercase tracking-[0.2em]">Inter-Emirate Corridors</h3>
                <p className="text-xs text-brand-muted leading-relaxed">
                  Our routes cover the entire UAE, with a primary focus on the high-traffic corridors such as Dubai to Abu Dhabi, Sharjah to Dubai, and Ras Al Khaimah to Abu Dhabi. We understand that "urgent" means now, not tomorrow.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Final Action */}
      <section className="py-40 text-center relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <h2 className="text-5xl md:text-8xl font-display font-medium tracking-tighter mb-12">Ready for Dispatch?</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link
              to="/get-quote"
              className="btn-primary px-12 py-5"
            >
              Get Instant Quote
            </Link>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              className="btn-secondary px-12 py-5"
            >
              WhatsApp Dispatch
            </a>
          </div>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-neon/5 blur-[150px] rounded-full pointer-events-none" />
      </section>
    </div>
  );
}
