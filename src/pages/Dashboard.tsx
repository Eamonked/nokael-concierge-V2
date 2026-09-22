import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Users,
  Clock,
  CheckCircle2,
  LogOut,
  Zap,
  Shield,
  FileText,
  Truck,
  MapPin,
} from 'lucide-react';
import {
  type QuoteRequest,
  type Driver,
  type DriverDocument,
  type BusinessInquiry,
  type Job,
  type JobWithDriver,
  clearStaleAuthSession,
} from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

import { StatCard } from './dashboard/components/StatCard';
import { PipelineView } from './dashboard/PipelineView';
import { QuotesView } from './dashboard/QuotesView';
import { BusinessView } from './dashboard/BusinessView';
import { DriversView } from './dashboard/DriversView';
// Leaflet is heavy and only the Map tab needs it, so load it on demand.
const LiveMapView = React.lazy(() => import('./dashboard/LiveMapView').then(m => ({ default: m.LiveMapView })));
import { TeamPanel } from './dashboard/TeamPanel';
import { JobDetailModal } from './dashboard/modals/JobDetailModal';
import { JobCreateModal } from './dashboard/modals/JobCreateModal';
import { LostQuoteModal } from './dashboard/modals/LostQuoteModal';
import { DriverProfileModal } from './dashboard/modals/DriverProfileModal';
import { BusinessDetailsModal } from './dashboard/modals/BusinessDetailsModal';
import { useDashboardData } from './dashboard/useDashboardData';
import { useDashboardActions } from './dashboard/useDashboardActions';
import { TERMINAL_STATUSES, type StatTone } from './dashboard/constants';
import {
  filterRequests,
  filterJobs,
  filterDrivers,
  filterBusinessInquiries,
  getApprovedDrivers,
  getDriverPoolSummary,
  getDashboardStats,
  type JobStatusFilter,
} from './dashboard/selectors';

