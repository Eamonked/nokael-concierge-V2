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
  ChevronLeft,
  ChevronDown,
  Bell,
  Settings,
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
import i18n from '../i18n/config';
import { cn } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';

import { StatCard } from './dashboard/components/StatCard';
import { JobsView } from './dashboard/JobsView';
import { QuotesView } from './dashboard/QuotesView';
import { BusinessView } from './dashboard/BusinessView';
import { DriversView } from './dashboard/DriversView';
// Leaflet is heavy and only the Map tab needs it, so load it on demand.
import { GeofenceAlerts } from './dashboard/components/GeofenceAlerts';
const LiveMapView = React.lazy(() => import('./dashboard/LiveMapView').then(m => ({ default: m.LiveMapView })));
import { TeamPanel } from './dashboard/TeamPanel';
import { AlertsView } from './dashboard/AlertsView';
import { SettingsView } from './dashboard/SettingsView';
import { JobDetailModal } from './dashboard/modals/JobDetailModal';
import { JobCreateModal } from './dashboard/modals/JobCreateModal';
import { LostQuoteModal } from './dashboard/modals/LostQuoteModal';
import { DriverProfileModal } from './dashboard/modals/DriverProfileModal';
import { BusinessDetailsModal } from './dashboard/modals/BusinessDetailsModal';
import { BusinessAccountDrawer } from './dashboard/modals/BusinessAccountDrawer';
import { AddAgentModal } from './dashboard/modals/AddAgentModal';
import { PermissionsProvider, canWriteRole, READ_ONLY_MESSAGE } from './dashboard/permissions';
import { useDashboardData } from './dashboard/useDashboardData';
import { useDashboardActions } from './dashboard/useDashboardActions';
import { TERMINAL_STATUSES, type StatTone } from './dashboard/constants';
import {
  filterJobs,
  filterDrivers,
  filterBusinessInquiries,
  getApprovedDrivers,
  getDriverPoolSummary,
  getDashboardStats,
  getAlerts,
  type JobStatusFilter,
} from './dashboard/selectors';

