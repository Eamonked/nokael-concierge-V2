import React from 'react';
import { createPortal } from 'react-dom';
import { PhoneCall, CircleSlash, Trash2 } from 'lucide-react';
import type { QuoteRequest } from '../../lib/supabase';
import { formatDate, formatDateTime, quoteExpiresAt } from './utils';
import { Icon } from './components/Icon';
import { Avatar } from './components/Avatar';
import { Search } from './components/Search';
import { DateRangeSelector, useDateRange } from './components/DateRangeSelector';
import { StatCards } from './components/StatCards';
import { Corridor } from './components/Corridor';
import { Status } from './components/StatusBadge';
import { useTranslation } from 'react-i18next';

type QuoteFilter = 'Active' | 'All' | 'Pending' | 'Contacted' | 'Converted' | 'Lost';
const QUOTE_FILTERS: QuoteFilter[] = ['Active', 'All', 'Pending', 'Contacted', 'Converted', 'Lost'];

function padStat(value: number) {
  return String(value).padStart(2, '0');
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '—'
  );
}

function statusLabel(status?: QuoteRequest['status']) {
  if (status === 'completed') return 'Converted';
  if (status === 'contacted') return 'Contacted';
  if (status === 'lost') return 'Lost';
  return 'Pending';
}

function matchesFilter(request: QuoteRequest, filter: QuoteFilter) {
  const status = request.status || 'pending';
  if (filter === 'All') return true;
  if (filter === 'Active') return status === 'pending' || status === 'contacted';
  if (filter === 'Converted') return status === 'completed';
  if (filter === 'Lost') return status === 'lost';
  if (filter === 'Pending') return status === 'pending';
  if (filter === 'Contacted') return status === 'contacted';
  return true;
}

function requestDetails(request: QuoteRequest) {
  const item = (request.item_type || '').replace(/_/g, ' ');
  const urgency = request.urgency || '';
  return [item, urgency].filter(Boolean).join(' · ');
}

