import React from 'react';
import { MessageSquare, FileText, Download, PackageCheck, Repeat, CheckCircle2, Clock, Copy, ExternalLink, Undo2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar as arLocale } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useCanWrite, READ_ONLY_MESSAGE } from './permissions';
import { bucketOf, followUpWhatsApp, type FollowUp, type FollowUpBucket, type FollowUpKind, type FollowUpStateRow } from './followUps';

interface FollowUpsViewProps {
  items: FollowUp[];
  state: Map<string, FollowUpStateRow>;
  /** follow_up_state isn't in the database yet: show the queue, but done/snooze can't be saved. */
  stateMissing: boolean;
  onSave: (key: string, change: { status: 'done' | 'snoozed'; snoozed_until?: string | null } | null) => Promise<void>;
  onOpenQuote: (quoteId: string) => void;
  onOpenInquiry: (inquiryId: string) => void;
  onOpenJob: (jobId: string) => void;
}

const KIND_ICON: Record<FollowUpKind, any> = {
  quote: FileText,
  lead: Download,
  first: PackageCheck,
  repeat: Repeat,
};

const SNOOZE_DAYS = [1, 3, 7];

export function FollowUpsView({ items, state, stateMissing, onSave, onOpenQuote, onOpenInquiry, onOpenJob }: FollowUpsViewProps) {
  const { t, i18n } = useTranslation('dashboard');
  const dateLocale = i18n.language?.startsWith('ar') ? arLocale : undefined;
  const canWrite = useCanWrite();
  const [filter, setFilter] = React.useState<FollowUpBucket>('due');
  const [copied, setCopied] = React.useState<string | null>(null);
  const [snoozeOpen, setSnoozeOpen] = React.useState<string | null>(null);

  const now = Date.now();
  const buckets = React.useMemo(() => {
    const by: Record<FollowUpBucket, FollowUp[]> = { due: [], upcoming: [], snoozed: [], done: [] };
    for (const item of items) by[bucketOf(item, state.get(item.key), now)].push(item);
    return by;
    // `now` changes every render; the buckets only need to follow items and state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, state]);
  const visible = buckets[filter];

  const act = async (key: string, change: Parameters<FollowUpsViewProps['onSave']>[1]) => {
    if (!canWrite) { alert(READ_ONLY_MESSAGE); return; }
    setSnoozeOpen(null);
    try {
      await onSave(key, change);
    } catch (err: any) {
      alert(t('followUps.saveFailed', { message: err?.message || String(err) }));
    }
  };

  const copy = async (item: FollowUp) => {
    try {
      await navigator.clipboard.writeText(item.message);
      setCopied(item.key);
      setTimeout(() => setCopied(c => (c === item.key ? null : c)), 1500);
    } catch { /* clipboard blocked: nothing to do */ }
  };

  const open = (item: FollowUp) => {
    if (item.quoteId) onOpenQuote(item.quoteId);
    else if (item.inquiryId) onOpenInquiry(item.inquiryId);
    else if (item.jobId) onOpenJob(item.jobId);
  };

  return (
    <>
      <div className="page-actions">
        <div className="chips">
          {(['due', 'upcoming', 'snoozed', 'done'] as FollowUpBucket[]).map(b => (
            <button key={b} onClick={() => setFilter(b)} className={filter === b ? 'selected' : ''}>
              {t(`followUps.tabs.${b}`)} <b>{buckets[b].length}</b>
            </button>
          ))}
        </div>
      </div>

      {stateMissing && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 13 }}>{t('followUps.stateMissing')}</p>
        </div>
      )}

      {visible.length ? (
        <div className="card table-card alert-feed">
          {visible.map(item => {
            const Icon = KIND_ICON[item.kind];
            const wa = followUpWhatsApp(item);
            const row = state.get(item.key);
            return (
              <div key={item.key} className="alert-row">
                <span className="severity-info"><Icon size={18} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="alert-meta">
                    <span className="status" data-severity={item.kind === 'quote' ? 'warning' : 'info'}>
                      <i />
                      {t(`followUps.kinds.${item.kind}.label`)}
                    </span>
                    <small>
                      {filter === 'snoozed' && row?.snoozed_until
                        ? t('followUps.snoozedUntil', { when: formatDistanceToNow(new Date(row.snoozed_until), { addSuffix: true, locale: dateLocale }) })
                        : filter === 'upcoming'
                          ? t('followUps.dueIn', { when: formatDistanceToNow(new Date(item.dueAt), { addSuffix: true, locale: dateLocale }) })
                          : t('followUps.dueSince', { when: formatDistanceToNow(new Date(item.dueAt), { addSuffix: true, locale: dateLocale }) })}
                    </small>
                  </div>
                  <h3>{item.name}{item.company ? ` · ${item.company}` : ''}</h3>
                  <p>{t(`followUps.kinds.${item.kind}.why`, { count: item.count ?? 0 })}</p>
                  <p style={{ opacity: 0.8 }}>{item.detail}</p>
                  <p style={{ fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>“{item.message}”</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
                    {wa ? (
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <MessageSquare size={14} /> {t('followUps.whatsapp')}
                      </a>
                    ) : (
                      <small>{t('followUps.noNumber')}</small>
                    )}
                    <button onClick={() => copy(item)} className="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Copy size={14} /> {copied === item.key ? t('followUps.copied') : t('followUps.copy')}
                    </button>
                    {filter === 'done' || filter === 'snoozed' ? (
                      <button onClick={() => act(item.key, null)} className="secondary" disabled={stateMissing} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Undo2 size={14} /> {t('followUps.undo')}
                      </button>
                    ) : (
                      <>
                        <button onClick={() => act(item.key, { status: 'done' })} className="secondary" disabled={stateMissing} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle2 size={14} /> {t('followUps.done')}
                        </button>
                        <span style={{ position: 'relative' }}>
                          <button onClick={() => setSnoozeOpen(o => (o === item.key ? null : item.key))} className="secondary" disabled={stateMissing} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Clock size={14} /> {t('followUps.snooze')}
                          </button>
                          {snoozeOpen === item.key && (
                            <span className="card" style={{ position: 'absolute', top: '110%', insetInlineStart: 0, zIndex: 20, display: 'flex', flexDirection: 'column', padding: 6, minWidth: 140 }}>
                              {SNOOZE_DAYS.map(d => (
                                <button
                                  key={d}
                                  className="secondary"
                                  style={{ justifyContent: 'flex-start', marginBottom: 4 }}
                                  onClick={() => act(item.key, { status: 'snoozed', snoozed_until: new Date(Date.now() + d * 86_400_000).toISOString() })}
                                >
                                  {t('followUps.snoozeDays', { count: d })}
                                </button>
                              ))}
                            </span>
                          )}
                        </span>
                      </>
                    )}
                    <button onClick={() => open(item)} className="deep-link">
                      {t(`followUps.open.${item.kind}`)} <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <span><CheckCircle2 size={24} /></span>
          <h2>{t(`followUps.empty.${filter}.title`)}</h2>
          <p>{t(`followUps.empty.${filter}.body`)}</p>
        </div>
      )}
    </>
  );
}
