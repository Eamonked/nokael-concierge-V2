import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertCircle, Upload, Loader2 } from 'lucide-react';
import { DOCUMENT_TYPES } from './constants';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface ApplicationStepDocumentsProps {
  uploads: Record<string, { file: File | null; status: UploadStatus }>;
  onFileUpload: (type: string, file: File) => void;
  allUploaded: boolean;
  onBack: () => void;
  onComplete: () => void;
}

export default function ApplicationStepDocuments({
  uploads,
  onFileUpload,
  allUploaded,
  onBack,
  onComplete,
}: ApplicationStepDocumentsProps) {
  const { t } = useTranslation('driverApplication');

  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {DOCUMENT_TYPES.map((doc) => (
          <div key={doc.id} className="dispatch-card p-6 border-brand-border/30 hover:border-brand-neon/50 transition-all duration-300 bg-brand-surface/20">
            <div className="flex items-start justify-between mb-6">
              <div className="w-12 h-12 rounded-xl bg-brand-neon/10 flex items-center justify-center text-brand-neon">
                <doc.icon className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-2">
                {uploads[doc.id].status === 'success' && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-brand-neon/10 text-brand-neon rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="text-[8px] font-black uppercase tracking-widest">{t('step2.verified')}</span>
                  </div>
                )}
                {uploads[doc.id].status === 'error' && (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>
            <h4 className="text-[10px] font-black text-brand-text uppercase tracking-[0.3em] mb-1">
              {t(`step2.documentTypes.${doc.i18nKey}.label`)}
            </h4>
            <p className="text-[9px] text-brand-muted uppercase tracking-widest mb-6">
              {t(`step2.documentTypes.${doc.i18nKey}.description`)}
            </p>

            <div className="relative">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileUpload(doc.id, file);
                }}
                disabled={uploads[doc.id].status === 'uploading'}
              />
              <div className={`flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-brand-border text-[10px] font-bold uppercase tracking-widest ${
                uploads[doc.id].status === 'uploading' ? 'bg-brand-surface animate-pulse' : 'hover:bg-brand-surface'
              }`}>
                {uploads[doc.id].status === 'uploading' ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>{t('step2.uploading')}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3 h-3" />
                    <span>{uploads[doc.id].status === 'success' ? t('step2.replaceFile') : t('step2.uploadFile')}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="btn-secondary flex-1 py-6 text-sm"
        >
          {t('step2.backButton')}
        </button>
        <button
          disabled={!allUploaded}
          onClick={onComplete}
          className="btn-primary flex-1 py-6 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('step2.completeButton')}
        </button>
      </div>
    </motion.div>
  );
}
