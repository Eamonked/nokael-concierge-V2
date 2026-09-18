import React from 'react';
import { motion } from 'motion/react';
import { Shield, Zap, MapPin, Clock, CheckCircle2, ArrowRight, Package, Truck, Navigation, FileText, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WHATSAPP_NUMBER } from '../constants';
import { trackWhatsAppClick } from '../lib/analytics';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ServiceCard = ({ title, desc, icon: Icon, features, link, index, learnMoreLabel }: any) => (
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
      <span>{learnMoreLabel}</span>
      <ArrowRight className="w-3 h-3" />
    </Link>
  </div>
);

export default function Services() {
  const { t } = useTranslation('services');

  const services = [
    {
      title: t('services.0.title'),
      desc: t('services.0.desc'),
      icon: Navigation,
      link: '/urgent-delivery-dubai',
      features: t('services.0.features', { returnObjects: true }) as string[]
    },
    {
      title: t('services.1.title'),
      desc: t('services.1.desc'),
      icon: FileText,
      link: '/document-delivery-uae',
      features: t('services.1.features', { returnObjects: true }) as string[]
    },
    {
      title: t('services.2.title'),
      desc: t('services.2.desc'),
      icon: Settings,
      link: '/spare-parts-delivery-uae',
      features: t('services.2.features', { returnObjects: true }) as string[]
    }
  ];

  return (
    <div className="bg-brand-bg">
      {/* Hero */}
      <section className="py-32 border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="asymmetric-grid items-end">
            <div className="max-w-2xl">
              <p className="text-brand-neon font-bold uppercase tracking-[0.4em] text-[10px] mb-6">{t('hero.eyebrow')}</p>
              <h1 className="text-5xl md:text-8xl font-display font-medium tracking-tighter mb-8 leading-[0.85]">
                {t('hero.titleLine1')}<br />
                {t('hero.titleLine2')}
              </h1>
              <p className="text-lg text-brand-muted leading-relaxed max-w-lg">
                {t('hero.intro')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="sr-only">{t('gridHeading')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {services.map((s, i) => <ServiceCard key={i} {...s} index={i} learnMoreLabel={t('learnMore')} />)}
          </div>
        </div>
      </section>

      {/* Operational Depth */}
      <section className="py-32 bg-brand-surface/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-4">
              <h2 className="text-3xl font-display font-medium tracking-tighter mb-8">{t('expertise.heading')}</h2>
              <p className="text-brand-muted text-sm leading-relaxed mb-8">
                {t('expertise.intro')}
              </p>
              <div className="p-6 rounded-2xl border border-brand-neon/20 bg-brand-neon/5">
                <p className="text-xs italic text-brand-text leading-relaxed">
                  {t('expertise.quote')}
                </p>
              </div>
            </div>
            
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-brand-text uppercase tracking-[0.2em]">{t('expertise.sections.0.title')}</h3>
                <p className="text-xs text-brand-muted leading-relaxed">
                  {t('expertise.sections.0.body')}
                </p>
              </div>
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-brand-text uppercase tracking-[0.2em]">{t('expertise.sections.1.title')}</h3>
                <p className="text-xs text-brand-muted leading-relaxed">
                  {t('expertise.sections.1.body')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Final Action */}
      <section className="py-40 text-center relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <h2 className="text-5xl md:text-8xl font-display font-medium tracking-tighter mb-12">{t('finalAction.heading')}</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link
              to="/get-quote"
              className="btn-primary px-12 py-5"
            >
              {t('finalAction.ctaQuote')}
            </Link>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsAppClick('services_footer')}
              className="btn-secondary px-12 py-5"
            >
              {t('finalAction.ctaWhatsapp')}
            </a>
          </div>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-neon/5 blur-[150px] rounded-full pointer-events-none" />
      </section>
    </div>
  );
}
