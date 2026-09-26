import React from 'react';
import { Search, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Driver } from '../../lib/supabase';
import type { DriverPoolSummary } from './selectors';

interface DriversViewProps {
  driverPoolSummary: DriverPoolSummary;
  filteredDrivers: Driver[];
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
  
  // Calculate metrics
  const totalFleet = filteredDrivers.length;
  const activeAgents = filteredDrivers.filter(d => d.status === 'available').length;
  const pendingAgents = filteredDrivers.filter(d => d.pipeline_status === 'Screening' || d.pipeline_status === 'Docs Pending').length;
  const slaWarning = filteredDrivers.filter(d => d.status === 'on_job').length;
  
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
          className={filterStatus === 'Active' ? 'selected' : ''}
          onClick={() => setFilterStatus('Active')}
        >
          <span>Active / Online</span>
          <strong>{activeAgents}</strong>
          <small>Available now</small>
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
                <option value="available">Active / Online</option>
                <option value="on_job">SLA Risk</option>
                <option value="Docs Pending">Pending Review</option>
                <option value="offline">Offline</option>
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
          {filteredDrivers.map((driver, index) => (
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
                <span className={`plain-status ${driver.status === 'available' ? '' : driver.status === 'on_job' ? 'sla-risk' : 'offline'}`}>
                  <i />
                  {driver.status === 'available' ? 'Available' : driver.status === 'on_job' ? 'On Delivery' : 'Offline'}
                </span>
              </span>
              <span className="context-cell">
                {driver.base_location || 'No location'}
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
