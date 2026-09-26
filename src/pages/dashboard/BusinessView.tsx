import React, { useState, useMemo } from 'react';
import { Search, ChevronRight, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { BusinessInquiry, JobWithDriver } from '../../lib/supabase';
import { AddBusinessModal } from './modals/AddBusinessModal';
import {
  filterJobsByBusiness,
  getActiveJobCountForBusiness,
  getBusinessFinancials,
  getBusinessRenewalStatus,
  isRenewalDueSoon,
} from './selectors';
import { useCanWrite } from './permissions';

interface BusinessViewProps {
  filteredBusiness: BusinessInquiry[];
  jobs: JobWithDriver[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  onStatusUpdate: (id: string, updates: Partial<BusinessInquiry>) => void;
  onViewDetails: (biz: BusinessInquiry) => void;
  onRefresh?: () => void | Promise<void>;
}

type FilterType = 'All' | 'Outstanding' | 'Renewals';

export function BusinessView({
  filteredBusiness,
  jobs,
  searchTerm,
  setSearchTerm,
  onStatusUpdate,
  onViewDetails,
  onRefresh,
}: BusinessViewProps) {
  const { t } = useTranslation('dashboard');
  const [filter, setFilter] = useState<FilterType>('All');
  const [showAddModal, setShowAddModal] = React.useState(false);
  const canWrite = useCanWrite();

  const handleAddSuccess = async () => {
    if (onRefresh) {
      await onRefresh();
    }
  };

  // Calculate stats from real business + job data
  const stats = useMemo(() => {
    const activeBusinesses = filteredBusiness.filter(b => b.status === 'active');
    const totalAccounts = activeBusinesses.length;

    const monthlyVolume = activeBusinesses
      .reduce((sum, b) => sum + parseInt(b.estimated_monthly_volume || '0', 10), 0);

    // Outstanding = accounts with at least one due/overdue job (payment_status
    // on jobs.price_aed — see getBusinessFinancials). No separate invoices table.
    let outstandingAmount = 0;
    let outstandingAccounts = 0;
    for (const b of activeBusinesses) {
      const financials = getBusinessFinancials(filterJobsByBusiness(jobs, b.id));
      if (financials.outstanding > 0) {
        outstandingAmount += financials.outstanding;
        outstandingAccounts += 1;
      }
    }

    const renewalsDue = filteredBusiness.filter(isRenewalDueSoon).length;

    return {
      totalAccounts,
      monthlyVolume,
      outstandingAccounts,
      outstandingAmount,
      renewalsDue,
    };
  }, [filteredBusiness, jobs]);

  // Apply filter
  const displayedBusiness = useMemo(() => {
    let result = filteredBusiness;

    if (filter === 'Outstanding') {
      result = result.filter(b => b.invoicing_required && b.status === 'active');
    } else if (filter === 'Renewals') {
      result = result.filter(isRenewalDueSoon);
    }

    return result;
  }, [filteredBusiness, filter]);

  // Generate initials from company name
  const getInitials = (name: string) => {
    const words = name.split(' ');
    if (words.length >= 2) {
      return words[0][0] + words[1][0];
    }
    return name.slice(0, 2);
  };

  // Avatar tone based on index
  const getAvatarTone = (index: number) => {
    const tones = ['#34421c', '#25384a', '#463229', '#3c2e48'];
    return tones[index % tones.length];
  };

  return (
    <div className="enterprise-page business-page">
      {/* Header Actions */}
      <div className="enterprise-actions mb-6">
        <span className="record-count">
          {stats.totalAccounts} managed accounts · AED {Math.floor(stats.monthlyVolume * 45 / 1000)}k monthly revenue
        </span>
        <div className="flex gap-3">
          <button className="outline-button">Export CSV</button>
          {canWrite && <button 
            className="dark-button flex items-center gap-2"
            onClick={() => setShowAddModal(true)}
          >
            <span className="text-lg leading-none">+</span>
            Add Business
          </button>}
        </div>
      </div>

      {/* Metric Filters / Stats Cards */}
      <div className="metric-filters business-metrics mb-6">
        <button
          className={filter === 'All' ? 'selected' : ''}
          onClick={() => setFilter('All')}
        >
          <span>Active Accounts</span>
          <strong>{stats.totalAccounts}</strong>
          <small>+3 this quarter</small>
        </button>
        <button onClick={() => setFilter('All')}>
          <span>Monthly Volume</span>
          <strong>{stats.monthlyVolume.toLocaleString()}</strong>
          <small>Completed jobs</small>
        </button>
        <button
          className={filter === 'Outstanding' ? 'selected' : ''}
          onClick={() => setFilter('Outstanding')}
        >
          <span>Outstanding</span>
          <strong>AED {stats.outstandingAmount / 1000}k</strong>
          <small>{stats.outstandingAccounts} accounts require collection</small>
        </button>
        <button
          className={filter === 'Renewals' ? 'selected' : ''}
          onClick={() => setFilter('Renewals')}
        >
          <span>Renewals Due</span>
          <strong>{String(stats.renewalsDue).padStart(2, '0')}</strong>
          <small>Within the next 30 days</small>
        </button>
      </div>

      {/* Main Card */}
      <div className="operations-card">
        {/* Toolbar */}
        <div className="operations-toolbar business-toolbar">
          <label className="enterprise-search">
            <Search className="w-[15px] h-[15px]" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search company, contact, or tier..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <kbd>/</kbd>
          </label>
          <div className="enterprise-tabs">
            <button
              className={filter === 'All' ? 'selected' : ''}
              onClick={() => setFilter('All')}
            >
              All Accounts
            </button>
            <button
              className={filter === 'Outstanding' ? 'selected' : ''}
              onClick={() => setFilter('Outstanding')}
            >
              Outstanding
            </button>
            <button
              className={filter === 'Renewals' ? 'selected' : ''}
              onClick={() => setFilter('Renewals')}
            >
              Renewals Due
            </button>
          </div>
          <span className="table-result-count">{displayedBusiness.length} accounts</span>
        </div>

        {/* Table */}
        <div className="enterprise-table business-accounts-table">
          <div className="enterprise-head">
            <span>Company</span>
            <span>Active jobs</span>
            <span>Financial exposure</span>
            <span>Service tier</span>
            <span>Contract health</span>
            <span>Action</span>
          </div>
          {displayedBusiness.map((business, index) => {
            const bizJobs = filterJobsByBusiness(jobs, business.id);
            const activeJobsCount = getActiveJobCountForBusiness(jobs, business.id);
            const financials = getBusinessFinancials(bizJobs);
            const outstandingLabel = `AED ${financials.outstanding.toLocaleString()}`;
            const dueLabel = financials.overdueCount > 0
              ? `Overdue${financials.overdueCount > 1 ? ` (${financials.overdueCount})` : ''}`
              : financials.outstanding > 0 && financials.nextDueDate
                ? `Due ${new Date(financials.nextDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : 'Paid';
            const tier = business.service_tier || 'Standard';
            const health = getBusinessRenewalStatus(business);

            return (
              <div
                className="enterprise-row business-account-row"
                key={business.id}
                onClick={() => onViewDetails(business)}
              >
                <span className="enterprise-profile">
                  <span
                    className="avatar"
                    style={{ background: getAvatarTone(index) }}
                  >
                    {getInitials(business.company_name)}
                  </span>
                  <span>
                    <button className="profile-link">
                      {business.company_name}
                      <ChevronRight className="w-[10px] h-[10px]" />
                    </button>
                    <small>
                      {business.contact_person} · {business.estimated_monthly_volume} jobs/mo
                    </small>
                  </span>
                </span>
                <button
                  className="active-jobs-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Could trigger map view filtered to this account
                  }}
                >
                  {activeJobsCount > 0
                    ? `${activeJobsCount} active`
                    : 'No active jobs'}
                  <MapPin className="w-[12px] h-[12px]" />
                </button>
                <span className="financial-cell">
                  <b>{outstandingLabel}</b>
                  <em
                    className={
                      dueLabel.startsWith('Overdue')
                        ? 'overdue'
                        : dueLabel === 'Paid'
                          ? 'paid'
                          : ''
                    }
                  >
                    {dueLabel}
                  </em>
                </span>
                <span>
                  <em className="neutral-badge">{tier}</em>
                </span>
                <span className={`status ${
                  health.tone === 'success' ? 'success' :
                  health.tone === 'warning' ? 'warning' :
                  'neutral'
                }`}>
                  <i />
                  {health.label}
                </span>
                <span>
                  <button
                    className="overflow-button"
                    aria-label={`Open ${business.company_name}`}
                  >
                    <ChevronRight className="w-[12px] h-[12px]" />
                  </button>
                </span>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        <div className="table-pagination">
          <span>
            Showing <b>{displayedBusiness.length}</b> of <b>{stats.totalAccounts}</b> accounts
          </span>
          <div>
            <button disabled>Previous</button>
            <button className="current">1</button>
            <button>2</button>
            <button>3</button>
            <button>Next</button>
          </div>
        </div>
      </div>

      {/* Add Business Modal */}
      {showAddModal && (
        <AddBusinessModal 
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
        />
      )}
    </div>
  );
}
