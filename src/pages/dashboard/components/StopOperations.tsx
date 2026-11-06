import React from 'react';
import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNow } from 'date-fns';
import { Check, CheckSquare, Copy, ExternalLink, Eye, Loader2, MapPin, MessageSquare } from 'lucide-react';
import { overrideJobStop, updateJob, currentStop, type JobStop, type JobWithDriver } from '../../../lib/supabase';
import { formatWindow } from '../../../lib/tenant';
import type { LinkView } from '../../../lib/dispatch';
import { noteLocalStageChange } from '../../../lib/jobStage';
import { VIEWING_NOW_MS } from '../../../lib/dispatch';

/* ------------------------------------------------------------------ */
/* Multi-stop / round-trip jobs in the job panel: the stop list, one   */
/* code per stop with its own override, and one WhatsApp row per       */
/* person (a contact with several stops gets one link and one message).*/
/* Replaces the parties / hand-offs / send sections of JobOperations.  */
/* ------------------------------------------------------------------ */

const COC_DOMAIN = (import.meta.env.VITE_COC_URL || 'https://nokael.ae').replace(/\/$/, '');
const DRIVER_APP_URL = `${COC_DOMAIN}/driver-app/`;
const MAX_OTP_ATTEMPTS = 5;

type Run = (key: string, action: () => Promise<unknown>, success: string, errorKey: string) => Promise<boolean>;

export const stopKindLabel = (s: Pick<JobStop, 'kind'>) => (s.kind === 'pickup' ? 'Pickup' : 'Drop-off');

const stopStatus = (s: JobStop): 'handed' | 'arrived' | 'pending' =>
  s.handed_at ? 'handed' : s.arrived_at ? 'arrived' : 'pending';

