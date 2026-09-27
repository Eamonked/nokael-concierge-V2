import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { MapPin, Flag, ChevronDown, type LucideIcon } from 'lucide-react';
import { type QuoteRequest } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { emirates, fieldClass, labelClass } from './constants';
import LocationInput from './LocationInput';

interface QuoteStepRouteProps {
  pickupEmirate: string;
  deliveryEmirate: string;
  formData: Partial<QuoteRequest>;
  updateForm: (data: Partial<QuoteRequest>) => void;
  updatePickupEmirate: (val: string) => void;
  updateDeliveryEmirate: (val: string) => void;
}

interface LegProps {
  id: string;
  title: string;
  icon: LucideIcon;
  accent: string;
  emirate: string;
  onEmirateChange: (val: string) => void;
  location: string;
  onLocationChange: (val: string) => void;
  placeholder: string;
}

function RouteLeg({ id, title, icon: Icon, accent, emirate, onEmirateChange, location, onLocationChange, placeholder }: LegProps) {
  const { t } = useTranslation('getQuote');

  return (
    <fieldset className="p-5 rounded-2xl border border-brand-field-border bg-brand-input/40 space-y-4">
      <legend className="sr-only">{title}</legend>
      <p className={cn('flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em]', accent)}>
        <Icon className="w-4 h-4" />
        {title}
      </p>
      <div>
        <label htmlFor={`${id}-emirate`} className={labelClass}>{t('step1.emirateLabel')}</label>
        <div className="relative">
          <select
            id={`${id}-emirate`}
            className={cn(fieldClass, 'appearance-none pe-10 cursor-pointer')}
            value={emirate}
            onChange={e => onEmirateChange(e.target.value)}
          >
            {emirates.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <ChevronDown className="absolute end-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted pointer-events-none" />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-location`} className={labelClass}>{t('step1.specificLocationLabel')}</label>
        <LocationInput
          id={`${id}-location`}
          value={location}
          onChange={onLocationChange}
          emirate={emirate}
          placeholder={placeholder}
          icon={Icon}
          iconClassName={accent}
        />
      </div>
    </fieldset>
  );
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
      <RouteLeg
        id="pickup"
        title={t('step1.pickupTitle')}
        icon={MapPin}
        accent="text-brand-neon"
        emirate={pickupEmirate}
        onEmirateChange={updatePickupEmirate}
        location={formData.pickup_location ?? ''}
        onLocationChange={v => updateForm({ pickup_location: v })}
        placeholder={t('step1.pickupPlaceholder') as string}
      />
      <RouteLeg
        id="delivery"
        title={t('step1.deliveryTitle')}
        icon={Flag}
        accent="text-brand-blue"
        emirate={deliveryEmirate}
        onEmirateChange={updateDeliveryEmirate}
        location={formData.delivery_location ?? ''}
        onLocationChange={v => updateForm({ delivery_location: v })}
        placeholder={t('step1.deliveryPlaceholder') as string}
      />
    </motion.div>
  );
}
