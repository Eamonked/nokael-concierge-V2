import React from 'react';
import { motion } from 'motion/react';
import { MapPin, Zap, MessageSquare, Phone, ArrowRight, Shield, Clock, CheckCircle2, Navigation, Truck, User, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  cityLabel?: string;
  industryLabel?: string;
  heroImg: string;
  content: string[];
}

export const LandingTemplate = ({ title, subtitle, city, industry, cityLabel, industryLabel, heroImg, content }: LandingProps) => {
  const { t } = useTranslation('landingPages');
  // The "from" side of the Corridor Performance list mirrors the page's own
  // city badge; industry pages (no `city` prop) fall back to the same default
  // ('Dubai') the original literal `city || 'Dubai'` used.
  const corridorFromLabel = cityLabel || t('chrome.defaultCityLabel');

  return (
    <div className="bg-brand-bg">
      {/* Hero */}
      <section className="relative min-h-[80vh] flex items-center overflow-hidden border-b border-brand-border">
        <div className="absolute inset-0 z-0">
          <picture>
            <source 
              media="(max-width: 640px)" 
              srcSet={`${heroImg}&fm=webp&w=640`} 
            />
            <source 
              media="(max-width: 1024px)" 
              srcSet={`${heroImg}&fm=webp&w=1024`} 
            />
            <img 
              src={`${heroImg}&fm=webp&w=1920`} 
              alt={title} 
              width="1920"
              height="1080"
              fetchPriority="high"
              className="w-full h-full object-cover opacity-30 grayscale"
              referrerPolicy="no-referrer"
            />
          </picture>
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
              <Link to="/" className="hover:text-brand-text transition-colors">{t('breadcrumb.home')}</Link>
              <ChevronRight className="w-3 h-3" />
              <Link to="/services" className="hover:text-brand-text transition-colors">{t('breadcrumb.services')}</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-brand-neon">{title.replace('.', '')}</span>
            </nav>

            <div className="flex flex-wrap items-center gap-4 mb-10">
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-lg bg-brand-input border border-brand-input-border text-brand-neon text-[10px] uppercase tracking-[0.3em] font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-neon animate-pulse" />
                <span>{city ? t('chrome.dispatchSectorTemplate', { city: cityLabel }) : t('chrome.industryTemplate', { industry: industryLabel })}</span>
                <span className="opacity-40 ml-2">| {t('chrome.liveActive')}</span>
              </div>
              
            </div>
            
            <h1 className="text-5xl md:text-9xl font-display font-medium tracking-tighter mb-10 leading-[0.8] text-brand-text">
              {title}
            </h1>
            
            <p className="text-xl md:text-2xl text-brand-muted font-medium mb-12 max-w-2xl leading-relaxed">
              {subtitle} <br />
              <span className="text-brand-text italic mt-2 block">{t('chrome.tagline')}</span>
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick(`landing_hero_${city || industry || 'general_uae'}`)}
                className="btn-primary w-full sm:w-auto px-10 py-6 group scale-105 origin-left"
              >
                <div className="flex items-center gap-3 text-left">
                   <MessageSquare className="w-6 h-6" />
                   <div>
                     <span className="block text-[10px] font-black uppercase tracking-widest opacity-60">{t('chrome.ctaEyebrow')}</span>
                     <span className="text-lg">{t('chrome.ctaLabel')}</span>
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
                <span>{t('chrome.callCenterTemplate', { phone: DISPLAY_PHONE })}</span>
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-8 border-t border-brand-border pt-8">
              <div>
                <p className="text-[9px] uppercase tracking-widest text-brand-muted mb-1">{t('chrome.startingFrom')}</p>
                <p className="text-xl font-display font-medium text-brand-neon">{t('chrome.priceTemplate', { price: PRICE_TIER_SAME_DAY })}</p>
              </div>
              <div className="w-px h-8 bg-brand-border hidden sm:block" />
              <div>
                <p className="text-[9px] uppercase tracking-widest text-brand-muted mb-1">{t('chrome.responseTime')}</p>
                <p className="text-xl font-display font-medium text-brand-text">{t('chrome.responseTimeValue')}</p>
              </div>
              <div className="w-px h-8 bg-brand-border hidden sm:block" />
              <div>
                <p className="text-[9px] uppercase tracking-widest text-brand-muted mb-1">{t('chrome.status')}</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand-neon animate-pulse" />
                  <p className="text-xl font-display font-medium text-brand-text">{t('chrome.statusActive')}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust Bar */}
      <div className="bg-brand-surface/30 border-b border-brand-border py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center md:justify-between items-center gap-8 text-[11px] font-bold uppercase tracking-widest text-brand-muted">
            <span>{t('trustBar.trustedFor')}</span>
            <span>{t('trustBar.legalFinance')}</span>
            <span>{t('trustBar.governmentFilings')}</span>
            <span>{t('trustBar.industrialParts')}</span>
            <span>{t('trustBar.supplyChain')}</span>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <section className="py-32 bg-brand-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="asymmetric-grid items-start">
            <div className="space-y-16">
              <div className="max-w-xl">
                <h2 className="text-3xl font-display font-medium tracking-tighter mb-8 text-brand-text">{t('operationalOverview')}</h2>
                <div className="space-y-8 text-brand-muted leading-relaxed text-sm">
                  {content.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </div>

              <div className="bg-brand-surface border border-brand-border rounded-3xl p-8 sm:p-12">
                <h3 className="text-xl font-display font-medium tracking-tighter mb-8 text-brand-text">{t('sla.title')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-brand-neon">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-widest">{t('sla.guaranteedDispatch.title')}</span>
                    </div>
                    <p className="text-sm text-brand-muted">{t('sla.guaranteedDispatch.desc')}</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-brand-neon">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-widest">{t('sla.directPointToPoint.title')}</span>
                    </div>
                    <p className="text-sm text-brand-muted">{t('sla.directPointToPoint.desc')}</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-brand-neon">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-widest">{t('sla.fullInsurance.title')}</span>
                    </div>
                    <p className="text-sm text-brand-muted">{t('sla.fullInsurance.desc')}</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-brand-neon">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-widest">{t('sla.realTimeProof.title')}</span>
                    </div>
                    <p className="text-sm text-brand-muted">{t('sla.realTimeProof.desc')}</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { key: '0', icon: Zap },
                  { key: '1', icon: Navigation },
                  { key: '2', icon: Shield },
                  { key: '3', icon: Clock }
                ].map((item, i) => (
                  <div key={i} className="dispatch-card py-8">
                    <item.icon className="w-6 h-6 text-brand-neon mb-6" />
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-3 text-brand-text">{t(`quickFacts.${item.key}.title`)}</h3>
                    <p className="text-[10px] text-brand-muted uppercase tracking-widest leading-relaxed">{t(`quickFacts.${item.key}.desc`)}</p>
                  </div>
                ))}
              </div>

              {/* SLA recap — replaces fabricated testimonials until real client feedback exists */}
              <div className="pt-16 border-t border-brand-border">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-6 text-brand-muted">{t('whatClientsUseThisFor.heading')}</h3>
                <p className="text-sm text-brand-muted leading-relaxed max-w-2xl">
                  {t('whatClientsUseThisFor.body')}
                </p>
              </div>
            </div>
            
            <div className="space-y-8 lg:mt-24">
              <div className="dispatch-card">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-10 text-brand-muted">{t('corridorPerformance.heading')}</h3>
                <div className="space-y-4">
                  {[
                    { key: '0' },
                    { key: '1' },
                    { key: '2' },
                    { key: '3' }
                  ].map((route, i) => (
                    <div key={i} className="flex items-center justify-between p-5 bg-brand-input border border-brand-input-border rounded-xl">
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-brand-text">{corridorFromLabel}</span>
                        <ArrowRight className="w-3 h-3 text-brand-neon" />
                        <span className="text-xs font-bold text-brand-text">{t(`corridorPerformance.destinations.${route.key}.to`)}</span>
                      </div>
                      <span className="text-[10px] font-bold text-brand-neon uppercase tracking-widest">{t(`corridorPerformance.destinations.${route.key}.time`)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-8 text-[9px] text-brand-muted uppercase tracking-[0.3em] text-center font-bold">
                  {t('corridorPerformance.liveNote')}
                </p>
              </div>
              
              <div className="p-10 bg-brand-neon rounded-3xl text-brand-bg">
                <h3 className="text-3xl font-display font-medium tracking-tighter mb-6 leading-tight">{t('needItNow.heading')}</h3>
                <p className="font-medium mb-10 leading-relaxed text-sm opacity-90">
                  {t('needItNow.body')}
                </p>
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackWhatsAppClick(`landing_card_${city || industry || 'general_uae'}`)}
                  className="w-full py-5 bg-brand-bg text-brand-neon font-black rounded-2xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:scale-[1.02] transition-all shadow-xl mb-6"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>{t('needItNow.cta')}</span>
                </a>

                <div className="pt-6 border-t border-brand-bg/20">
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-4 opacity-70">{t('otherServices.label')}</p>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { key: '0', name: t('otherServices.items.0.name'), path: '/document-delivery-uae' },
                      { key: '1', name: t('otherServices.items.1.name'), path: '/spare-parts-delivery-uae' },
                      { key: '2', name: t('otherServices.items.2.name'), path: '/urgent-delivery-dubai' },
                      { key: '3', name: t('otherServices.items.3.name'), path: '/urgent-delivery-abu-dhabi' }
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

export const DubaiLanding = () => {
  const { t } = useTranslation('landingPages');
  return (
    <LandingTemplate
      title={t('dubai.title')}
      subtitle={t('dubai.subtitle')}
      city="Dubai"
      cityLabel={t('dubai.cityLabel')}
      heroImg="https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&q=80&w=1920"
      content={[t('dubai.content.0'), t('dubai.content.1'), t('dubai.content.2')]}
    />
  );
};

export const AbuDhabiLanding = () => {
  const { t } = useTranslation('landingPages');
  return (
    <LandingTemplate
      title={t('abuDhabi.title')}
      subtitle={t('abuDhabi.subtitle')}
      city="Abu Dhabi"
      cityLabel={t('abuDhabi.cityLabel')}
      heroImg="https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&q=80&w=1920"
      content={[t('abuDhabi.content.0'), t('abuDhabi.content.1'), t('abuDhabi.content.2')]}
    />
  );
};

export const DocumentLanding = () => {
  const { t } = useTranslation('landingPages');
  return (
    <LandingTemplate
      title={t('document.title')}
      subtitle={t('document.subtitle')}
      industry="Legal & Corporate"
      industryLabel={t('document.industryLabel')}
      heroImg="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=1920"
      content={[t('document.content.0'), t('document.content.1'), t('document.content.2')]}
    />
  );
};

export const SparePartsLanding = () => {
  const { t } = useTranslation('landingPages');
  return (
    <LandingTemplate
      title={t('spareParts.title')}
      subtitle={t('spareParts.subtitle')}
      industry="Industrial & Automotive"
      industryLabel={t('spareParts.industryLabel')}
      heroImg="https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=1920"
      content={[t('spareParts.content.0'), t('spareParts.content.1'), t('spareParts.content.2')]}
    />
  );
};