export default function Dashboard() {
  const { t } = useTranslation('dashboard');
  const [activeTab, setActiveTab] = React.useState<'pipeline' | 'map' | 'quotes' | 'drivers' | 'business' | 'team'>('pipeline');
  const navigate = useNavigate();

  const {
    orgId,
    currentRole,
    jobs,
    requests,
    drivers,
    businessInquiries,
    loading,
    error,
    setRequests,
    setDrivers,
    setBusinessInquiries,
    refetch: fetchData,
  } = useDashboardData();

  // ── Modal / selection state ──────────────────────────────────────────────────
  const [selectedDriver, setSelectedDriver] = React.useState<(Driver & { documents: DriverDocument[] }) | null>(null);
  const [selectedBusiness, setSelectedBusiness] = React.useState<BusinessInquiry | null>(null);
  const [selectedJob, setSelectedJob] = React.useState<JobWithDriver | null>(null);
  const [showJobCreateModal, setShowJobCreateModal] = React.useState(false);
  const [jobPrefillData, setJobPrefillData] = React.useState<Partial<Job> | undefined>(undefined);
  const [lostModalQuote, setLostModalQuote] = React.useState<QuoteRequest | null>(null);

  // ── View / filter state ──────────────────────────────────────────────────────
  const [jobViewMode, setJobViewMode] = React.useState<'kanban' | 'list'>('kanban');
  const [jobStatusFilter, setJobStatusFilter] = React.useState<JobStatusFilter>('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState<string>('active');
  const [filterVehicle, setFilterVehicle] = React.useState<string>('all');

  // Keep the open job detail modal in sync with live realtime updates.
  React.useEffect(() => {
    if (!selectedJob?.id) return;
    const updated = jobs.find(j => j.id === selectedJob.id);
    if (updated && updated !== selectedJob) setSelectedJob(updated);
  }, [jobs, selectedJob]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const {
    handleStatusUpdate,
    handleConfirmMarkLost,
    handleReopenQuote,
    handleDriverStatusUpdate,
    handleBusinessUpdate,
    handleViewDriver,
    handleDelete,
  } = useDashboardActions({
    setRequests,
    setDrivers,
    setBusinessInquiries,
    selectedDriver,
    setSelectedDriver,
    selectedBusiness,
    setSelectedBusiness,
    lostModalQuote,
    setLostModalQuote,
  });

  const handleConvertToJob = (quote: QuoteRequest) => {
    setJobPrefillData({
      sender_name: quote.name,
      sender_phone: quote.phone,
      pickup_emirate: quote.emirate || 'Dubai',
      pickup_location: quote.pickup_location,
      delivery_emirate: quote.emirate === 'Dubai' ? 'Abu Dhabi' : 'Dubai',
      delivery_location: quote.delivery_location,
      item_type: quote.item_type as any,
      urgency: quote.urgency as any,
      quote_id: quote.id,
    });
    setShowJobCreateModal(true);
  };

  const handleLogout = async () => {
    await clearStaleAuthSession();
    navigate('/login');
  };

  // ── Derived data ─────────────────────────────────────────────────────────────
  const filteredRequests  = filterRequests(requests, searchTerm, filterStatus);
  const filteredJobs      = filterJobs(jobs, searchTerm, jobStatusFilter);
  const filteredDrivers   = filterDrivers(drivers, searchTerm, filterStatus, filterVehicle);
  const filteredBusiness  = filterBusinessInquiries(businessInquiries, searchTerm);
  const approvedDrivers   = getApprovedDrivers(drivers);
  const driverPoolSummary = getDriverPoolSummary(drivers);
  const stats             = getDashboardStats(requests, drivers, businessInquiries);

  // ── Loading gate ─────────────────────────────────────────────────────────────
  if (loading && !selectedDriver) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <Zap className="w-12 h-12 text-brand-neon animate-pulse" />
      </div>
    );
  }

  // ── Nav / tab meta ───────────────────────────────────────────────────────────
  const NAV_ITEMS: { id: typeof activeTab; label: string; icon: any; badge?: number }[] = [
    { id: 'pipeline', label: t('nav.jobs'),     icon: LayoutDashboard },
    { id: 'map',      label: t('nav.map'),      icon: MapPin },
    { id: 'quotes',   label: t('nav.quotes'),   icon: FileText, badge: stats.pending },
    { id: 'drivers',  label: t('nav.drivers'),  icon: Truck,    badge: stats.pendingDrivers },
    { id: 'business', label: t('nav.business'), icon: Shield,   badge: stats.pendingBusiness },
    { id: 'team',     label: t('nav.team'),     icon: Users },
  ];

  const TAB_META: Record<typeof activeTab, { title: string; subtitle: string }> = {
    pipeline: { title: t('tabMeta.pipeline.title'), subtitle: t('tabMeta.pipeline.subtitle') },
    map:      { title: t('tabMeta.map.title'),      subtitle: t('tabMeta.map.subtitle') },
    quotes:   { title: t('tabMeta.quotes.title'),   subtitle: t('tabMeta.quotes.subtitle') },
    drivers:  { title: t('tabMeta.drivers.title'),  subtitle: t('tabMeta.drivers.subtitle') },
    business: { title: t('tabMeta.business.title'), subtitle: t('tabMeta.business.subtitle') },
    team:     { title: t('tabMeta.team.title'),     subtitle: t('tabMeta.team.subtitle') },
  };

  const jobsActive    = jobs.filter(j => !TERMINAL_STATUSES.includes(j.status)).length;
  const jobsCompleted = jobs.filter(j => j.status === 'completed').length;

  const CONTEXT_STATS: Record<typeof activeTab, { title: string; value: number; icon: any; tone?: StatTone }[]> = {
    pipeline: [
      { title: t('stats.active'),    value: jobsActive,                                           icon: Zap,          tone: 'attention' },
      { title: t('stats.pending'),   value: jobs.filter(j => j.status === 'pending').length,      icon: Clock,        tone: 'pending'   },
      { title: t('stats.completed'), value: jobsCompleted,                                        icon: CheckCircle2, tone: 'complete'  },
    ],
    quotes: [
      { title: t('stats.new'),       value: stats.pending,   icon: Clock,         tone: 'attention' },
      { title: t('stats.total'),     value: stats.total,     icon: LayoutDashboard                 },
      { title: t('stats.completed'), value: stats.completed, icon: CheckCircle2,  tone: 'complete'  },
    ],
    drivers: [
      { title: t('stats.needsReview'), value: stats.pendingDrivers,    icon: Clock,         tone: 'attention' },
      { title: t('stats.total'),       value: stats.drivers,           icon: Truck                            },
      { title: t('stats.active'),      value: approvedDrivers.length,  icon: CheckCircle2,  tone: 'complete'  },
    ],
    business: [
      { title: t('stats.new'),   value: stats.pendingBusiness,                               icon: Clock,         tone: 'attention' },
      { title: t('stats.total'), value: stats.business,                                      icon: Shield                           },
      { title: t('stats.active'), value: businessInquiries.filter(b => b.status === 'active').length, icon: CheckCircle2, tone: 'complete' },
    ],
    map: [],
    team: [],
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-brand-border h-screen sticky top-0 px-4 py-6">
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="w-9 h-9 rounded-lg overflow-hidden border border-brand-border shrink-0">
            <img src="/logo.svg" alt="Nokael Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-display font-medium leading-tight truncate">Nokael</h1>
            <p className="text-[11px] text-brand-muted truncate">Dashboard</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                activeTab === item.id
                  ? "bg-brand-neon/10 text-brand-neon"
                  : "text-brand-muted hover:text-brand-text hover:bg-brand-surface"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left truncate">{item.label}</span>
              {!!item.badge && (
                <span className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                  activeTab === item.id ? "bg-brand-neon text-brand-bg" : "bg-brand-input text-brand-muted"
                )}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="space-y-1 pt-4 border-t border-brand-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-brand-muted hover:text-brand-text hover:bg-brand-surface transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-brand-bg/90 backdrop-blur-xl border-b border-brand-border px-5 md:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden w-8 h-8 rounded-lg overflow-hidden border border-brand-border shrink-0">
              <img src="/logo.svg" alt="Nokael Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-display font-medium tracking-tight truncate">{TAB_META[activeTab].title}</h2>
              <p className="text-xs text-brand-muted truncate">{TAB_META[activeTab].subtitle}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="md:hidden p-2 text-brand-muted hover:text-brand-text transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        {/* Mobile tab switcher */}
        <nav className="md:hidden flex items-center gap-2 px-5 py-3 overflow-x-auto no-scrollbar border-b border-brand-border">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                activeTab === item.id ? "bg-brand-neon/10 text-brand-neon" : "text-brand-muted"
              )}
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 px-5 md:px-8 py-8 max-w-[1600px] w-full mx-auto">

          {error && (
            <div className="mb-6 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5" />
                <h3 className="text-sm font-semibold">{t('error.title')}</h3>
              </div>
              <p className="text-xs leading-relaxed opacity-80 mb-3">{error}</p>
              <button onClick={fetchData} className="text-xs font-semibold underline">{t('error.retry')}</button>
            </div>
          )}

          {/* Contextual stat strip */}
          {CONTEXT_STATS[activeTab].length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              {CONTEXT_STATS[activeTab].map(stat => (
                <StatCard key={stat.title} title={stat.title} value={stat.value} icon={stat.icon} tone={stat.tone} />
              ))}
            </div>
          )}

          {/* Active view */}
          {activeTab === 'pipeline' ? (
            <PipelineView
              jobs={jobs}
              filteredJobs={filteredJobs}
              jobViewMode={jobViewMode}
              setJobViewMode={setJobViewMode}
              jobStatusFilter={jobStatusFilter}
              setJobStatusFilter={setJobStatusFilter}
              onNewJob={() => setShowJobCreateModal(true)}
              onJobClick={setSelectedJob}
            />
          ) : activeTab === 'map' ? (
            <React.Suspense fallback={<div className="h-[420px] rounded-2xl border border-brand-border bg-brand-input animate-pulse" />}>
              <LiveMapView jobs={jobs} onJobClick={setSelectedJob} />
            </React.Suspense>
          ) : activeTab === 'quotes' ? (
            <QuotesView
              filteredRequests={filteredRequests}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              onStatusUpdate={handleStatusUpdate}
              onReopenQuote={handleReopenQuote}
              onConvertToJob={handleConvertToJob}
              onMarkLost={setLostModalQuote}
              onDelete={handleDelete}
            />
          ) : activeTab === 'business' ? (
            <BusinessView
              filteredBusiness={filteredBusiness}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onStatusUpdate={handleBusinessUpdate}
              onViewDetails={setSelectedBusiness}
            />
          ) : activeTab === 'team' ? (
            <TeamPanel orgId={orgId} currentRole={currentRole} />
          ) : (
            <DriversView
              driverPoolSummary={driverPoolSummary}
              filteredDrivers={filteredDrivers}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterVehicle={filterVehicle}
              setFilterVehicle={setFilterVehicle}
              onDriverStatusUpdate={handleDriverStatusUpdate}
              onViewDriver={handleViewDriver}
            />
          )}

        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedDriver && (
          <DriverProfileModal
            driver={selectedDriver}
            onClose={() => setSelectedDriver(null)}
            onDriverStatusUpdate={handleDriverStatusUpdate}
          />
        )}
        {selectedBusiness && (
          <BusinessDetailsModal
            business={selectedBusiness}
            onClose={() => setSelectedBusiness(null)}
            onBusinessUpdate={handleBusinessUpdate}
          />
        )}
        {selectedJob && (
          <JobDetailModal
            job={selectedJob}
            drivers={approvedDrivers}
            onClose={() => setSelectedJob(null)}
            onUpdate={fetchData}
          />
        )}
        {showJobCreateModal && (
          <JobCreateModal
            key={jobPrefillData?.quote_id || 'manual-new'}
            initialData={jobPrefillData}
            drivers={approvedDrivers}
            onClose={() => {
              setShowJobCreateModal(false);
              setJobPrefillData(undefined);
            }}
            onSuccess={fetchData}
          />
        )}
        {lostModalQuote && (
          <LostQuoteModal
            quote={lostModalQuote}
            onClose={() => setLostModalQuote(null)}
            onConfirm={handleConfirmMarkLost}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
