import React from 'react';
import { Search, Star } from 'lucide-react';
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
}: DriversViewProps) {
  return (
    <>
      {/* Driver Pool Summary - matching Excel tracker targets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="dispatch-card p-4">
          <div className="text-xs uppercase tracking-wide text-brand-muted font-medium mb-2">Dubai Active</div>
          <div className="text-2xl font-bold text-brand-text">
            {driverPoolSummary.dubaiActive}
            <span className="text-sm text-brand-muted font-normal">/{driverPoolSummary.dubaiTarget}</span>
          </div>
        </div>
        <div className="dispatch-card p-4">
          <div className="text-xs uppercase tracking-wide text-brand-muted font-medium mb-2">Abu Dhabi Active</div>
          <div className="text-2xl font-bold text-brand-text">
            {driverPoolSummary.abuDhabiActive}
            <span className="text-sm text-brand-muted font-normal">/{driverPoolSummary.abuDhabiTarget}</span>
          </div>
        </div>
        <div className="dispatch-card p-4">
          <div className="text-xs uppercase tracking-wide text-brand-muted font-medium mb-2">Total Active</div>
          <div className="text-2xl font-bold text-brand-neon">
            {driverPoolSummary.totalActive}
            <span className="text-sm text-brand-muted font-normal">/{driverPoolSummary.totalTarget}</span>
          </div>
        </div>
        <div className="dispatch-card p-4">
          <div className="text-xs uppercase tracking-wide text-brand-muted font-medium mb-2">In Pipeline</div>
          <div className="text-2xl font-bold text-blue-400">
            {driverPoolSummary.inPipeline}
          </div>
        </div>
      </div>
      
      <div className="dispatch-card overflow-hidden p-0">
      <div className="p-5 border-b border-brand-border flex flex-col md:flex-row justify-end items-center gap-3">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input 
            type="text" 
            placeholder="Search drivers..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-brand-input border border-brand-input-border rounded-xl py-2.5 pl-10 pr-4 text-xs focus:border-brand-neon/50 outline-none transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="bg-brand-input border border-brand-input-border rounded-xl px-4 py-2.5 text-xs font-medium outline-none focus:border-brand-neon/50 w-full md:w-auto"
          value={['Sourced', 'Screening', 'Docs Pending', 'Trial Scheduled', 'Active', 'Rejected'].includes(filterStatus) ? filterStatus : 'all'}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">All stages</option>
          <option value="Sourced">Sourced</option>
          <option value="Screening">Screening</option>
          <option value="Docs Pending">Docs Pending</option>
          <option value="Trial Scheduled">Trial Scheduled</option>
          <option value="Active">Active</option>
          <option value="Rejected">Rejected</option>
        </select>
        <select 
          className="bg-brand-input border border-brand-input-border rounded-xl px-4 py-2.5 text-xs font-medium outline-none focus:border-brand-neon/50 w-full md:w-auto"
          value={filterVehicle}
          onChange={e => setFilterVehicle(e.target.value)}
        >
          <option value="all">All vehicles</option>
          <option value="Sedan">Sedan</option>
          <option value="Executive SUV">Executive SUV</option>
          <option value="Panel Van">Panel Van</option>
          <option value="Motorcycle (License R)">Motorcycle</option>
          <option value="3-Ton Pickup">3-Ton Pickup</option>
        </select>
      </div>

      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-brand-input text-[11px] uppercase tracking-wide font-medium text-brand-muted">
              <th className="px-6 py-3">Driver</th>
              <th className="px-6 py-3">Vehicle</th>
              <th className="px-6 py-3">Rating</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Application</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {filteredDrivers.map((driver) => (
              <tr key={driver.id} className="hover:bg-brand-input transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-medium text-brand-text mb-1.5 text-sm">{driver.full_name}</div>
                  <div className="text-xs text-brand-muted font-medium">{driver.phone}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium mb-1.5">{driver.vehicle_type}</div>
                  <div className="text-xs uppercase tracking-wide text-brand-muted font-medium">{driver.base_location}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-medium text-brand-text">{driver.reliability_score || 'New'}</span>
                    <span className="text-xs text-brand-muted">• Tier {driver.tier}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {(() => {
                    const statusMap: Record<string, { label: string; dot: string; text: string }> = {
                      available: { label: 'Available', dot: 'bg-emerald-500', text: 'text-emerald-500' },
                      on_job: { label: 'On Job', dot: 'bg-blue-500', text: 'text-blue-500' },
                      offline: { label: 'Offline', dot: 'bg-brand-muted', text: 'text-brand-muted' },
                    };
                    const cfg = statusMap[driver.status || 'offline'] || statusMap.offline;
                    return (
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-6 py-4">
                  {(() => {
                    const stage = driver.pipeline_status || 'Sourced';
                    const stageStyles: Record<string, string> = {
                      'Sourced': 'bg-slate-500/5 border-slate-500/20 text-slate-400',
                      'Screening': 'bg-blue-500/5 border-blue-500/20 text-blue-400',
                      'Docs Pending': 'bg-yellow-500/5 border-yellow-500/20 text-yellow-500',
                      'Trial Scheduled': 'bg-purple-500/5 border-purple-500/20 text-purple-400',
                      'Active': 'bg-brand-neon/5 border-brand-neon/20 text-brand-neon',
                      'Rejected': 'bg-red-500/5 border-red-500/20 text-red-500',
                    };
                    return (
                      <select 
                        value={stage}
                        onChange={(e) => onDriverStatusUpdate(driver.id!, { pipeline_status: e.target.value as any })}
                        className={`text-[11px] font-medium tracking-wide px-3 py-2 rounded-lg border outline-none transition-all ${stageStyles[stage] || stageStyles['Sourced']}`}
                      >
                        <option value="Sourced">Sourced</option>
                        <option value="Screening">Screening</option>
                        <option value="Docs Pending">Docs Pending</option>
                        <option value="Trial Scheduled">Trial Scheduled</option>
                        <option value="Active">Active</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    );
                  })()}
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => onViewDriver(driver.id!)}
                    className="px-4 py-2 bg-brand-input border border-brand-border text-brand-text text-xs font-medium rounded-lg hover:bg-brand-surface hover:border-brand-neon/30 transition-all"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}
