import React from 'react';
import { motion } from 'motion/react';
import { MessageSquare, ArrowRight, Zap, Shield, MapPin, Clock, CheckCircle2, ChevronRight, Phone, X, Navigation, Package, Truck, Star, Building2, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WHATSAPP_NUMBER, PHONE_NUMBER, DISPLAY_PHONE, PRICE_TIER_SAME_DAY, PRICE_TIER_DEDICATED } from '../constants';
import { trackWhatsAppClick, trackPhoneClick } from '../lib/analytics';
import { cn } from '../lib/utils';

const Hero = () => {
  const { t } = useTranslation(['home', 'common']);
  // Decision (B) — the pre-filled WhatsApp body follows the site language, so
  // it comes from common:whatsapp.defaultMessage rather than the fixed
  // DEFAULT_WA_MESSAGE constant. See Phase 7 of the customer-facing i18n plan.
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t('common:whatsapp.defaultMessage'))}`;


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
              <span>{t('hero.badge')}</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-medium leading-[1.1] tracking-[-0.02em] mb-6 text-brand-text">
              {t('hero.titleLine1')}<br />
              <span className="text-brand-neon font-normal">{t('hero.titleLine2')}</span><br />
              <span className="text-brand-muted text-3xl md:text-5xl lg:text-6xl font-normal">{t('hero.titleLine3')}</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-brand-muted font-normal mb-12 max-w-xl leading-relaxed">
              {t('hero.subtitleLine1')}<br />
              {t('hero.subtitleLine2')}
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
                    <span className="block text-[10px] font-black uppercase tracking-widest opacity-80">{t('hero.ctaEyebrow')}</span>
                    <span className="text-lg">{t('hero.ctaLabel')}</span>
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
                <span>{t('hero.callLabel', { phone: DISPLAY_PHONE })}</span>
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-4 mb-12">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-neon/10 border border-brand-neon/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-neon" />
                <span className="text-[11px] font-semibold text-brand-neon">{t('hero.badgeLicensed')}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-surface border border-brand-border">
                <Clock className="w-3.5 h-3.5 text-brand-muted" />
                <span className="text-[11px] font-semibold text-brand-text">{t('hero.badgeDispatch')}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 border-t border-brand-border pt-12">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-brand-muted mb-3 font-semibold">{t('hero.stats.avgDispatch.label')}</p>
                <p className="text-3xl font-display font-semibold tracking-tight">{t('hero.stats.avgDispatch.value')}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-brand-muted mb-3 font-semibold">{t('hero.stats.sameDay.label')}</p>
                <p className="text-3xl font-display font-semibold tracking-tight text-brand-neon">{t('hero.stats.sameDay.priceTemplate', { price: PRICE_TIER_SAME_DAY })}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-brand-muted mb-3 font-semibold">{t('hero.stats.dedicated.label')}</p>
                <p className="text-3xl font-display font-semibold tracking-tight">{t('hero.stats.dedicated.priceTemplate', { price: PRICE_TIER_DEDICATED })}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-brand-muted mb-3 font-semibold">{t('hero.stats.tracking.label')}</p>
                <p className="text-3xl font-display font-semibold tracking-tight">{t('hero.stats.tracking.value')}</p>
              </div>
            </div>
          </motion.div>

          <div
            className="hidden lg:block relative"
          >
            <div className="dispatch-card relative z-10 rotate-2 translate-x-4">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{t('hero.liveCard.label')}</span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-brand-neon">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-neon animate-pulse inline-block" />
                  {t('hero.liveCard.active')}
                </span>
              </div>
              <div className="space-y-3">
                {[
                  { key: '0', time: '08:14', from: 'DIFC', to: 'ADGM', status: 'delivered' },
                  { key: '1', time: '09:32', from: 'JLT', to: 'Mussafah', status: 'inTransit' },
                  { key: '2', time: '11:05', from: 'Downtown', to: 'Khalifa City', status: 'dispatched' },
                ].map((job, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-brand-input border border-brand-input-border">
                    <span className="text-[10px] font-mono text-brand-muted w-10 shrink-0">{job.time}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-brand-text truncate">{job.from} → {job.to}</p>
                      <p className="text-[10px] text-brand-muted">{t(`hero.liveCard.jobs.${job.key}.item`)}</p>
                    </div>
                    <span className={cn(
                      'text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0',
                      job.status === 'delivered' ? 'bg-brand-neon/10 text-brand-neon' :
                      job.status === 'inTransit' ? 'bg-brand-blue/10 text-brand-blue' :
                      'bg-brand-border text-brand-muted'
                    )}>{t(`hero.liveCard.status.${job.status}`)}</span>
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
  const { t } = useTranslation('home');

  // Copy lives in home.json; the array keeps only the key + presentational
  // fields, so it stays a plain data structure outside the translated render.
  const items = [
    { key: '0', icon: Navigation, accent: 'neon' },
    { key: '1', icon: User, accent: 'blue' },
    { key: '2', icon: Zap, accent: 'neon' },
    { key: '3', icon: ArrowRight, accent: 'blue' },
  ];

  return (
    <section className="py-24 bg-brand-bg border-y border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-neon/10 border border-brand-neon/20 mb-6">
            <div className="w-1 h-1 rounded-full bg-brand-neon" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-neon">{t('differentiators.eyebrow')}</p>
          </div>
          <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tight text-brand-text">{t('differentiators.heading')}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item, i) => (
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
              <h3 className="text-xl font-bold mb-4 text-brand-text">{t(`differentiators.items.${item.key}.title`)}</h3>
              <p className="text-sm text-brand-muted leading-relaxed">{t(`differentiators.items.${item.key}.desc`)}</p>
              
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
  const { t } = useTranslation('home');

  const items = [
    { key: '0', icon: Navigation },
    { key: '1', icon: Package },
    { key: '2', icon: Zap },
    { key: '3', icon: Shield },
    { key: '4', icon: Building2 },
  ];

  return (
    <section className="section-spacing bg-brand-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-20 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-neon/10 border border-brand-neon/20 mb-6">
            <div className="w-1 h-1 rounded-full bg-brand-neon" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-neon">{t('supportingSection.eyebrow')}</p>
          </div>
          <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tight mb-8 text-brand-text">
            {t('supportingSection.headingLine1')}<br />{t('supportingSection.headingLine2')}
          </h2>
          <p className="text-xl text-brand-muted leading-relaxed">
            {t('supportingSection.intro')}
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <div key={i} className="dispatch-card h-full">
              <div className="w-10 h-10 rounded-xl bg-brand-input flex items-center justify-center mb-6">
                <item.icon className="w-5 h-5 text-brand-neon" />
              </div>
              <h3 className="text-lg font-bold mb-3 text-brand-text">{t(`supportingSection.items.${item.key}.title`)}</h3>
              <p className="text-sm text-brand-muted leading-relaxed group-hover:text-brand-text transition-colors">
                {t(`supportingSection.items.${item.key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const ServiceCards = () => {
  const { t } = useTranslation(['home', 'common']);
  // Decision (B) — pre-filled WhatsApp body follows the site language.
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t('common:whatsapp.defaultMessage'))}`;

  // `analyticsId` is deliberately a fixed English slug: it used to be derived
  // from the (now translated) card title, which would have split the existing
  // service_card_* events into one bucket per site language.
  const services = [
    {
      key: 'sameDay',
      analyticsId: 'same-day',
      price: PRICE_TIER_SAME_DAY,
      featureCount: 6,
      highlight: true
    },
    {
      key: 'dedicated',
      analyticsId: 'dedicated',
      price: PRICE_TIER_DEDICATED,
      featureCount: 6
    }
  ];

  return (
    <section className="section-spacing bg-brand-surface/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-neon/10 border border-brand-neon/20 mb-6">
            <div className="w-1 h-1 rounded-full bg-brand-neon" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-neon">{t('serviceCards.eyebrow')}</p>
          </div>
          <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tight text-brand-text">{t('serviceCards.heading')}</h2>
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
              {/* Both tiers carry a badge, so this renders unconditionally —
                  the old `s.label &&` guard existed only because the label was
                  an optional literal on the data array. */}
              <div className="absolute top-0 left-0 right-0 h-10 bg-brand-neon flex items-center justify-center">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-bg">{t(`serviceCards.${s.key}.badge`)}</span>
              </div>
              
              <div className="pt-6 mb-8 text-center">
                <h3 className="text-3xl font-display font-medium mb-4 text-brand-text tracking-tighter uppercase">{t(`serviceCards.${s.key}.title`)}</h3>
                <div className="flex flex-col items-center">
                  <span className="text-5xl font-display font-medium text-brand-neon leading-none tracking-tighter mb-2">{t(`serviceCards.${s.key}.priceTemplate`, { price: s.price })}</span>
                  <span className="text-xs text-brand-muted italic font-medium">{t(`serviceCards.${s.key}.subtext`)}</span>
                </div>
              </div>

              <div className="h-px bg-brand-border w-full mb-10" />
              
              <ul className="space-y-5 mb-12 flex-1">
                {Array.from({ length: s.featureCount }, (_, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm text-brand-muted">
                    <div className="mt-2 w-1.5 h-1.5 rounded-full bg-brand-neon shrink-0" />
                    <span className="leading-relaxed">{t(`serviceCards.${s.key}.features.${j}`)}</span>
                  </li>
                ))}
              </ul>

              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick(`service_card_${s.analyticsId}`)}
                className={cn(
                  "w-full py-5 rounded-xl font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-2 transition-all",
                  s.highlight ? "bg-brand-neon text-brand-bg hover:opacity-90" : "bg-brand-input border border-brand-input-border text-brand-text hover:border-brand-neon/30 hover:bg-brand-neon/5"
                )}
              >
                <MessageSquare className="w-5 h-5" />
                <span>{t(`serviceCards.${s.key}.cta`)}</span>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const BusinessAccounts = () => {
  const { t } = useTranslation('home');

  // NOTE: this component's CTA is the <Link to="/business-account"> below,
  // which routes to the full business inquiry form — not a direct WhatsApp
  // message. A previously-unused `waUrl` built from BUSINESS_ACCOUNT_WA_MESSAGE
  // was removed here during the i18n pass (dead code, never rendered).

  return (
    <section className="section-spacing bg-brand-bg relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="bg-gradient-to-br from-brand-neon to-brand-neon/90 text-brand-bg rounded-3xl p-12 md:p-16 text-center relative overflow-hidden shadow-2xl shadow-brand-neon/20">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-bg/20 backdrop-blur-sm border border-brand-bg/30 mb-8">
              <Building2 className="w-4 h-4" />
              <span className="text-[11px] font-black uppercase tracking-wider">{t('businessAccounts.badge')}</span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-display font-semibold tracking-tight mb-6 leading-tight">
              {t('businessAccounts.heading')}
            </h2>
            <p className="text-lg font-medium mb-10 max-w-2xl mx-auto leading-relaxed opacity-90">
              {t('businessAccounts.description')}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/business-account"
                className="bg-brand-bg text-brand-neon px-10 py-5 rounded-2xl font-bold uppercase tracking-wider text-xs hover:bg-brand-bg/90 transition-all flex items-center gap-3 shadow-xl"
              >
                <Building2 className="w-5 h-5" />
                <span>{t('businessAccounts.cta')}</span>
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
  const { t } = useTranslation('home');

  // District names are proper nouns and stay in the data array; only `context`
  // is translated, keyed by index into corridorStatus.corridors.
  const corridors = [
    { key: '0', name: 'DIFC' },
    { key: '1', name: 'Downtown Dubai' },
    { key: '2', name: 'Jebel Ali' },
    { key: '3', name: 'ADGM' },
    { key: '4', name: 'Mussafah' },
    { key: '5', name: 'Khalifa City' },
  ];

  return (
    <section className="section-spacing bg-brand-surface/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-neon/10 border border-brand-neon/20 mb-6">
              <div className="w-1 h-1 rounded-full bg-brand-neon" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-neon">{t('corridorStatus.eyebrow')}</p>
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-medium tracking-tight text-brand-text">{t('corridorStatus.heading')}</h2>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-brand-neon/10 border border-brand-neon/20">
            <div className="w-2 h-2 rounded-full bg-brand-neon animate-pulse" />
            <span className="text-xs font-bold text-brand-neon uppercase tracking-wider">{t('corridorStatus.liveBadge')}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {corridors.map((c, i) => (
            <div key={i} className="p-8 rounded-3xl bg-gradient-to-br from-brand-input to-brand-surface border border-brand-input-border hover:border-brand-neon/30 transition-all duration-500 group overflow-hidden relative">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-neon/10 border border-brand-neon/20">
                    <div className="w-1 h-1 rounded-full bg-brand-neon" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand-neon">{t('corridorStatus.statusActive')}</span>
                  </div>
                  <MapPin className="w-5 h-5 text-brand-muted group-hover:text-brand-neon transition-colors duration-300" />
                </div>
                <h3 className="text-2xl font-display font-semibold text-brand-text mb-3 tracking-tight">{c.name}</h3>
                <p className="text-xs text-brand-muted uppercase tracking-wider font-semibold leading-relaxed">{t(`corridorStatus.corridors.${c.key}.context`)}</p>
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
  const { t } = useTranslation('home');

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
                  {t('trustGrounded.quote')}
                </p>
              </div>
            </div>
          </div>
          
          <div className="order-1 lg:order-2">
            <h2 className="text-4xl md:text-6xl font-display font-medium tracking-tighter mb-12 text-brand-text">
              {t('trustGrounded.headingLine1')}<br />
              <span className="text-brand-neon italic">{t('trustGrounded.headingLine2')}</span>
            </h2>
            
            <div className="space-y-12">
              <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-3 text-brand-text">
                  <div className="w-1 h-6 bg-brand-neon rounded-full" />
                  {t('trustGrounded.sections.0.title')}
                </h3>
                <p className="text-brand-muted leading-relaxed">
                  {t('trustGrounded.sections.0.body')}
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-3 text-brand-text">
                  <div className="w-1 h-6 bg-brand-blue rounded-full" />
                  {t('trustGrounded.sections.1.title')}
                </h3>
                <p className="text-brand-muted leading-relaxed">
                  {t('trustGrounded.sections.1.body')}
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-3 text-brand-text">
                  <div className="w-1 h-6 bg-brand-border rounded-full" />
                  {t('trustGrounded.sections.2.title')}
                </h3>
                <p className="text-brand-muted leading-relaxed">
                  {t('trustGrounded.sections.2.body')}
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
  const { t } = useTranslation(['home', 'common']);
  // Decision (B) — pre-filled WhatsApp body follows the site language.
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t('common:whatsapp.defaultMessage'))}`;

  return (
    <section className="py-32 md:py-40 bg-brand-bg relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h2 className="text-5xl md:text-8xl lg:text-9xl font-display font-semibold tracking-tighter mb-12 leading-[0.9] text-brand-text">
          {t('finalAction.headingLine1')} <br />
          <span className="text-brand-neon font-medium">{t('finalAction.headingLine2')}</span>
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
            <span>{t('finalAction.ctaWhatsapp')}</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </a>
          
          <a
            href={`tel:${PHONE_NUMBER}`}
            onClick={trackPhoneClick}
            className="btn-secondary px-12 py-6 text-lg"
          >
            <Phone className="w-6 h-6" />
            <span>{t('finalAction.ctaCall')}</span>
          </a>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-surface border border-brand-border">
            <CheckCircle2 className="w-4 h-4 text-brand-neon" />
            <span className="text-xs font-semibold text-brand-text">{t('finalAction.badgeLicensed')}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-surface border border-brand-border">
            <Shield className="w-4 h-4 text-brand-blue" />
            <span className="text-xs font-semibold text-brand-text">{t('finalAction.badgeInsured')}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-surface border border-brand-border">
            <Zap className="w-4 h-4 text-brand-neon" />
            <span className="text-xs font-semibold text-brand-text">{t('finalAction.badgeDirectAssignment')}</span>
          </div>
        </div>
      </div>
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-brand-neon/5 blur-[180px] rounded-full pointer-events-none" />
    </section>
  );
};

const TrustBar = () => {
  const { t } = useTranslation('home');

  const stats = [
    { key: 'corridorTime', icon: Clock, color: 'neon' },
    { key: 'dispatch', icon: Zap, color: 'neon' },
    { key: 'dedicated', icon: Shield, color: 'blue' },
    { key: 'availability', icon: CheckCircle2, color: 'blue' },
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
                <p className="text-2xl font-display font-semibold text-brand-text leading-none mb-1.5 tracking-tight">{t(`trustBar.${s.key}.value`)}</p>
                <p className="text-[11px] text-brand-muted font-medium leading-snug">{t(`trustBar.${s.key}.label`)}</p>
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