export function StopOperations({
  job, run, busy, onUpdate, views,
}: {
  job: JobWithDriver;
  run: Run;
  busy: string | null;
  onUpdate: () => void | Promise<void>;
  views: { sender?: LinkView; recipient?: LinkView };
}) {
  const { t } = useTranslation('dashboard');
  const stops = job.stops ?? [];
  const next = currentStop(job);
  const closed = ['completed', 'cancelled', 'returned'].includes(job.status);
  const isRound = job.job_kind === 'round_trip';
  const [copied, setCopied] = React.useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    window.setTimeout(() => setCopied(c => (c === key ? null : c)), 1600);
  };
  const Spin = ({ on, icon }: { on: boolean; icon: React.ReactNode }) => (on ? <Loader2 className="animate-spin" /> : <>{icon}</>);
  const when = (iso?: string | null) => (iso ? format(new Date(iso), 'd MMM, HH:mm') : '');

  // ── One row per person (stops that share a link token) ─────────────────────
  const people = React.useMemo(() => {
    const byToken = new Map<string, JobStop[]>();
    stops.forEach(s => {
      const key = s.token ?? s.id ?? String(s.seq);
      byToken.set(key, [...(byToken.get(key) ?? []), s]);
    });
    return [...byToken.entries()].map(([token, list]) => ({ token, list, first: list[0] }));
  }, [stops]);

  const trackUrl = (token: string) => `${COC_DOMAIN}/${token}/track`;
  const ref = `Job #${job.job_ref}`;

  const personMessage = (list: JobStop[]) => {
    const name = list[0].contact_name || 'there';
    const lines = list.map(s => {
      const w = formatWindow(s.window_start, s.window_end);
      return [
        `Stop ${s.seq} of ${stops.length} — ${s.kind === 'pickup' ? 'pickup from you' : 'delivery to you'} at ${s.address}${w ? ` (${w})` : ''}`,
        s.item_note ? `  Item: ${s.item_note}` : '',
        s.otp && !s.handed_at ? `  Your code: ${s.otp} — give it to the driver only when you ${s.kind === 'pickup' ? 'hand over' : 'receive'} the item.` : '',
      ].filter(Boolean).join('\n');
    });
    return [
      `Hi ${name}, here are your Nokael stops for ${ref}${isRound ? ' (round trip)' : ''}:`,
      ...lines,
      '',
      `Track it live: ${trackUrl(list[0].token!)}`,
    ].join('\n');
  };

  const driverMessage = () => [
    `New ${isRound ? 'round-trip' : 'multi-stop'} job assigned — ${ref} (${stops.length} stops)`,
    ...stops.map(s => {
      const w = formatWindow(s.window_start, s.window_end);
      return `${s.seq}. ${stopKindLabel(s)}: ${s.address}${s.emirate ? `, ${s.emirate}` : ''}${w ? ` · ${w}` : ''}${s.item_note ? ` · ${s.item_note}` : ''}`;
    }),
    '',
    `Open the Nokael Driver app (version 1.1 or newer) and go online to start it.`,
    'Each stop’s contact gives you their own code at the hand-off.',
  ].join('\n');

  const openWhatsApp = (phone: string, message: string) =>
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');

  const sendPerson = (token: string, list: JobStop[]) => {
    const phone = list[0].contact_phone || '';
    openWhatsApp(phone, personMessage(list));
    const flag = token === job.token_client_pickup ? { sender_notified: true }
      : token === job.token_client_delivery ? { recipient_notified: true } : null;
    if (flag) updateJob(job.id!, flag).then(() => onUpdate()).catch(() => {});
  };
  const sendDriver = () => {
    openWhatsApp(job.driver?.phone || '', driverMessage());
    updateJob(job.id!, { driver_notified: true }).then(() => onUpdate()).catch(() => {});
  };

  const seen = (token: string, list: JobStop[]): { text: string; live: boolean } | null => {
    const v: LinkView | undefined = token === job.token_client_pickup ? views.sender
      : token === job.token_client_delivery ? views.recipient : undefined;
    const last = v?.last_seen_at ?? list.map(s => s.last_seen_at).filter(Boolean).sort().pop();
    if (!last) return null;
    const ms = new Date(last).getTime();
    if (Date.now() - ms < VIEWING_NOW_MS) return { text: t('jobDetailModal.share.viewingNow', { defaultValue: 'Viewing now' }), live: true };
    return { text: t('jobDetailModal.share.lastSeen', { defaultValue: 'Last seen {{ago}}', ago: formatDistanceToNow(ms, { addSuffix: true }) }), live: false };
  };

  return (
    <>
      {/* ── Stops ──────────────────────────────────────────────────────────── */}
      <section className="jo-section">
        <div className="jo-section-head">
          <h3>{isRound ? t('stops.roundTitle', { defaultValue: 'Round trip stops' }) : t('stops.multiTitle', { defaultValue: 'Stops, in order' })}</h3>
          <span className="jw-tag">{t('stops.codePerStop', { defaultValue: 'One code per stop' })}</span>
        </div>
        <ol className="jo-steps jo-stops">
          {stops.map(s => {
            const status = stopStatus(s);
            const isNext = next?.id === s.id && !closed;
            const locked = (s.otp_attempts ?? 0) >= MAX_OTP_ATTEMPTS && !s.handed_at;
            return (
              <li key={s.id} className={`${status === 'handed' ? 'done' : ''}${isNext ? ' is-next' : ''}`}>
                <span className="jo-step-mark">{status === 'handed' ? <Check /> : s.seq}</span>
                <div className="jo-step-main">
                  <b>{s.seq}. {stopKindLabel(s)}{s.contact_name ? ` · ${s.contact_name}` : ''}</b>
                  <small><MapPin className="jo-inline-icon" /> {[s.emirate, s.address].filter(Boolean).join(' · ')}</small>
                  {(s.building || s.company) && <small>{[s.building, s.company].filter(Boolean).join(' · ')}</small>}
                  {formatWindow(s.window_start, s.window_end) && <small>{t('jobDetailModal.details.window', { defaultValue: 'Window' })}: {formatWindow(s.window_start, s.window_end)}</small>}
                  {s.item_note && <small>{t('stops.item', { defaultValue: 'Item' })}: {s.item_note}</small>}
                  {s.notes && <small className="jo-party-notes">{s.notes}</small>}
                  <small>
                    {status === 'handed'
                      ? `${t('stops.handedAt', { defaultValue: 'Handed over' })} ${when(s.handed_at)}${s.method === 'ops_override' ? ` · ${t('stops.byDispatch', { defaultValue: 'marked by dispatch' })}` : ` · ${t('stops.byCode', { defaultValue: 'code verified' })}`}${s.handed_lat != null ? ` · GPS ${s.handed_lat.toFixed(5)}, ${s.handed_lng?.toFixed(5)}` : ''}`
                      : status === 'arrived'
                        ? `${t('stops.arrivedAt', { defaultValue: 'Driver arrived' })} ${when(s.arrived_at)}`
                        : isNext ? t('stops.next', { defaultValue: 'Next stop' }) : t('stops.waiting', { defaultValue: 'Waiting' })}
                    {locked && ` · ${t('stops.locked', { defaultValue: 'code entry locked' })}`}
                  </small>
                  <div className="jo-inline">
                    <span className="jo-stop-code">
                      {t('stops.code', { defaultValue: 'Code' })} <b>{s.otp}</b>
                      <button type="button" className="jo-icon" onClick={() => copy(`code-${s.id}`, s.otp || '')} title="Copy code" aria-label="Copy code">
                        {copied === `code-${s.id}` ? <Check /> : <Copy />}
                      </button>
                    </span>
                    {isNext && status === 'pending' && (
                      <button type="button" className="jo-btn" disabled={!!busy}
                        onClick={() => run(`arrive-${s.id}`, () => { noteLocalStageChange(job.id!); return overrideJobStop(job.id!, s.id!, 'arrive'); }, t('stops.toastArrived', { defaultValue: 'Arrival recorded' }), 'jobDetailModal.errors.cocStep')}>
                        <Spin on={busy === `arrive-${s.id}`} icon={<MapPin />} />{t('stops.markArrived', { defaultValue: 'Mark arrived' })}
                      </button>
                    )}
                    {isNext && (
                      <button type="button" className="jo-btn warn" disabled={!!busy}
                        onClick={() => {
                          if (!window.confirm(t('stops.confirmOverride', { defaultValue: 'Mark stop {{n}} as handed over without the code? It shows on the certificate as marked by dispatch.', n: s.seq }))) return;
                          void run(`hand-${s.id}`, () => { noteLocalStageChange(job.id!); return overrideJobStop(job.id!, s.id!, 'handover'); }, t('stops.toastHanded', { defaultValue: 'Stop marked as handed over' }), 'jobDetailModal.errors.cocStep');
                        }}>
                        <Spin on={busy === `hand-${s.id}`} icon={<CheckSquare />} />{t('stops.markHanded', { defaultValue: 'Override: handed over' })}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ── Send to each person ───────────────────────────────────────────── */}
      <section className="jo-section">
        <h3>{t('jobDetailModal.share.title', { defaultValue: 'Send job details' })}</h3>
        <ul className="jo-share">
          {people.map(({ token, list, first }) => {
            const sent = token === job.token_client_pickup ? job.sender_notified : token === job.token_client_delivery ? job.recipient_notified : undefined;
            const s = seen(token, list);
            return (
              <li key={token} className={sent ? 'sent' : ''}>
                <div className="jo-share-who">
                  <small>{t('stops.stopsLabel', { defaultValue: 'Stop {{list}}', list: list.map(x => x.seq).join(', ') })}</small>
                  <b>{first.contact_name || first.company || '—'}</b>
                  {first.contact_phone && <span>{first.contact_phone}</span>}
                  {s && <em className={`jo-share-seen${s.live ? ' live' : ''}`}><Eye />{s.text}</em>}
                </div>
                {sent !== undefined && (
                  <span className={`jo-share-status${sent ? ' sent' : ''}`}>
                    {sent ? <><Check />{t('jobDetailModal.share.sent', { defaultValue: 'Sent' })}</> : t('jobDetailModal.share.notSent', { defaultValue: 'Not sent' })}
                  </span>
                )}
                <div className="jo-share-actions">
                  <button type="button" className="jo-icon" onClick={() => copy(`link-${token}`, trackUrl(token))} title={t('jobDetailModal.verification.copyLinkTitle')} aria-label={t('jobDetailModal.verification.copyLinkTitle')}>
                    {copied === `link-${token}` ? <Check /> : <Copy />}
                  </button>
                  <a className="jo-icon" href={`${trackUrl(token)}?staff=1`} target="_blank" rel="noopener noreferrer" title={t('jobDetailModal.tracking.open', { defaultValue: 'Open tracking page' })}>
                    <ExternalLink />
                  </a>
                  <button type="button" className="jo-btn jo-share-send" disabled={!first.contact_phone} onClick={() => sendPerson(token, list)}>
                    <MessageSquare />{sent ? t('jobDetailModal.share.resend', { defaultValue: 'Resend' }) : t('jobDetailModal.share.send', { defaultValue: 'WhatsApp' })}
                  </button>
                </div>
              </li>
            );
          })}
          <li className={job.driver_notified ? 'sent' : ''}>
            <div className="jo-share-who">
              <small>{t('jobDetailModal.share.driver', { defaultValue: 'Driver' })}</small>
              <b>{job.driver?.full_name || '—'}</b>
              {job.driver?.phone && <span>{job.driver.phone}</span>}
            </div>
            <span className={`jo-share-status${job.driver_notified ? ' sent' : ''}`}>
              {job.driver_notified ? <><Check />{t('jobDetailModal.share.sent', { defaultValue: 'Sent' })}</> : t('jobDetailModal.share.notSent', { defaultValue: 'Not sent' })}
            </span>
            <div className="jo-share-actions">
              <a className="jo-icon" href={DRIVER_APP_URL} target="_blank" rel="noopener noreferrer"><ExternalLink /></a>
              <button type="button" className="jo-btn jo-share-send" disabled={!job.driver?.phone} onClick={sendDriver}>
                <MessageSquare />{job.driver_notified ? t('jobDetailModal.share.resend', { defaultValue: 'Resend' }) : t('jobDetailModal.share.send', { defaultValue: 'WhatsApp' })}
              </button>
            </div>
          </li>
        </ul>
      </section>
    </>
  );
}
