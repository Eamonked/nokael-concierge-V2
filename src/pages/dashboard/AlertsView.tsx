import React from 'react';
import { AlertTriangle, Radio, XCircle, WifiOff, CheckCircle2, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar as arLocale } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { Alert, AlertSeverity, AlertType } from './selectors';

interface AlertsViewProps {
  alerts: Alert[];
  onOpenJob: (jobId: string) => void;
}

const SEVERITY_CLASS: Record<AlertSeverity, string> = {
  critical: 'severity',
  warning: 'severity-warning',
  info: 'severity-info',
};

const TYPE_ICON: Record<AlertType, any> = {
  slaBreach: AlertTriangle,
  stalledJob: Radio,
  failedHandoff: XCircle,
  signalLost: WifiOff,
};

type FilterMode = 'open' | 'acknowledged' | 'all';

export function AlertsView({ alerts, onOpenJob }: AlertsViewProps) {
  const { t, i18n } = useTranslation('dashboard');
  const dateLocale = i18n.language?.startsWith('ar') ? arLocale : undefined;
  const [acknowledgedIds, setAcknowledgedIds] = React.useState<Set<string>>(new Set());
  const [filter, setFilter] = React.useState<FilterMode>('open');

  const openAlerts = alerts.filter(a => !acknowledgedIds.has(a.id));
  const acknowledgedAlerts = alerts.filter(a => acknowledgedIds.has(a.id));
  const visibleAlerts = filter === 'open' ? openAlerts : filter === 'acknowledged' ? acknowledgedAlerts : alerts;

  const acknowledge = (id: string) => {
    setAcknowledgedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };
  
  const acknowledgeAll = () => {
    setAcknowledgedIds(prev => {
      const next = new Set(prev);
      openAlerts.forEach(a => next.add(a.id));
      return next;
    });
  };

  const severityCounts = openAlerts.reduce(
    (acc, a) => {
      acc[a.severity] += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0 } as Record<AlertSeverity, number>
  );
  const maxSeverityCount = Math.max(severityCounts.critical, severityCounts.warning, severityCounts.info, 1);

  return (
    <>
      <div className="page-actions">
        <div className="chips">
          <button
            onClick={() => setFilter('open')}
            className={filter === 'open' ? 'selected' : ''}
          >
            {t('alerts.tabs.open')} <b>{openAlerts.length}</b>
          </button>
          <button
            onClick={() => setFilter('acknowledged')}
            className={filter === 'acknowledged' ? 'selected' : ''}
          >
            {t('alerts.tabs.acknowledged')} <b>{acknowledgedAlerts.length}</b>
          </button>
          <button
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'selected' : ''}
          >
            {t('alerts.tabs.all')}
          </button>
        </div>
        {openAlerts.length > 0 && (
          <button onClick={acknowledgeAll} className="secondary">
            {t('alerts.acknowledgeAll')}
          </button>
        )}
      </div>

      {visibleAlerts.length ? (
        <div className="alerts-layout">
          <div className="card table-card alert-feed">
            {visibleAlerts.map(alert => {
              const severityClass = SEVERITY_CLASS[alert.severity];
              const TypeIcon = TYPE_ICON[alert.type];
              const isAcknowledged = acknowledgedIds.has(alert.id);
              
              return (
                <div key={alert.id} className="alert-row">
                  <span className={severityClass}>
                    <TypeIcon size={18} />
                  </span>
                  <div>
                    <div className="alert-meta">
                      <span className="status" data-severity={alert.severity}>
                        <i />
                        {t(`alerts.severity.${alert.severity}`)}
                      </span>
                      <small>
                        {formatDistanceToNow(new Date(alert.detectedAt), { addSuffix: true, locale: dateLocale })}
                      </small>
                    </div>
                    <h3>{t(`alerts.types.${alert.type}.label`)}</h3>
                    <p>{t(`alerts.types.${alert.type}.desc`)}</p>
                    <button onClick={() => onOpenJob(alert.jobId)} className="deep-link">
                      #{alert.jobRef} <ExternalLink size={12} />
                    </button>
                  </div>
                  {!isAcknowledged && (
                    <button onClick={() => acknowledge(alert.id)} className="secondary" style={{ alignSelf: 'flex-start' }}>
                      {t('alerts.acknowledge')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <aside className="card response-card">
            <span className="eyebrow">{t('alerts.summary.eyebrow')}</span>
            <strong>{openAlerts.length}</strong>
            <h3>{t('alerts.summary.title')}</h3>
            <p>{t('alerts.summary.subtitle', { count: severityCounts.critical })}</p>
            <div className="response-bars">
              {(['critical', 'warning', 'info'] as AlertSeverity[]).map(sev => (
                <span key={sev}>
                  {t(`alerts.severity.${sev}`)} · {severityCounts[sev]}
                  <i style={{ width: `${(severityCounts[sev] / maxSeverityCount) * 100}%` }} />
                </span>
              ))}
            </div>
          </aside>
        </div>
      ) : (
        <div className="empty-state">
          <span>
            <CheckCircle2 size={24} />
          </span>
          <h2>{t('alerts.empty.title')}</h2>
          <p>{t('alerts.empty.body')}</p>
        </div>
      )}
    </>
  );
}
