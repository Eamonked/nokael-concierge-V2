import React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Mail, MessageSquare } from 'lucide-react';
import { submitBusinessInquiry, type BusinessInquiry } from '../lib/supabase';
import { getStoredUTMs, trackFormSubmission, trackWhatsAppClick } from '../lib/analytics';
import { WHATSAPP_NUMBER } from '../constants';

const SAMPLE_PDF = '/samples/nokael-sample-chain-of-custody.pdf';

// Lead magnet: a sample Chain of Custody certificate in exchange for contact details.
// Leads land in business_inquiries (Dashboard → Business tab, plus the Telegram alert),
// tagged in urgent_express_dedicated_needs so ops can tell them from account requests.
export default function CustodySampleForm({ source }: { source: string }) {
  const { t } = useTranslation('landingPages');
  const [form, setForm] = React.useState({ contact_person: '', company_name: '', email: '', phone_whatsapp: '' });
  const [status, setStatus] = React.useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      await submitBusinessInquiry({
        ...form,
        urgent_express_dedicated_needs: `Requested sample Chain of Custody certificate (${source})`,
        ...getStoredUTMs(),
      } as BusinessInquiry);
      trackFormSubmission({ email: form.email, phone_number: form.phone_whatsapp, first_name: form.contact_person });
      setStatus('done');
    } catch (err) {
      console.error('[Nokael] Sample certificate request failed:', err);
      setStatus('error');
    }
  };

  const input = 'w-full bg-brand-input border border-brand-input-border rounded-xl py-4 px-5 focus:outline-none focus:border-brand-neon/50 transition-all font-medium placeholder:text-brand-muted/40 text-brand-text';

  return (
    <div className="bg-brand-surface border border-brand-border rounded-3xl p-8 sm:p-12">
      <div className="w-10 h-10 rounded-xl bg-brand-neon/10 flex items-center justify-center mb-6">
        <Mail className="w-5 h-5 text-brand-neon" />
      </div>
      <h3 className="text-2xl font-display font-medium tracking-tight mb-3 text-brand-text">{t('custodySample.heading')}</h3>
      <p className="text-sm text-brand-muted leading-relaxed mb-8">{t('custodySample.body')}</p>

      {status === 'done' ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-brand-neon">{t('custodySample.thanks')}</p>
          <a href={SAMPLE_PDF} download className="btn-primary w-full py-4 justify-center">
            <Download className="w-5 h-5" />
            <span>{t('custodySample.download')}</span>
          </a>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick(`custody_sample_${source}`)}
            className="btn-secondary w-full py-4 justify-center"
          >
            <MessageSquare className="w-5 h-5" />
            <span>{t('custodySample.bookCta')}</span>
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required type="text" autoComplete="name" className={input} placeholder={t('custodySample.name') as string} value={form.contact_person} onChange={set('contact_person')} />
          <input required type="text" autoComplete="organization" className={input} placeholder={t('custodySample.company') as string} value={form.company_name} onChange={set('company_name')} />
          <input required type="email" autoComplete="email" className={input} placeholder={t('custodySample.email') as string} value={form.email} onChange={set('email')} />
          <input required type="tel" autoComplete="tel" className={input} placeholder={t('custodySample.phone') as string} value={form.phone_whatsapp} onChange={set('phone_whatsapp')} />
          {status === 'error' && <p className="text-sm text-red-400">{t('custodySample.error')}</p>}
          <button type="submit" disabled={status === 'sending'} className="btn-primary w-full py-4 justify-center disabled:opacity-60">
            <Download className="w-5 h-5" />
            <span>{status === 'sending' ? t('custodySample.sending') : t('custodySample.submit')}</span>
          </button>
          <p className="text-[11px] text-brand-muted leading-relaxed">{t('custodySample.privacy')}</p>
        </form>
      )}
    </div>
  );
}