export default function Dashboard() {
  const { t } = useTranslation('dashboard');
  const [activeTab, setActiveTab] = React.useState<'pipeline' | 'map' | 'quotes' | 'drivers' | 'business' | 'team' | 'alerts' | 'settings'>('pipeline');
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const {
    orgId,
    currentRole,
    userEmail,
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

  // ── Shell state (sidebar collapse, profile menu) ────────────
  const [collapsed, setCollapsed] = React.useState(() => {
    try { return localStorage.getItem('nokael-dashboard-sidebar-collapsed') === '1'; } catch { return false; }
  });
  const [profileOpen, setProfileOpen] = React.useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('nokael-dashboard-sidebar-collapsed', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const isArabic = i18n.language === 'ar';

  React.useEffect(() => {
    if (!profileOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  // ── Modal / selection state ──────────────────────────────────────────────────
  const [selectedDriver, setSelectedDriver] = React.useState<(Driver & { documents: DriverDocument[] }) | null>(null);
  const [selectedBusiness, setSelectedBusiness] = React.useState<BusinessInquiry | null>(null);
  const [selectedJob, setSelectedJob] = React.useState<JobWithDriver | null>(null);
  const [showJobCreateModal, setShowJobCreateModal] = React.useState(false);
  const [showAddAgentModal, setShowAddAgentModal] = React.useState(false);
  const [editingJob, setEditingJob] = React.useState<JobWithDriver | null>(null);
  const [duplicatingJob, setDuplicatingJob] = React.useState<JobWithDriver | null>(null);
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
      company_name: quote.company_name || '',
      quote_id: quote.id,
    });
    setShowJobCreateModal(true);
  };

  // Viewers are read-only (enforced by RLS). Every write entry point below is
  // passed through `guard` so a viewer gets a clear message instead of an error.
  const canWrite = canWriteRole(currentRole);
  const guard = <A extends unknown[], R>(fn: (...args: A) => R) =>
    canWrite ? fn : (..._args: A): R => {
      alert(READ_ONLY_MESSAGE);
      // Resolved promise so callers that await the handler still work.
      return Promise.resolve() as unknown as R;
    };

  const handleLogout = async () => {
    await clearStaleAuthSession();
    navigate('/login');
  };

  // ── Derived data ─────────────────────────────────────────────────────────────
  const filteredJobs      = filterJobs(jobs, searchTerm, jobStatusFilter);
  const filteredDrivers   = filterDrivers(drivers, searchTerm, filterStatus, filterVehicle);
  const filteredBusiness  = filterBusinessInquiries(businessInquiries, searchTerm);
  const approvedDrivers   = getApprovedDrivers(drivers);
  const driverPoolSummary = getDriverPoolSummary(drivers);
  const stats             = getDashboardStats(requests, drivers, businessInquiries);
  const alerts             = React.useMemo(() => getAlerts(jobs), [jobs]);
  const criticalAlertCount = alerts.filter(a => a.severity === 'critical').length;

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
    { id: 'alerts',   label: t('nav.alerts'),   icon: Bell,     badge: criticalAlertCount },
    { id: 'settings', label: t('nav.settings'), icon: Settings },
  ];

  const TAB_META: Record<typeof activeTab, { title: string; subtitle: string }> = {
    pipeline: { title: t('tabMeta.pipeline.title'), subtitle: t('tabMeta.pipeline.subtitle') },
    map:      { title: t('tabMeta.map.title'),      subtitle: t('tabMeta.map.subtitle') },
    quotes:   { title: t('tabMeta.quotes.title'),   subtitle: t('tabMeta.quotes.subtitle') },
    drivers:  { title: t('tabMeta.drivers.title'),  subtitle: t('tabMeta.drivers.subtitle') },
    business: { title: t('tabMeta.business.title'), subtitle: t('tabMeta.business.subtitle') },
    team:     { title: t('tabMeta.team.title'),     subtitle: t('tabMeta.team.subtitle') },
    alerts:   { title: t('tabMeta.alerts.title'),   subtitle: t('tabMeta.alerts.subtitle') },
    settings: { title: t('tabMeta.settings.title'), subtitle: t('tabMeta.settings.subtitle') },
  };

  const jobsActive    = jobs.filter(j => !TERMINAL_STATUSES.includes(j.status)).length;
  const jobsCompleted = jobs.filter(j => j.status === 'completed').length;

  const getInitials = (email: string | null) => {
    if (!email) return '??';
    const name = email.split('@')[0];
    const parts = name.split(/[._-]/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };
  const hasUrgentBadges = (stats.pending + stats.pendingDrivers + stats.pendingBusiness) > 0;

  const CONTEXT_STATS: Record<typeof activeTab, { title: string; value: number; icon: any; tone?: StatTone }[]> = {
    pipeline: [],  // JobsView has its own stat cards with additional metrics
    quotes: [],
    drivers: [],  // Removed duplicate stats - DriversView has its own metric filters
    business: [],  // BusinessView has its own metric filters
    map: [],
    team: [],
    alerts: [],
    settings: [],
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <PermissionsProvider role={currentRole}>
    <div className={cn('app enterprise-mode', theme === 'light' && 'light')} dir={isArabic ? 'rtl' : 'ltr'}>

      {/* ── Sidebar (desktop / md+; hidden below 768px via index.css) ─────────── */}
      <aside className={cn('sidebar', collapsed && 'collapsed')}>
        <div className="brand">
          <span className="brand-mark">
            <img src="/logo.svg" alt="Nokael Logo" className="w-full h-full object-cover rounded-[9px]" referrerPolicy="no-referrer" />
          </span>
          {!collapsed && <b>NOKAEL</b>}
        </div>

        <nav>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              title={collapsed ? item.label : undefined}
              className={activeTab === item.id ? 'active' : ''}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-icon">
                <item.icon className="w-[18px] h-[18px]" />
              </span>
              {!collapsed && (
                <>
                  <span>{item.label}</span>
                  {!!item.badge && <em>{item.badge}</em>}
                </>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          {!collapsed && (
            <div className="support">
              <span>{TAB_META[activeTab].title}</span>
              <b>
                <i />
                {error ? t('profile.connectionIssue') : t('profile.systemsOperational')}
              </b>
            </div>
          )}
          <button className="collapse-button" onClick={toggleCollapsed}>
            <ChevronLeft />
          </button>
          {!collapsed && (
            <button className="logout" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              <span>{t('nav.logout')}</span>
            </button>
          )}
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────────────────────── */}
      <main>

        {/* Top bar (desktop / md+; hidden below 768px via index.css) */}
        <header className="topbar">
          <div>
            <h1>{TAB_META[activeTab].title}</h1>
            <p>{TAB_META[activeTab].subtitle}</p>
          </div>
          <div className="top-actions">
            {currentRole === 'viewer' && (
              <span className="neutral-badge" title={READ_ONLY_MESSAGE} style={{ fontSize: 11, padding: '5px 10px' }}>
                {t('profile.viewOnly', { defaultValue: 'View only' })}
              </span>
            )}
            <button className="notification" aria-label={t('profile.notifications')}>
              <Bell className="w-[17px] h-[17px]" />
              {hasUrgentBadges && <i />}
            </button>
            <div className="profile-control" ref={profileRef}>
              <button
                className="profile-trigger"
                onClick={() => setProfileOpen(open => !open)}
                aria-expanded={profileOpen}
              >
                <span className="avatar">{getInitials(userEmail)}</span>
                <span>
                  <b>{userEmail || '—'}</b>
                  <small>{currentRole ? t(`roles.${currentRole}`) : ''}</small>
                </span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <div className="profile-menu-title">
                    <b>{t('profile.workspaceSettings')}</b>
                    <small>{t('profile.personalPreferences')}</small>
                  </div>
                  <div className="profile-setting">
                    <span>{t('profile.language')}</span>
                    <div className="toggle">
                      <button className={!isArabic ? 'active' : ''} onClick={() => i18n.changeLanguage('en')}>EN</button>
                      <button className={isArabic ? 'active' : ''} onClick={() => i18n.changeLanguage('ar')}>AR</button>
                    </div>
                  </div>
                  <div className="profile-setting">
                    <span>{t('profile.appearance')}</span>
                    <div className="toggle">
                      <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>Dark</button>
                      <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>Light</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile-only compact header (below 768px — .topbar is hidden there) */}
        <div className="md:hidden sticky top-0 z-40 bg-brand-bg/90 backdrop-blur-xl border-b border-brand-border px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-brand-border shrink-0">
              <img src="/logo.svg" alt="Nokael Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-display font-medium tracking-tight truncate">{TAB_META[activeTab].title}</h2>
              <p className="text-xs text-brand-muted truncate">{TAB_META[activeTab].subtitle}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-brand-muted hover:text-brand-text transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

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
        <div className={cn('page-body', activeTab === 'pipeline' && 'jw-page', activeTab === 'drivers' && 'enterprise-page')}>

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
            <JobsView
              jobs={jobs}
              drivers={drivers}
              onUpdate={fetchData}
              onNewJob={guard(() => setShowJobCreateModal(true))}
              onOpenMap={() => setActiveTab('map')}
              onManageJob={setSelectedJob}
              onEditJob={guard(setEditingJob)}
              onDuplicateJob={guard(setDuplicatingJob)}
            />
          ) : activeTab === 'map' ? (
            <React.Suspense fallback={<div className="h-[420px] rounded-2xl border border-brand-border bg-brand-input animate-pulse" />}>
              <LiveMapView jobs={jobs} drivers={drivers} orgId={orgId} onJobClick={setSelectedJob} onChanged={fetchData} />
            </React.Suspense>
          ) : activeTab === 'quotes' ? (
            <QuotesView
              requests={requests}
              onStatusUpdate={guard(handleStatusUpdate)}
              onReopenQuote={guard(handleReopenQuote)}
              onConvertToJob={guard(handleConvertToJob)}
              onMarkLost={guard(setLostModalQuote)}
              onDelete={guard(handleDelete)}
              onNewQuote={guard(() => {
                setJobPrefillData(undefined);
                setShowJobCreateModal(true);
              })}
            />
          ) : activeTab === 'business' ? (
            <BusinessView
              filteredBusiness={filteredBusiness}
              jobs={jobs}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onStatusUpdate={guard(handleBusinessUpdate)}
              onViewDetails={setSelectedBusiness}
              onRefresh={fetchData}
            />
          ) : activeTab === 'team' ? (
            <TeamPanel orgId={orgId} currentRole={currentRole} />
          ) : activeTab === 'alerts' ? (
            <AlertsView
              alerts={alerts}
              onOpenJob={(jobId) => {
                const job = jobs.find(j => j.id === jobId);
                if (job) setSelectedJob(job);
              }}
            />
          ) : activeTab === 'settings' ? (
            <SettingsView
              theme={theme}
              onThemeChange={setTheme}
              userEmail={userEmail ?? undefined}
              orgId={orgId}
              currentRole={currentRole}
            />
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
              onDriverStatusUpdate={guard(handleDriverStatusUpdate)}
              onViewDriver={handleViewDriver}
              onAddAgent={guard(() => setShowAddAgentModal(true))}
            />
          )}

        </div>
      </main>

      {/* Driver near pickup / drop-off, on any tab */}
      <GeofenceAlerts jobs={jobs} onOpenJob={setSelectedJob} />

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedDriver && (
          <DriverProfileModal
            driver={selectedDriver}
            onClose={() => setSelectedDriver(null)}
            onDriverStatusUpdate={guard(handleDriverStatusUpdate)}
          />
        )}
        {selectedBusiness && (
          <BusinessAccountDrawer
            business={selectedBusiness}
            onClose={() => setSelectedBusiness(null)}
            onUpdate={guard(handleBusinessUpdate)}
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
        {editingJob && (
          <JobCreateModal
            key={`edit-${editingJob.id}`}
            editJob={editingJob}
            drivers={approvedDrivers}
            businessInquiries={businessInquiries}
            onClose={() => setEditingJob(null)}
            onSuccess={fetchData}
          />
        )}
        {duplicatingJob && (
          <JobCreateModal
            key={`dup-${duplicatingJob.id}`}
            duplicateFrom={duplicatingJob}
            drivers={approvedDrivers}
            businessInquiries={businessInquiries}
            onClose={() => setDuplicatingJob(null)}
            onSuccess={fetchData}
          />
        )}
        {showJobCreateModal && (
          <JobCreateModal
            key={jobPrefillData?.quote_id || 'manual-new'}
            initialData={jobPrefillData}
            quoteRef={requests.find(r => r.id === jobPrefillData?.quote_id)?.tracking_id}
            drivers={approvedDrivers}
            businessInquiries={businessInquiries}
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
        {showAddAgentModal && (
          <AddAgentModal
            onClose={() => setShowAddAgentModal(false)}
            onSuccess={fetchData}
          />
        )}
      </AnimatePresence>

    </div>
    </PermissionsProvider>
  );
}
