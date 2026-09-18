import React from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Building2, User, CheckCircle2, Zap, ArrowRight, MessageSquare } from 'lucide-react';
import { type BusinessInquiry } from '../../lib/supabase';
import { trackWhatsAppClick } from '../../lib/analytics';

interface InquirySidebarProps {
  formData: Partial<BusinessInquiry>;
  waUrl: string;
}

export default function InquirySidebar({ formData, waUrl }: InquirySidebarProps) {
  const { t } = useTranslation('businessInquiry');

  const benefits = [
    { titleKey: 'sidebar.benefits.zeroSortingHubs.title', descKey: 'sidebar.benefits.zeroSortingHubs.desc', icon: Zap },
    { titleKey: 'sidebar.benefits.dedicatedFleet.title', icon: CheckCircle2 },
    { titleKey: 'sidebar.benefits.priorityDispatch.title', icon: User },
    { titleKey: 'sidebar.benefits.corporateInvoicing.title', icon: Building2 },
  ];

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <div className="inline-flex items-center space-x-3 px-4 py-2 rounded-lg bg-brand-neon/10 border border-brand-neon/20 text-brand-neon text-[10px] uppercase tracking-[0.3em] font-bold mb-8">
          <Building2 className="w-3 h-3" />
          <span>{t('sidebar.badge')}</span>
        </div>
        <h1 className="text-5xl md:text-8xl font-display font-medium tracking-tighter text-brand-text mb-6 leading-[0.85]">
          {t('sidebar.titleLine')} <br />
          <span className="text-brand-neon italic">{t('sidebar.titleHighlight')}</span>
        </h1>
        <p className="text-xl text-brand-muted leading-relaxed max-w-xl font-medium">
          {t('sidebar.intro')}
        </p>
        <p className="text-xs text-brand-muted uppercase tracking-widest font-bold mt-4">
          {t('sidebar.pricingNote')}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
        {benefits.map((benefit, i) => (
          <div key={i} className="dispatch-card p-6 group hover:border-brand-neon/30 transition-all">
            <benefit.icon className="w-6 h-6 text-brand-neon mb-4 group-hover:scale-110 transition-transform" />
            <h4 className="text-xs font-black uppercase tracking-widest text-brand-text italic mb-1">{t(benefit.titleKey)}</h4>
            {benefit.descKey && <p className="text-[10px] text-brand-muted uppercase tracking-wider font-bold">{t(benefit.descKey)}</p>}
          </div>
        ))}
      </div>

      <div className="p-10 bg-brand-surface border border-brand-border rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 end-0 p-8 opacity-10">
          <MessageSquare className="w-24 h-24 text-brand-neon" />
        </div>
        <p className="text-lg font-medium text-brand-text mb-8 relative z-10 leading-relaxed italic">
          {t('sidebar.testimonial')}
        </p>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppClick('business_account_inquiry', {
            email: formData.email,
            phone_number: formData.phone_whatsapp,
            first_name: formData.contact_person
          })}
          className="inline-flex items-center gap-3 text-brand-neon text-xs font-bold uppercase tracking-[0.2em] group"
        >
          <span>{t('sidebar.dispatchLinkLabel')}</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </a>
      </div>
    </div>
  );
}
