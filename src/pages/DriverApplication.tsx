import { AnimatePresence } from 'motion/react';
import { Truck } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDriverApplicationForm } from './driver-application/useDriverApplicationForm';
import { useDriverDocuments } from './driver-application/useDriverDocuments';
import ApplicationStepper from './driver-application/ApplicationStepper';
import ApplicationStepPersonalInfo from './driver-application/ApplicationStepPersonalInfo';
import ApplicationStepDocuments from './driver-application/ApplicationStepDocuments';
import ApplicationStepComplete from './driver-application/ApplicationStepComplete';

export default function DriverApplication() {
  const { t } = useTranslation('driverApplication');
  const navigate = useNavigate();

  const {
    step,
    setStep,
    isSubmitting,
    driverId,
    selectedDays,
    setSelectedDays,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    formData,
    setFormData,
    handleFormSubmit,
  } = useDriverApplicationForm();

  const { uploads, handleFileUpload, allUploaded, completeApplication } = useDriverDocuments(driverId, navigate);

  return (
    <div className="bg-brand-bg min-h-screen py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="inline-flex items-center space-x-3 px-4 py-2 rounded-lg bg-brand-neon/10 border border-brand-neon/20 text-brand-neon text-[10px] uppercase tracking-[0.3em] font-bold mb-8">
              <Truck className="w-3 h-3" />
              <span>{t('hero.badge')}</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-medium tracking-tighter text-brand-text mb-6">
              {t('hero.titleLine')} <span className="text-brand-neon italic">{t('hero.titleHighlight')}</span>
            </h1>
            <p className="text-lg text-brand-muted max-w-2xl mx-auto leading-relaxed">
              {t('hero.subtitle')}
            </p>
          </motion.div>
        </div>

        <div className="dispatch-card p-8 md:p-12">
          <ApplicationStepper step={step} />

          <AnimatePresence mode="wait">
            {step === 1 && (
              <ApplicationStepPersonalInfo
                formData={formData}
                setFormData={setFormData}
                selectedDays={selectedDays}
                setSelectedDays={setSelectedDays}
                startTime={startTime}
                setStartTime={setStartTime}
                endTime={endTime}
                setEndTime={setEndTime}
                isSubmitting={isSubmitting}
                onSubmit={handleFormSubmit}
              />
            )}

            {step === 2 && (
              <ApplicationStepDocuments
                uploads={uploads}
                onFileUpload={handleFileUpload}
                allUploaded={allUploaded}
                onBack={() => setStep(1)}
                onComplete={() => completeApplication(formData)}
              />
            )}

            {step === 3 && <ApplicationStepComplete />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
