import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, Phone, Trash2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  type BusinessInquiry,
  type BusinessContact,
  type JobWithDriver,
  getJobsForBusiness,
  getBusinessContacts,
  deleteBusinessContact,
} from '../../../lib/supabase';
import { getEtaMinutes } from '../../../lib/eta';
import {
  getBusinessRenewalStatus,
  getMonthlyVolumeByMonth,
  getCompletionRate,
} from '../selectors';
import { WriteGuard, useCanWrite } from '../permissions';
import { ClientPortalAccess } from '../components/ClientPortalAccess';
import { ContactDrawer } from './ContactDrawer';

interface BusinessAccountDrawerProps {
  business: BusinessInquiry;
  onClose: () => void;
  onUpdate?: (id: string, updates: Partial<BusinessInquiry>) => void;
}

type TabType = 'Overview' | 'Job History' | 'Billing' | 'Contracts';

// A driver actively en route who hasn't reported a GPS ping in this long is
// treated as "Delayed" — mirrors the STALLED_AFTER_MS threshold used for
// dispatcher alerts elsewhere (selectors.ts), rather than a random guess.
const STALLED_AFTER_MS = 20 * 60 * 1000;

const IN_TRANSIT_STATUSES = ['client_pickup', 'driver_pickup', 'driver_delivery'];

// Generate initials from a full name — same pattern used throughout the dashboard.
const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

/**
 * Live ETA for a single job, computed on demand via Mapbox Directions —
 * never stored, since it depends on the driver's current position. Refetches
 * every 60s while the row is mounted (i.e. only while the drawer is open).
 */
function useJobEta(job: JobWithDriver): number | null {
  const [eta, setEta] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const fetchEta = async () => {
      let from: [number, number] | null = null;
      let to: [number, number] | null = null;

      if (
        job.status === 'driver_pickup' &&
        job.driver_lat != null && job.driver_lng != null &&
        job.pickup_lat != null && job.pickup_lng != null
      ) {
        from = [job.driver_lat, job.driver_lng];
        to = [job.pickup_lat, job.pickup_lng];
      } else if (
        job.status === 'driver_delivery' &&
        job.driver_lat != null && job.driver_lng != null &&
        job.delivery_lat != null && job.delivery_lng != null
      ) {
        from = [job.driver_lat, job.driver_lng];
        to = [job.delivery_lat, job.delivery_lng];
      }

      if (!from || !to) {
        if (!cancelled) setEta(null);
        return;
      }

      const minutes = await getEtaMinutes(from[0], from[1], to[0], to[1]);
      if (!cancelled) setEta(minutes);
    };

    fetchEta();
    const interval = setInterval(fetchEta, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, job.status, job.driver_lat, job.driver_lng, job.pickup_lat, job.pickup_lng, job.delivery_lat, job.delivery_lng]);

  return eta;
}

const ShipmentRow: React.FC<{ job: JobWithDriver }> = ({ job }) => {
  const etaMinutes = useJobEta(job);
  const etaLabel = etaMinutes != null ? `${etaMinutes} min` : '—';

  const isMovingLeg = job.status === 'driver_pickup' || job.status === 'driver_delivery';
  const isStalled = isMovingLeg && job.driver_updated_at
    ? Date.now() - new Date(job.driver_updated_at).getTime() > STALLED_AFTER_MS
    : false;
  const statusLabel = isStalled ? 'Delayed' : isMovingLeg ? 'In Transit' : 'On Schedule';

  const driverName = job.driver?.full_name || 'Unassigned';
  const driverInitials = job.driver?.full_name ? getInitials(job.driver.full_name) : '—';
  const ref = job.job_ref || job.id || '—';

  return (
    <div className="shipment-row">
      <div>
        <button>{ref}</button>
        <span>{job.pickup_location} → {job.delivery_location}</span>
      </div>
      <div className="person">
        <div className="avatar">{driverInitials}</div>
        <span>
          <b>{driverName}</b>
          <small>ETA: {etaLabel}</small>
        </span>
      </div>
      <div>
        <span className={`status-badge ${statusLabel === 'Delayed' ? 'warning' : 'success'}`}>
          <span className="status-badge-dot" />
          {statusLabel}
        </span>
      </div>
      <div>
        <button className="icon-action">
          <MapPin className="w-3 h-3" />
          Track
        </button>
        <button className="icon-action">Contact</button>
      </div>
    </div>
  );
};

