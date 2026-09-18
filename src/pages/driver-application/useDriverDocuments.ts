import React from 'react';
import { useTranslation } from 'react-i18next';
import type { NavigateFunction } from 'react-router-dom';
import { uploadDriverDocument, type Driver } from '../../lib/supabase';

export function useDriverDocuments(driverId: string | null, navigate: NavigateFunction) {
  const { t } = useTranslation('driverApplication');

  const [uploads, setUploads] = React.useState<Record<string, { file: File | null, status: 'idle' | 'uploading' | 'success' | 'error' }>>({
    emirates_id: { file: null, status: 'idle' },
    license: { file: null, status: 'idle' },
    registration: { file: null, status: 'idle' },
    vehicle_photo: { file: null, status: 'idle' },
  });

  const handleFileUpload = async (type: string, file: File) => {
    if (!driverId) return;

    setUploads(prev => ({ ...prev, [type]: { ...prev[type], status: 'uploading' } }));

    const uploadData = new FormData();
    uploadData.append('file', file);

    const apiKey = import.meta.env.VITE_NOKAEL_API_KEY;

    try {
      const response = await fetch('/api/upload-driver-doc', {
        method: 'POST',
        headers: {
          ...(apiKey ? { 'x-nokael-key': apiKey } : {}),
        },
        body: uploadData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || errData.error || 'Upload failed');
      }

      const result = await response.json();

      await uploadDriverDocument({
        driver_id: driverId,
        document_type: type as any,
        file_url: result.file_url,
        drive_file_id: result.drive_file_id,
      });

      setUploads(prev => ({ ...prev, [type]: { file, status: 'success' } }));
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploads(prev => ({ ...prev, [type]: { ...prev[type], status: 'error' } }));
      alert(t('errors.uploadFailedPrefix') + error.message);
    }
  };

  const allUploaded = Object.values(uploads).every(u => (u as any).status === 'success');

  const completeApplication = (formData: Partial<Driver>) => {
    // This message goes to Nokael's own dispatch number, not the customer —
    // decision (A) "keep fixed" applies (see Phase 7 of the customer-facing
    // i18n plan), so this stays a plain template literal, not wired to t().
    const message = encodeURIComponent(`Hi Nokael, I've just submitted my driver application (Name: ${formData.full_name}).`);
    navigate(`/thank-you?wa=${message}`, {
      state: {
        userData: {
          email: formData.email,
          phone_number: formData.phone,
          first_name: formData.full_name,
        }
      }
    });
  };

  return { uploads, handleFileUpload, allUploaded, completeApplication };
}
