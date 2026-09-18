import React from 'react';
import { useTranslation } from 'react-i18next';
import { submitDriverApplication, type Driver } from '../../lib/supabase';
import { DAYS_OF_WEEK } from './constants';

export function useDriverApplicationForm() {
  const { t } = useTranslation('driverApplication');
  const [step, setStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [driverId, setDriverId] = React.useState<string | null>(null);

  // Availability structure
  const [selectedDays, setSelectedDays] = React.useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [startTime, setStartTime] = React.useState('08:00');
  const [endTime, setEndTime] = React.useState('20:00');

  const [formData, setFormData] = React.useState<Partial<Driver>>({
    full_name: '',
    phone: '',
    whatsapp: '',
    email: '',
    base_location: '',
    vehicle_type: 'Sedan',
    inter_emirate: true,
    availability_hours: '',
  });

  // Re-calculate availability string whenever days or times change
  React.useEffect(() => {
    const daysStr = selectedDays.map(id => DAYS_OF_WEEK.find(d => d.id === id)?.label).join(', ');
    setFormData(prev => ({
      ...prev,
      availability_hours: `${daysStr} | ${startTime} - ${endTime}`
    }));
  }, [selectedDays, startTime, endTime]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const driver = await submitDriverApplication(formData as Driver);

      setDriverId(driver.id!);
      setStep(2);
    } catch (error) {
      console.error('Error submitting application:', error);
      alert(t('errors.submitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
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
  };
}