export const BusinessAccountDrawer: React.FC<BusinessAccountDrawerProps> = ({
  business,
  onClose,
  onUpdate,
}) => {
  const { t } = useTranslation('dashboard');
  const [activeTab, setActiveTab] = useState<TabType>('Overview');
  const canWrite = useCanWrite();
  const setStatus = (status: BusinessInquiry['status']) => {
    if (business.id && status !== business.status) onUpdate?.(business.id, { status });
  };

  const [jobsForBusiness, setJobsForBusiness] = React.useState<JobWithDriver[]>([]);
  const [jobsLoading, setJobsLoading] = React.useState(true);
  const [contacts, setContacts] = React.useState<BusinessContact[]>([]);
  const [contactsLoading, setContactsLoading] = React.useState(true);
  const [addingContact, setAddingContact] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState<string | null>(null); // contact id
  const [deleting, setDeleting] = React.useState(false);
  const [contactError, setContactError] = React.useState<string | null>(null);
  const [accessVersion, setAccessVersion] = React.useState(0); // bumped when a contact is invited to the portal

  React.useEffect(() => {
    let cancelled = false;
    if (!business.id) {
      setJobsForBusiness([]);
      setJobsLoading(false);
      return;
    }
    setJobsLoading(true);
    getJobsForBusiness(business.id)
      .then((data) => { if (!cancelled) setJobsForBusiness(data); })
      .catch((err) => {
        console.error('[Nokael] Error fetching jobs for business:', err);
        if (!cancelled) setJobsForBusiness([]);
      })
      .finally(() => { if (!cancelled) setJobsLoading(false); });
    return () => { cancelled = true; };
  }, [business.id]);

  React.useEffect(() => {
    let cancelled = false;
    if (!business.id) {
      setContacts([]);
      setContactsLoading(false);
      return;
    }
    setContactsLoading(true);
    getBusinessContacts(business.id)
      .then((data) => { if (!cancelled) setContacts(data); })
      .catch((err) => {
        console.error('[Nokael] Error fetching business contacts:', err);
        if (!cancelled) setContacts([]);
      })
      .finally(() => { if (!cancelled) setContactsLoading(false); });
    return () => { cancelled = true; };
  }, [business.id]);

  const liveShipments = React.useMemo(
    () => jobsForBusiness.filter(j => IN_TRANSIT_STATUSES.includes(j.status)),
    [jobsForBusiness]
  );

  const renewal = getBusinessRenewalStatus(business);

  const volumeBuckets = React.useMemo(() => getMonthlyVolumeByMonth(jobsForBusiness), [jobsForBusiness]);
  const maxVolume = Math.max(1, ...volumeBuckets);
  const volumeBarHeights = volumeBuckets.map(v => (v > 0 ? Math.max(4, Math.round((v / maxVolume) * 100)) : 2));
  const currentMonthVolume = volumeBuckets[volumeBuckets.length - 1] || 0;
  const previousMonthVolume = volumeBuckets[volumeBuckets.length - 2] || 0;
  const volumeChangePct = previousMonthVolume > 0
    ? Math.round(((currentMonthVolume - previousMonthVolume) / previousMonthVolume) * 1000) / 10
    : (currentMonthVolume > 0 ? 100 : 0);
  const volumeTarget = business.monthly_volume_target || 200;

  const completionRate = React.useMemo(() => getCompletionRate(jobsForBusiness), [jobsForBusiness]);

  const handleOpenLiveMap = () => {
    console.log('Opening live map');
  };

  const handleDeleteContact = async (id: string) => {
    setDeleting(true);
    setContactError(null);
    try {
      await deleteBusinessContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
      setConfirmingDelete(null);
    } catch (err) {
      console.error('[Nokael] Error deleting business contact:', err);
      setContactError((err as Error).message || 'Could not delete the contact. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return createPortal(
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="account-drawer business-account-drawer">
        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-company">
            <div className="avatar" style={{ background: '#e2e8f0' }}>
              {getInitials(business.company_name)}
            </div>
            <div>
              <div className="business-eyebrow">BUSINESS ACCOUNT</div>
              <h2>{business.company_name}</h2>
              <div>
                <span className={`status-badge ${renewal.tone === 'warning' ? 'warning' : renewal.tone === 'success' ? 'success' : ''}`}>
                  <span className="status-badge-dot" />
                  {renewal.label}
                </span>
                <em> · {business.service_tier || 'Standard'}</em>
              </div>
            </div>
          </div>
          <div className="drawer-header-actions">
            {/* Account status: signups arrive as "pending" (Under Review) until approved here. */}
            {onUpdate && business.status === 'pending' && (
              <button className="dark-button" onClick={() => setStatus('active')} disabled={!canWrite}>
                <CheckCircle2 className="w-4 h-4" />
                {t('businessDrawer.activate', { defaultValue: 'Activate account' })}
              </button>
            )}
            {onUpdate && (
              <select
                className="drawer-status-select"
                value={business.status || 'pending'}
                onChange={e => setStatus(e.target.value as BusinessInquiry['status'])}
                disabled={!canWrite}
                aria-label={t('businessDrawer.statusLabel', { defaultValue: 'Account status' })}
              >
                <option value="pending">{t('businessDrawer.statusPending', { defaultValue: 'Under review' })}</option>
                <option value="active">{t('business.status.active')}</option>
                <option value="archived">{t('business.status.archived')}</option>
              </select>
            )}
            <button className="drawer-close-button" onClick={onClose} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="drawer-tabs">
          {(['Overview', 'Job History', 'Billing', 'Contracts'] as TabType[]).map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? 'active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Body */}
        <WriteGuard>
        <div className="drawer-body">
          {activeTab === 'Overview' && (
            <>
              {/* Live Operations */}
              <div className="drawer-section-title">
                <div>
                  <h3>Live operations</h3>
                  <p>{liveShipments.length} shipments currently in progress</p>
                </div>
                <button className="text-action" onClick={handleOpenLiveMap}>
                  Open Live Map
                </button>
              </div>

              <div className="live-shipments">
                {jobsLoading ? (
                  <p style={{ padding: '16px', fontSize: '13px', color: '#64748b' }}>Loading shipments…</p>
                ) : liveShipments.length === 0 ? (
                  <p style={{ padding: '16px', fontSize: '13px', color: '#64748b' }}>No shipments currently in progress.</p>
                ) : (
                  liveShipments.map((job) => <ShipmentRow key={job.id} job={job} />)
                )}
              </div>

              {/* Analytics */}
              <div className="analytics-grid">
                {/* Monthly Volume */}
                <div className="drawer-card">
                  <div className="drawer-card-head">
                    <span>Monthly volume</span>
                  </div>
                  <div className="drawer-card-head" style={{ marginTop: '8px' }}>
                    <b>{currentMonthVolume}</b>
                    <small> / {volumeTarget} target</small>
                  </div>
                  <div className="mini-bars">
                    {volumeBarHeights.map((height, i) => (
                      <i key={i} style={{ height: `${height}%` }} />
                    ))}
                  </div>
                  <p>{volumeChangePct >= 0 ? '+' : ''}{volumeChangePct}% compared with last month</p>
                </div>

                {/* SLA */}
                <div className="drawer-card sla-card">
                  <span>On-time completion</span>
                  <div>
                    <strong>{completionRate != null ? `${completionRate}%` : '—'}</strong>
                    <div className="sla-ring">
                      <i />
                    </div>
                  </div>
                  <p>
                    {completionRate != null
                      ? 'Completion rate across job history'
                      : 'No completed job history yet'}
                  </p>
                </div>
              </div>

              {/* Contact Directory */}
              <div className="drawer-section-title">
                <div>
                  <h3>Contact directory</h3>
                  <p>Operations and finance stakeholders</p>
                </div>
                <button className="text-action" onClick={() => setAddingContact(true)}>
                  Add contact
                </button>
              </div>

              <div className="contacts-list">
                {contactsLoading ? (
                  <p style={{ padding: '16px', fontSize: '13px', color: '#64748b' }}>Loading contacts…</p>
                ) : contacts.length === 0 ? (
                  <p style={{ padding: '16px', fontSize: '13px', color: '#64748b' }}>No contacts added yet.</p>
                ) : (
                  contacts.map((contact) => confirmingDelete === contact.id ? (
                    <div key={contact.id} className="contact-confirm">
                      <span>
                        <b>Delete {contact.name}?</b>
                        <small>This removes them from the contact directory. Any client portal access is kept.</small>
                      </span>
                      <button type="button" className="icon-action" onClick={() => setConfirmingDelete(null)} disabled={deleting}>
                        Cancel
                      </button>
                      <button type="button" className="icon-action danger" onClick={() => contact.id && handleDeleteContact(contact.id)} disabled={deleting}>
                        {deleting ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  ) : (
                    <div key={contact.id}>
                      <div className="avatar">{getInitials(contact.name)}</div>
                      <span>
                        <b>{contact.name}</b>
                        <small>{contact.role || '—'}{contact.department ? `  ·  ${contact.department}` : ''}</small>
                      </span>
                      <button
                        title="Call"
                        onClick={() => contact.phone && window.open(`tel:${contact.phone}`)}
                        disabled={!contact.phone}
                      >
                        <Phone className="w-3 h-3" />
                      </button>
                      <button
                        title="Email"
                        className="email-icon"
                        onClick={() => contact.email && window.open(`mailto:${contact.email}`)}
                        disabled={!contact.email}
                      >
                        @
                      </button>
                      <button
                        title="Delete contact"
                        aria-label={`Delete ${contact.name}`}
                        className="contact-delete"
                        onClick={() => { setContactError(null); setConfirmingDelete(contact.id ?? null); }}
                        disabled={!contact.id}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {contactError && <p className="client-access-notice error" role="alert">{contactError}</p>}

              {business.id && <ClientPortalAccess businessId={business.id} contacts={contacts} version={accessVersion} />}
            </>
          )}

          {activeTab !== 'Overview' && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              {activeTab} view coming soon...
            </div>
          )}
        </div>
        </WriteGuard>
      </div>

      {addingContact && business.id && (
        <ContactDrawer
          businessId={business.id}
          companyName={business.company_name}
          onClose={() => setAddingContact(false)}
          onSaved={(contact, invited) => {
            setContacts((prev) => [...prev, contact]);
            if (invited) setAccessVersion((v) => v + 1);
          }}
        />
      )}
    </>,
    document.body
  );
};