function QuoteRowMenu({
  request,
  onStatusUpdate,
  onMarkLost,
  onDelete,
}: {
  request: QuoteRequest;
  onStatusUpdate: (id: string, status: QuoteRequest['status']) => void;
  onMarkLost: (quote: QuoteRequest) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation('dashboard');
  const [pos, setPos] = React.useState<React.CSSProperties | null>(null);
  const open = pos !== null;
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();

  const close = React.useCallback((restoreFocus = false) => {
    setPos(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // The table card clips overflow, so the panel is portaled to <body> and
  // pinned to the trigger with fixed positioning. It opens upward when the
  // row is near the bottom of the viewport, and anchors to the inline-end
  // edge of the trigger in both LTR and RTL.
  const toggle = () => {
    if (open) return close();
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const openUp = window.innerHeight - r.bottom < 200;
    const rtl = !!trigger.closest('[dir="rtl"]');
    setPos({
      ...(openUp ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
      ...(rtl ? { left: r.left } : { right: window.innerWidth - r.right }),
    });
  };

  React.useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    // A fixed panel would drift away from its row on scroll; close it instead.
    const onScroll = (event: Event) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      close();
    };
    const onResize = () => close();
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close]);

  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') {
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
    }
  };

  const id = request.id;
  if (!id) return null;

  const run = (action: () => void) => () => {
    close();
    action();
  };
  const canContact = request.status === 'pending';
  const canLose = request.status !== 'lost' && request.status !== 'completed';

  return (
    <span className="row-menu">
      <button
        ref={triggerRef}
        type="button"
        className={open ? 'active' : undefined}
        title={t('quotes.more')}
        aria-label={t('quotes.more')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
      >
        <Icon name="more" />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label={t('quotes.more')}
          className="row-menu-panel"
          style={pos}
          onKeyDown={onPanelKeyDown}
        >
          {(canContact || canLose) && (
            <div className="row-menu-group" role="group">
              {canContact && (
                <button type="button" role="menuitem" onClick={run(() => onStatusUpdate(id, 'contacted'))}>
                  <PhoneCall aria-hidden="true" />
                  <span>{t('quotes.markContacted')}</span>
                </button>
              )}
              {canLose && (
                <button type="button" role="menuitem" onClick={run(() => onMarkLost(request))}>
                  <CircleSlash aria-hidden="true" />
                  <span>{t('quotes.markLost')}</span>
                </button>
              )}
            </div>
          )}
          {(canContact || canLose) && <div className="row-menu-divider" role="separator" />}
          <div className="row-menu-group" role="group">
            <button type="button" role="menuitem" className="danger" onClick={run(() => onDelete(id))}>
              <Trash2 aria-hidden="true" />
              <span>{t('quotes.delete')}</span>
            </button>
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}

export function QuotesView({
  requests,
  onStatusUpdate,
  onReopenQuote,
  onConvertToJob,
  onMarkLost,
  onDelete,
  onNewQuote,
}: {
  requests: QuoteRequest[];
  onStatusUpdate: (id: string, status: QuoteRequest['status']) => void;
  onReopenQuote: (id: string) => void;
  onConvertToJob: (quote: QuoteRequest) => void;
  onMarkLost: (quote: QuoteRequest) => void;
  onDelete: (id: string) => void;
  onNewQuote: () => void;
}) {
  const { t } = useTranslation('dashboard');
  const [filter, setFilter] = React.useState<QuoteFilter>('Active');
  const [search, setSearch] = React.useState('');
  const dateRange = useDateRange();
  const query = search.trim().toLowerCase();

  const ranged = requests.filter((request) => {
    if (!request.created_at) return true;
    return dateRange.includes(request.created_at);
  });

  const visible = ranged
    .filter((request) => matchesFilter(request, filter))
    .filter((request) => {
      if (!query) return true;
      const haystack = [
        request.tracking_id,
        request.id,
        request.name,
        request.company_name,
        request.phone,
        request.pickup_location,
        request.delivery_location,
        request.corporate_code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });

  const pendingCount = visible.filter((request) => (request.status || 'pending') === 'pending').length;
  const convertedCount = visible.filter((request) => request.status === 'completed').length;

  return (
    <>
      {/* Enhanced toolbar with better spacing */}
      <div className="page-actions quote-request-toolbar">
        <div className="chips">
          {QUOTE_FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? 'selected' : ''}
              onClick={() => setFilter(item)}
            >
              {t(`quotes.chips.${item.toLowerCase()}`)}
            </button>
          ))}
        </div>
        <div className="quote-request-search">
          <Search
            value={search}
            onChange={setSearch}
            placeholder={t('quotes.searchPlaceholder')}
          />
          <DateRangeSelector range={dateRange} />
          <button className="primary" type="button" onClick={onNewQuote}>
            <Icon name="plus" size={14} />
            {t('quotes.new')}
          </button>
        </div>
      </div>

      {/* Stats with improved visual hierarchy */}
      <StatCards
        items={[
          {
            label: t('quotes.stats.open'),
            value: padStat(visible.length),
            note: `${dateRange.preset} · ${t('quotes.stats.selectedRange')}`,
            hero: true,
          },
          {
            label: t('quotes.stats.awaiting'),
            value: padStat(pendingCount),
            note: t('quotes.stats.pendingNote'),
          },
          {
            label: t('quotes.stats.converted'),
            value: padStat(convertedCount),
            note: t('quotes.stats.convertedNote'),
          },
          {
            label: t('quotes.stats.response'),
            value: '8m',
            note: t('quotes.stats.responseNote'),
          },
        ]}
      />

      {/* Enhanced table with refined spacing and borders */}
      <div className="table-card">
        <div className="table-head quote-requests-grid">
          <span>{t('quotes.table.requestId')}</span>
          <span>{t('quotes.table.customer')}</span>
          <span>{t('quotes.table.route')}</span>
          <span>{t('quotes.table.status')}</span>
          <span>{t('quotes.table.requested')}</span>
          <span>{t('quotes.table.expires')}</span>
          <span>{t('quotes.table.actions')}</span>
        </div>
        {visible.map((request, i) => {
          const requestedAt = request.created_at || '';
          const expiresAt = quoteExpiresAt(request.created_at);
          const ref = request.tracking_id || request.id || '—';
          const customer = request.company_name || request.name;
          return (
            <div className="table-row quote-requests-grid" key={request.id || ref}>
              <span>
                <b className="mono">{ref}</b>
                <small className="request-details">{requestDetails(request)}</small>
              </span>
              <span className="person">
                <Avatar initials={initials(customer)} tone={i} />
                {customer}
              </span>
              <Corridor from={request.pickup_location} to={request.delivery_location} compact />
              <Status>{statusLabel(request.status)}</Status>
              <time
                className="date-cell"
                dateTime={requestedAt}
                title={requestedAt ? `Requested: ${formatDateTime(requestedAt)}` : undefined}
              >
                {requestedAt ? formatDate(requestedAt) : '—'}
              </time>
              <time
                className="date-cell"
                dateTime={expiresAt}
                title={`Expires: ${formatDateTime(expiresAt)}`}
              >
                {formatDate(expiresAt)}
              </time>
              <span className="row-actions">
                <a
                  href={`https://wa.me/${(request.phone || '').replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t('quotes.whatsapp')}
                >
                  <Icon name="phone" />
                </a>
                {request.status === 'lost' ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => request.id && onReopenQuote(request.id)}
                  >
                    {t('quotes.reopenRequest')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onConvertToJob(request)}
                    disabled={request.status === 'completed'}
                    title={request.status === 'completed' ? t('quotes.convertedTitle') : t('quotes.createJobTitle')}
                  >
                    {t('quotes.viewRequest')}
                  </button>
                )}
                <QuoteRowMenu
                  request={request}
                  onStatusUpdate={onStatusUpdate}
                  onMarkLost={onMarkLost}
                  onDelete={onDelete}
                />
              </span>
            </div>
          );
        })}
        {!visible.length && (
          <div className="table-empty">{t('quotes.empty')}</div>
        )}
      </div>
    </>
  );
}
