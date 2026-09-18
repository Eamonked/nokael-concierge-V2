import React from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Building2, User, Phone, Mail } from 'lucide-react';
import { type BusinessInquiry } from '../../lib/supabase';

interface InquiryStepOrgProps {
  formData: Partial<BusinessInquiry>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<BusinessInquiry>>>;
}

export default function InquiryStepOrg({ formData, setFormData }: InquiryStepOrgProps) {
  const { t } = useTranslation('businessInquiry');

  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 gap-8">
        <div className="space-y-4">
          <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black italic">{t('step1.orgLabel')}</label>
          <div className="relative group">
            <Building2 className="absolute start-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
            <input
              required
              type="text"
              className="w-full bg-brand-input border border-brand-input-border rounded-xl py-5 ps-14 pe-5 focus:outline-none focus:border-brand-neon/50 transition-all font-medium placeholder:text-brand-muted/30"
              placeholder={t('step1.orgPlaceholder') as string}
              value={formData.company_name || ''}
              onChange={e => setFormData({ ...formData, company_name: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-4">
          <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black italic">{t('step1.managerLabel')}</label>
          <div className="relative group">
            <User className="absolute start-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
            <input
              required
              type="text"
              className="w-full bg-brand-input border border-brand-input-border rounded-xl py-5 ps-14 pe-5 focus:outline-none focus:border-brand-neon/50 transition-all font-medium placeholder:text-brand-muted/30"
              placeholder={t('step1.managerPlaceholder') as string}
              value={formData.contact_person || ''}
              onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <div className="space-y-4">
          <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black italic">{t('step1.whatsappLabel')}</label>
          <div className="relative group">
            <Phone className="absolute start-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
            <input
              required
              type="tel"
              className="w-full bg-brand-input border border-brand-input-border rounded-xl py-5 ps-14 pe-5 focus:outline-none focus:border-brand-neon/50 transition-all font-medium placeholder:text-brand-muted/30"
              placeholder={t('step1.whatsappPlaceholder') as string}
              value={formData.phone_whatsapp || ''}
              onChange={e => setFormData({ ...formData, phone_whatsapp: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-4">
          <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black italic">{t('step1.emailLabel')}</label>
          <div className="relative group">
            <Mail className="absolute start-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
            <input
              required
              type="email"
              className="w-full bg-brand-input border border-brand-input-border rounded-xl py-5 ps-14 pe-5 focus:outline-none focus:border-brand-neon/50 transition-all font-medium placeholder:text-brand-muted/30"
              placeholder={t('step1.emailPlaceholder') as string}
              value={formData.email || ''}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
