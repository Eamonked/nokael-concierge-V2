import React from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { User, Phone, Mail, MapPin, Truck, Clock, Loader2, Globe } from 'lucide-react';
import { type Driver } from '../../lib/supabase';
import { DAYS_OF_WEEK, VEHICLE_TYPES } from './constants';

interface ApplicationStepPersonalInfoProps {
  formData: Partial<Driver>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Driver>>>;
  selectedDays: string[];
  setSelectedDays: React.Dispatch<React.SetStateAction<string[]>>;
  startTime: string;
  setStartTime: React.Dispatch<React.SetStateAction<string>>;
  endTime: string;
  setEndTime: React.Dispatch<React.SetStateAction<string>>;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ApplicationStepPersonalInfo({
  formData,
  setFormData,
  selectedDays,
  setSelectedDays,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  isSubmitting,
  onSubmit,
}: ApplicationStepPersonalInfoProps) {
  const { t } = useTranslation('driverApplication');

  return (
    <motion.form
      key="step1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      onSubmit={onSubmit}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
        <div className="space-y-3">
          <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black">{t('step1.fullNameLabel')}</label>
          <div className="group relative">
            <User className="absolute start-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
            <input
              required
              type="text"
              className="w-full h-16 ps-14 pe-5 rounded-xl bg-brand-surface/50 border border-brand-border/50 text-brand-text text-sm focus:outline-none focus:border-brand-neon/50 transition-colors placeholder:text-brand-muted/40"
              placeholder={t('step1.fullNamePlaceholder') as string}
              value={formData.full_name}
              onChange={e => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-3">
          <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black">{t('step1.emailLabel')}</label>
          <div className="group relative">
            <Mail className="absolute start-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
            <input
              required
              type="email"
              className="w-full h-16 ps-14 pe-5 rounded-xl bg-brand-surface/50 border border-brand-border/50 text-brand-text text-sm focus:outline-none focus:border-brand-neon/50 transition-colors placeholder:text-brand-muted/40"
              placeholder={t('step1.emailPlaceholder') as string}
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-3">
          <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black">{t('step1.phoneLabel')}</label>
          <div className="group relative">
            <Phone className="absolute start-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
            <input
              required
              type="tel"
              className="w-full h-16 ps-14 pe-5 rounded-xl bg-brand-surface/50 border border-brand-border/50 text-brand-text text-sm focus:outline-none focus:border-brand-neon/50 transition-colors placeholder:text-brand-muted/40"
              placeholder={t('step1.phonePlaceholder') as string}
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-3">
          <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black">{t('step1.whatsappLabel')}</label>
          <div className="group relative">
            <Phone className="absolute start-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
            <input
              required
              type="tel"
              className="w-full h-16 ps-14 pe-5 rounded-xl bg-brand-surface/50 border border-brand-border/50 text-brand-text text-sm focus:outline-none focus:border-brand-neon/50 transition-colors placeholder:text-brand-muted/40"
              placeholder={t('step1.whatsappPlaceholder') as string}
              value={formData.whatsapp}
              onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-3">
          <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black">{t('step1.baseLocationLabel')}</label>
          <div className="group relative">
            <MapPin className="absolute start-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
            <input
              required
              type="text"
              className="w-full h-16 ps-14 pe-5 rounded-xl bg-brand-surface/50 border border-brand-border/50 text-brand-text text-sm focus:outline-none focus:border-brand-neon/50 transition-colors placeholder:text-brand-muted/40"
              placeholder={t('step1.baseLocationPlaceholder') as string}
              value={formData.base_location}
              onChange={e => setFormData({ ...formData, base_location: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-3">
          <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black">{t('step1.vehicleCategoryLabel')}</label>
          <div className="group relative">
            <Truck className="absolute start-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
            <select
              className="w-full h-16 ps-14 pe-5 rounded-xl bg-brand-surface/50 border border-brand-border/50 text-brand-text text-sm focus:outline-none focus:border-brand-neon/50 transition-colors appearance-none"
              value={formData.vehicle_type}
              onChange={e => setFormData({ ...formData, vehicle_type: e.target.value })}
            >
              {VEHICLE_TYPES.map(v => (
                <option key={v.value} value={v.value}>{t(`step1.vehicleTypes.${v.i18nKey}`)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-brand-border/50 space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-brand-text mb-1">{t('step1.availabilityTitle')}</h3>
            <p className="text-[10px] text-brand-muted uppercase tracking-widest">{t('step1.availabilitySubtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => (
              <button
                key={day.id}
                type="button"
                onClick={() => {
                  setSelectedDays(prev =>
                    prev.includes(day.id) ? prev.filter(d => d !== day.id) : [...prev, day.id]
                  );
                }}
                className={`w-10 h-10 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                  selectedDays.includes(day.id)
                    ? "bg-brand-neon text-brand-bg border-brand-neon shadow-[0_4px_12px_rgba(57,255,20,0.3)]"
                    : "bg-brand-surface text-brand-muted border-brand-border hover:border-brand-neon/50"
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black">{t('step1.startShiftLabel')}</label>
            <div className="relative">
              <Clock className="absolute start-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
              <input
                type="time"
                className="w-full h-16 ps-14 pe-5 rounded-xl bg-brand-surface/50 border border-brand-border/50 text-brand-text text-sm focus:outline-none focus:border-brand-neon/50 transition-colors"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.3em] text-brand-muted font-black">{t('step1.endShiftLabel')}</label>
            <div className="relative">
              <Clock className="absolute start-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
              <input
                type="time"
                className="w-full h-16 ps-14 pe-5 rounded-xl bg-brand-surface/50 border border-brand-border/50 text-brand-text text-sm focus:outline-none focus:border-brand-neon/50 transition-colors"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-brand-neon/5 border border-brand-neon/10 rounded-2xl p-6 flex items-center gap-4">
        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-brand-bg">
          <Globe className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-brand-text mb-1">{t('step1.interEmirateTitle')}</h4>
          <p className="text-[10px] text-brand-muted uppercase tracking-widest">{t('step1.interEmirateDesc')}</p>
        </div>
        <div className="ms-auto flex items-center gap-3">
          {[t('step1.yes'), t('step1.no')].map((opt, i) => {
            const isYes = i === 0;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setFormData({ ...formData, inter_emirate: isYes })}
                className={`px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  (formData.inter_emirate && isYes) || (!formData.inter_emirate && !isYes)
                    ? "bg-brand-neon text-brand-bg shadow-[0_0_15px_rgba(57,255,20,0.2)]"
                    : "bg-brand-surface text-brand-muted border border-brand-border"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <button
        disabled={isSubmitting}
        className="btn-primary w-full py-6 text-sm"
      >
        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : t('step1.continueButton')}
      </button>
    </motion.form>
  );
}
