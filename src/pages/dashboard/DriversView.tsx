import React from 'react';
import { Search, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import type { Driver, DriverPresence } from '../../lib/supabase';
import type { DriverPoolSummary } from './selectors';

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
}: DriversViewProps) {
  const { t } = useTranslation('dashboard');
  
  // "Online" comes from the driver app itself (GPS / app activity), not from
  // drivers.status, which only tracks whether they are on a job.
  const presenceOf = (d: Driver) => driverPresence[d.id!]?.presence ?? 'offline';
  const PRESENCE_FILTERS = ['online', 'app_open', 'offline', 'on_job'];
  const visibleDrivers = !PRESENCE_FILTERS.includes(filterStatus)
    ? filteredDrivers
    : filteredDrivers.filter(d => filterStatus === 'on_job' ? d.status === 'on_job' : presenceOf(d) === filterStatus);

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
          <button className="outline-button">Export CSV</button>
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
            <b>0 selected</b>
            <button>Bulk Assign</button>
            <button>Send Message</button>
            <button>Export Selected</button>
          </div>
        </div>
        
        {/* Enterprise table */}
        <div className="enterprise-table agent-table">
          <div className="enterprise-head">
            <input type="checkbox" />
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
                onClick={(e) => e.stopPropagation()}
              />
              <span className="enterprise-profile">
                <span className="avatar" style={{ background: `hsl(${index * 45}, 45%, 45%)` }}>
                  {driver.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                </span>
                <span>
                  <b>{driver.full_name}</b>
                  <small>
                    <span>{driver.phone}</span>
                  </small>
                </span>
              </span>
              <span>
                <em className="neutral-badge">{driver.vehicle_type}</em>
              </span>
              <span className="mono">
                {driver.vehicle_registration || '—'}
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
