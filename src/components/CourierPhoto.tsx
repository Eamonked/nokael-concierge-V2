import { useTranslation } from 'react-i18next';

export type CourierPhotoVariant = 'about' | 'services' | 'business' | 'dubai' | 'abuDhabi' | 'document' | 'spareParts' | 'legal' | 'medical' | 'hr' | 'finance';

/** Each page selects its own generated scene; never silently reuse the hero. */
export default function CourierPhoto({ variant, priority = false }: { variant: CourierPhotoVariant; priority?: boolean }) {
  const { t } = useTranslation('common');
  const src = `/images/page-photos/nokael-${variant}`;
  return <figure className="courier-photo">
    <picture>
      <source media="(max-width: 640px)" srcSet={`${src}-768.jpg`} />
      <img src={`${src}-1280.jpg`} width="1280" height="960"
        alt={t(`images.pages.${variant}`)}
        loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} />
    </picture>
  </figure>;
}
