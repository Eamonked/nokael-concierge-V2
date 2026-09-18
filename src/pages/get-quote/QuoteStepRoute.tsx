import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { type QuoteRequest } from '../../lib/supabase';
import { emirates } from './constants';

interface QuoteStepRouteProps {
  pickupEmirate: string;
  deliveryEmirate: string;
  formData: Partial<QuoteRequest>;
  updateForm: (data: Partial<QuoteRequest>) => void;
  updatePickupEmirate: (val: string) => void;
  updateDeliveryEmirate: (val: string) => void;
}

export default function QuoteStepRoute({ pickupEmirate, deliveryEmirate, formData, updateForm, updatePickupEmirate, updateDeliveryEmirate }: QuoteStepRouteProps) {
  const { t } = useTranslation('getQuote');

  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-6"
    >
      {/* Pickup */}
      <div className="p-5 rounded-2xl border border-brand-input-border bg-brand-input/40 space-y-4">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-neon">📍 {t('step1.pickupTitle')}</p>
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-2">{t('step1.emirateLabel')}</label>
          <select
            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-3.5 px-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors appearance-none text-sm"
            value={pickupEmirate}
            onChange={e => updatePickupEmirate(e.target.value)}
          >
            {emirates.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-2">{t('step1.specificLocationLabel')}</label>
          <input
            required
            type="text"
            placeholder={t('step1.pickupPlaceholder') as string}
            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-3.5 px-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors text-sm"
            value={formData.pickup_location}
            onChange={e => updateForm({ pickup_location: e.target.value })}
          />
        </div>
      </div>

      {/* Delivery */}
      <div className="p-5 rounded-2xl border border-brand-input-border bg-brand-input/40 space-y-4">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-blue">🏁 {t('step1.deliveryTitle')}</p>
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-2">{t('step1.emirateLabel')}</label>
          <select
            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-3.5 px-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors appearance-none text-sm"
            value={deliveryEmirate}
            onChange={e => updateDeliveryEmirate(e.target.value)}
          >
            {emirates.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-2">{t('step1.specificLocationLabel')}</label>
          <input
            required
            type="text"
            placeholder={t('step1.deliveryPlaceholder') as string}
            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-3.5 px-4 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-colors text-sm"
            value={formData.delivery_location}
            onChange={e => updateForm({ delivery_location: e.target.value })}
          />
        </div>
      </div>
    </motion.div>
  );
}
