import React from 'react';
import { Search, Phone, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import type { Driver, DriverPresence } from '../../lib/supabase';
import type { DriverPoolSummary } from './selectors';
import { DriverAppAdoption } from './components/DriverAppAdoption';
import {
  telLink,
  whatsappLink,
  driverWhatsapp,
  isStandby,
  driversToVCard,
  downloadText,
} from '../../lib/driverContact';

interface DriversViewProps {
  driverPoolSummary: DriverPoolSummary;
  filteredDrivers: Driver[];
  /** Live presence from the driver app, keyed by driver id (get_driver_presence). */
  driverPresence?: Record<string, DriverPresence>;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  filterVehicle: string;
  setFilterVehicle: (v: string) => void;
  onDriverStatusUpdate: (id: string, updates: Partial<Driver>) => void;
  onViewDriver: (id: string) => void;
  onAddAgent: () => void;
  orgId?: string | null;
}

export function DriversView({
  driverPoolSummary,
  filteredDrivers,
  driverPresence = {},
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  filterVehicle,
  setFilterVehicle,
  onDriverStatusUpdate,
  onViewDriver,
  onAddAgent,
  orgId,
}: DriversViewProps) {
  const { t } = useTranslation('dashboard');
  
  // "Online" comes from the driver app itself (GPS / app activity), not from
  // drivers.status, which only tracks whether they are on a job.
  const presenceOf = (d: Driver) => driverPresence[d.id!]?.presence ?? 'offline';
  const PRESENCE_FILTERS = ['online', 'app_open', 'offline', 'on_job'];
  const visibleDrivers = filterStatus === 'standby'
    ? filteredDrivers.filter(isStandby)
    : !PRESENCE_FILTERS.includes(filterStatus)
      ? filteredDrivers
      : filteredDrivers.filter(d => filterStatus === 'on_job' ? d.status === 'on_job' : presenceOf(d) === filterStatus);

  // Row selection for bulk actions. Only ids still visible count, so changing
  // a filter never exports people you can't see.
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const selectedDrivers = visibleDrivers.filter(d => selectedIds.has(d.id!));
  const allVisibleSelected = visibleDrivers.length > 0 && selectedDrivers.length === visibleDrivers.length;
  const toggleSelected = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAllVisible = () =>
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleDrivers.map(d => d.id!)));

  const exportContacts = (list: Driver[]) => {
    if (list.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`nokael-drivers-${stamp}.vcf`, driversToVCard(list), 'text/vcard');
  };

  // wa.me cannot message several people at once, so this copies one number per
  // line for pasting into WhatsApp Business / a spreadsheet.
  const copyNumbers = async (list: Driver[]) => {
    const lines = list.map(d => `${d.full_name}\t${driverWhatsapp(d)}`).join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      alert(`Copied ${list.length} WhatsApp number${list.length === 1 ? '' : 's'}.`);
    } catch {
      window.prompt('Copy these numbers:', lines);
    }
  };

  // Calculate metrics
  const totalFleet = filteredDrivers.length;
  const activeAgents = filteredDrivers.filter(d => presenceOf(d) === 'online').length;
  const pendingAgents = filteredDrivers.filter(d => d.pipeline_status === 'Screening' || d.pipeline_status === 'Docs Pending').length;
  const slaWarning = filteredDrivers.filter(d => d.status === 'on_job').length;

  const lastSeenOf = (d: Driver) => {
    const p = driverPresence[d.id!];
    const times = [p?.location_at, p?.app_last_seen_at].filter(Boolean) as string[];
    if (times.length === 0) return null;
    const latest = times.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
    return formatDistanceToNow(new Date(latest), { addSuffix: true });
  };
  
  return (
    <>
      {/* Top actions bar */}
      <div className="enterprise-actions">
        <div>
          <span className="record-count">
            {totalFleet} agents across 7 emirates
          </span>
        </div>
        <div>
          <button
            className="outline-button"
            onClick={() => exportContacts(visibleDrivers)}
            title="Download these drivers as phone contacts (.vcf). Import on the dispatch phone so WhatsApp broadcast lists can reach them."
          >
            Save to phone contacts
          </button>
          <button className="dark-button" onClick={onAddAgent}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3v14M3 10h14" />
            </svg>
            Add Agent
          </button>
        </div>
      </div>
      
      {/* Metric filter buttons */}
      <div className="metric-filters">
        <button
          className={filterStatus === 'all' ? 'selected' : ''}
          onClick={() => setFilterStatus('all')}
        >
          <span>Total Fleet</span>
          <strong>{totalFleet}</strong>
          <small>All registered agents</small>
        </button>
        <button
          className={filterStatus === 'online' ? 'selected' : ''}
          onClick={() => setFilterStatus('online')}
        >
          <span>Online now</span>
          <strong>{activeAgents}</strong>
          <small>Sharing live location</small>
        </button>
        <button
          className={slaWarning > 0 ? '' : ''}
          onClick={() => setFilterStatus('on_job')}
        >
          <span>SLA Warning</span>
          <strong>{String(slaWarning).padStart(2, '0')}</strong>
          <small>Immediate action required</small>
        </button>
        <button
          className={filterStatus === 'Screening' || filterStatus === 'Docs Pending' ? 'selected' : ''}
          onClick={() => setFilterStatus('Docs Pending')}
        >
          <span>Pending Review</span>
          <strong>{String(pendingAgents).padStart(2, '0')}</strong>
          <small>Documents awaiting sign-off</small>
        </button>
      </div>

      <DriverAppAdoption orgId={orgId} />
      
      {/* Operations card with table */}
      <div className="operations-card">
        {/* Operations toolbar */}
        <div className="operations-toolbar">
          <label className="enterprise-search">
            <Search size={15} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, phone, plate, or ID..."
            />
            <kbd>⌘K</kbd>
          </label>
          <div className="facet-filters">
            <label>
              <span>STATUS</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="online">Online</option>
                <option value="app_open">App open · no GPS</option>
                <option value="offline">Offline</option>
                <option value="on_job">On delivery</option>
                <option value="standby">Standby (approved, on-call)</option>
                <option value="Sourced">Sourced (not vetted yet)</option>
                <option value="Docs Pending">Pending Review</option>
              </select>
            </label>
            <label>
              <span>VEHICLE</span>
              <select
                value={filterVehicle}
                onChange={(e) => setFilterVehicle(e.target.value)}
              >
                <option value="all">All vehicles</option>
                <option value="Cargo Van">Cargo Van</option>
                <option value="Motorbike">Motorbike</option>
                <option value="Box Truck">Box Truck</option>
              </select>
            </label>
          </div>
          <div className="bulk-actions">
            <b>{selectedDrivers.length} selected</b>
            <button disabled={selectedDrivers.length === 0} onClick={() => copyNumbers(selectedDrivers)}>
              Copy WhatsApp numbers
            </button>
            <button disabled={selectedDrivers.length === 0} onClick={() => exportContacts(selectedDrivers)}>
              Save selected to phone
            </button>
          </div>
        </div>
        
        {/* Enterprise table */}
        <div className="enterprise-table agent-table">
          <div className="enterprise-head">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all shown" />
            <span>AGENT</span>
            <span>VEHICLE TYPE</span>
            <span>LICENSE PLATE</span>
            <span>STATUS</span>
            <span>LOCATION / LAST ACTIVE</span>
            <span>ACTION</span>
          </div>
          {visibleDrivers.map((driver, index) => (
            <div
              key={driver.id}
              className="enterprise-row"
              onClick={() => onViewDriver(driver.id!)}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(driver.id!)}
                onChange={() => toggleSelected(driver.id!)}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="enterprise-profile">
                <span className="avatar" style={{ background: `hsl(${index * 45}, 45%, 45%)` }}>
                  {driver.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                </span>
                <span>
                  <b>{driver.full_name}</b>
                  <small style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono">{driver.phone}</span>
                    {(() => {
                      const call = telLink(driver.phone);
                      const firstName = (driver.full_name || '').split(' ')[0];
                      const wa = whatsappLink(
                        driverWhatsapp(driver),
                        `Hi ${firstName}, Nokael dispatch here. Are you free for a job today?`,
                      );
                      const stop = (e: React.MouseEvent) => e.stopPropagation();
                      return (
                        <>
                          {call && (
                            <a href={call} onClick={stop} title={`Call ${driver.full_name}`} aria-label={`Call ${driver.full_name}`}>
                              <Phone size={13} />
                            </a>
                          )}
                          {wa && (
                            <a href={wa} target="_blank" rel="noreferrer" onClick={stop} title={`WhatsApp ${driver.full_name}`} aria-label={`WhatsApp ${driver.full_name}`}>
                              <MessageCircle size={13} />
                            </a>
                          )}
                        </>
                      );
                    })()}
                  </small>
                </span>
              </span>
              <span>
                <em className="neutral-badge">{driver.vehicle_type}</em>
              </span>
              <span className="mono">
                {driver.vehicle_plate || '—'}
              </span>
              <span>
                {(() => {
                  const presence = presenceOf(driver);
                  const onJob = driver.status === 'on_job';
                  const label = presence === 'online'
                    ? (onJob ? 'Online · on delivery' : 'Online')
                    : presence === 'app_open'
                      ? 'App open · no GPS'
                      : (onJob ? 'Offline · on delivery' : 'Offline');
                  const hint = presence === 'app_open'
                    ? 'The app is open but not sharing location: the driver switched to Offline, or precise location is turned off on the phone.'
                    : presence === 'online' ? 'Sharing live location from the driver app.' : 'Not using the driver app right now.';
                  return (
                    <span className={`plain-status ${presence === 'online' ? '' : presence === 'app_open' ? 'sla-risk' : 'offline'}`} title={hint}>
                      <i />
                      {label}
                    </span>
                  );
                })()}
              </span>
              <span className="context-cell">
                {driver.base_location || 'No location'}
                {lastSeenOf(driver) && <small style={{ display: 'block', opacity: .75 }}>Seen {lastSeenOf(driver)}</small>}
              </span>
              <span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDriver(driver.id!);
                  }}
                  className="overflow-button"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="4" cy="10" r=".7" fill="currentColor" />
                    <circle cx="10" cy="10" r=".7" fill="currentColor" />
                    <circle cx="16" cy="10" r=".7" fill="currentColor" />
                  </svg>
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
