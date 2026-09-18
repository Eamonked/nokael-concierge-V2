import { useTranslation } from 'react-i18next';
import { Zap, Navigation, MessageSquare } from 'lucide-react';
import { WHATSAPP_NUMBER } from '../../constants';
import { trackWhatsAppClick } from '../../lib/analytics';
import { type QuoteRequest } from '../../lib/supabase';

interface QuoteSidebarProps {
  formData: Partial<QuoteRequest>;
}

export default function QuoteSidebar({ formData }: QuoteSidebarProps) {
  const { t } = useTranslation('getQuote');

  return (
    <div className="hidden lg:block space-y-6">
      <div className="dispatch-card">
        <h4 className="text-xs font-bold uppercase tracking-widest mb-6 text-brand-muted">{t('sidebar.systemContext')}</h4>
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-brand-neon/10 flex items-center justify-center text-brand-neon">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold mb-1">{t('sidebar.directAssignmentTitle')}</p>
              <p className="text-[10px] text-brand-muted leading-relaxed">{t('sidebar.directAssignmentDesc')}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center text-brand-blue">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold mb-1">{t('sidebar.liveGpsTitle')}</p>
              <p className="text-[10px] text-brand-muted leading-relaxed">{t('sidebar.liveGpsDesc')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-brand-input border border-brand-input-border">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-4">{t('sidebar.urgentSupport')}</p>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppClick('quote_sidebar', {
            phone_number: formData.phone,
            first_name: formData.name
          })}
          className="flex items-center gap-3 text-brand-neon hover:underline text-sm font-bold"
        >
          <MessageSquare className="w-4 h-4" />
          <span>{t('sidebar.chatWithDispatch')}</span>
        </a>
      </div>
    </div>
  );
}
