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
  RefreshCw,
  BarChart3,
  MessageSquareReply,
  MoreHorizontal,
  X,
  Download,
  Share,
} from 'lucide-react';
import {
  type QuoteRequest,
  type Driver,
  type DriverDocument,
  type BusinessInquiry,
  type Job,
  type JobWithDriver,
  clearStaleAuthSession,
  supabase,
} from '../lib/supabase';
import { jobToDraft, reverseDraft, sameAddress } from '../lib/jobDraft';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/config';
import { cn } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';
import { initDispatchPwa, setThemeColor, useInstallState } from '../lib/pwa';
import { enableStaffPush, getPushState, syncStaffPush, type PushState } from '../lib/push';

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
import { FollowUpsView } from './dashboard/FollowUpsView';
import { getFollowUps, bucketOf, useFollowUpState } from './dashboard/followUps';
import { SettingsView } from './dashboard/SettingsView';
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
import { getActiveTenant, tenantDisplayName } from '../lib/tenant';

export default function Dashboard() {
  const { t } = useTranslation('dashboard');
  type Tab = 'pipeline' | 'map' | 'quotes' | 'followups' | 'drivers' | 'business' | 'team' | 'alerts' | 'settings';
  const TABS: Tab[] = ['pipeline', 'map', 'quotes', 'followups', 'drivers', 'business', 'team', 'alerts', 'settings'];
  // The open tab lives in ?tab= so a reload (common on phones) keeps it.
  const [activeTab, setActiveTab] = React.useState<Tab>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab') as Tab | null;
    return fromUrl && TABS.includes(fromUrl) ? fromUrl : 'pipeline';
  });
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activeTab === 'pipeline') params.delete('tab'); else params.set('tab', activeTab);
    const qs = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
  }, [activeTab]);
  // Phone bottom bar: the four tabs dispatch uses on the move, the rest under More.
  const [moreOpen, setMoreOpen] = React.useState(false);
  const goTab = (tab: Tab) => {
    setActiveTab(tab);
    setMoreOpen(false);
  };
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  // Installable app (PWA): manifest, home-screen tags, service worker.
  React.useEffect(() => { initDispatchPwa(); }, []);
  const install = useInstallState();
  const [iosInstallHelp, setIosInstallHelp] = React.useState(false);

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
    driverPresence,
    refreshing,
    lastSyncedAt,
    syncAll,
  } = useDashboardData();

  // Status bar / browser bar follows the dashboard theme.
  React.useEffect(() => {
    const id = requestAnimationFrame(() => {
      const app = document.querySelector('.app');
      const bg = app ? getComputedStyle(app).backgroundColor : '';
      if (bg && bg !== 'rgba(0, 0, 0, 0)') setThemeColor(bg);
    });
    return () => cancelAnimationFrame(id);
    // `loading`: the shell (.app) only exists once the first load is done.
  }, [theme, loading]);

  // ── Shell state (sidebar collapse, profile menu) ────────────
  const [collapsed, setCollapsed] = React.useState(() => {
    try { return localStorage.getItem('nokael-dashboard-sidebar-collapsed') === '1'; } catch { return false; }
  });
  // Stat cards on every tab can be tucked away for more working space; remembered per browser.
  const [statsHidden, setStatsHidden] = React.useState(() => {
    try { return localStorage.getItem('nokael-dashboard-stats-hidden') === '1'; } catch { return false; }
  });
  const toggleStats = () => {
    setStatsHidden(prev => {
      const next = !prev;
      try { localStorage.setItem('nokael-dashboard-stats-hidden', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };
  const statsToggleLabel = statsHidden
    ? t('profile.showStats', { defaultValue: 'Show stats' })
    : t('profile.hideStats', { defaultValue: 'Hide stats' });
  const [profileOpen, setProfileOpen] = React.useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [pushState, setPushState] = React.useState<PushState | null>(null);
  const notifRef = React.useRef<HTMLDivElement>(null);

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

  React.useEffect(() => {
    if (!notifOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNotifOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [notifOpen]);

  // Keep this browser's push registration current (never prompts; see Settings → Notifications).
  React.useEffect(() => {
    if (orgId) void syncStaffPush(orgId);
  }, [orgId]);
  React.useEffect(() => {
    if (notifOpen) getPushState().then(setPushState).catch(() => setPushState('unsupported'));
  }, [notifOpen]);

  // ── Modal / selection state ──────────────────────────────────────────────────
  const [selectedDriver, setSelectedDriver] = React.useState<(Driver & { documents: DriverDocument[] }) | null>(null);
  const [selectedBusiness, setSelectedBusiness] = React.useState<BusinessInquiry | null>(null);
  // The job open in the Jobs workspace. Anywhere else that "opens" a job (map,
  // alerts, geofence toasts) switches to that tab with the job selected.
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);
  const [showJobCreateModal, setShowJobCreateModal] = React.useState(false);
  const [showAddAgentModal, setShowAddAgentModal] = React.useState(false);
  const [editingJob, setEditingJob] = React.useState<JobWithDriver | null>(null);
  const [duplicatingJob, setDuplicatingJob] = React.useState<JobWithDriver | null>(null);
  const [jobPrefillData, setJobPrefillData] = React.useState<Partial<Job> | undefined>(undefined);
  // The old job a converted re-booking repeats (offers its COC GPS in the form).
  const [jobPrefillSource, setJobPrefillSource] = React.useState<{ job: Job; reversed: boolean } | null>(null);
  const [lostModalQuote, setLostModalQuote] = React.useState<QuoteRequest | null>(null);

  // ── View / filter state ──────────────────────────────────────────────────────
  const [jobViewMode, setJobViewMode] = React.useState<'kanban' | 'list'>('kanban');
  const [jobStatusFilter, setJobStatusFilter] = React.useState<JobStatusFilter>('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState<string>('active');
  const [filterVehicle, setFilterVehicle] = React.useState<string>('all');

  const openJob = React.useCallback((jobId: string | undefined) => {
    if (!jobId) return;
    setSelectedJobId(jobId);
    setActiveTab('pipeline');
  }, []);

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

  const handleConvertToJob = async (quote: QuoteRequest) => {
    // A client-app re-booking repeats an old job: start from that job (contacts,
    // stop details, cargo, price), the other way round if the client chose
    // "send it back", keeping the quote's own address text and link.
    if (quote.rebook_of_job_id) {
      let original: Job | null = jobs.find(j => j.id === quote.rebook_of_job_id) ?? null;
      if (!original && supabase) {
        const { data } = await supabase.from('jobs').select('*').eq('id', quote.rebook_of_job_id).maybeSingle();
        original = (data as Job | null) ?? null;
      }
      if (original) {
        const isReversed = !sameAddress(quote.pickup_location, original.pickup_location)
          && (sameAddress(quote.pickup_location, original.delivery_location) || sameAddress(quote.delivery_location, original.pickup_location));
        const draft = isReversed ? reverseDraft(jobToDraft(original)) : jobToDraft(original);
        // The client may have re-typed a stop: their text wins, and the old pin
        // only stays where the address is unchanged.
        const stop = (s: 'pickup' | 'delivery') => {
          const typed = s === 'pickup' ? quote.pickup_location : quote.delivery_location;
          const same = sameAddress(typed, draft[`${s}_location`]);
          return {
            [`${s}_location`]: typed || draft[`${s}_location`],
            [`${s}_lat`]: same ? draft[`${s}_lat`] : (s === 'pickup' ? quote.pickup_lat : quote.delivery_lat) ?? null,
            [`${s}_lng`]: same ? draft[`${s}_lng`] : (s === 'pickup' ? quote.pickup_lng : quote.delivery_lng) ?? null,
          };
        };
        setJobPrefillData({
          ...draft,
          ...stop('pickup'),
          ...stop('delivery'),
          item_type: (quote.item_type as any) || draft.item_type,
          urgency: (quote.urgency as any) || draft.urgency,
          special_instructions: [draft.special_instructions, quote.notes].filter(Boolean).join('\n') || null,
          quote_id: quote.id,
        });
        setJobPrefillSource({ job: original, reversed: isReversed });
        setShowJobCreateModal(true);
        return;
      }
    }
    setJobPrefillSource(null);
    setJobPrefillData({
      sender_name: quote.name,
      sender_phone: quote.phone,
      // Public quotes store the route as "Pickup → Delivery"; JobCreateModal splits it.
      pickup_emirate: quote.emirate || getActiveTenant().settings.regions[0] || '',
      pickup_location: quote.pickup_location,
      pickup_lat: quote.pickup_lat ?? null,
      pickup_lng: quote.pickup_lng ?? null,
      delivery_emirate: quote.emirate?.includes('→')
        ? quote.emirate
        : getActiveTenant().settings.country === 'AE'
          ? (quote.emirate === 'Dubai' ? 'Abu Dhabi' : 'Dubai')
          : quote.emirate || '',
      delivery_location: quote.delivery_location,
      delivery_lat: quote.delivery_lat ?? null,
      delivery_lng: quote.delivery_lng ?? null,
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
  // Time-based alerts (client keeping the driver waiting) need a clock, not just job changes.
  const [alertClock, setAlertClock] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setAlertClock(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const alerts             = React.useMemo(() => getAlerts(jobs, alertClock), [jobs, alertClock]);
  const criticalAlertCount = alerts.filter(a => a.severity === 'critical').length;
  const followUpState      = useFollowUpState(orgId);
  const followUps          = React.useMemo(
    () => getFollowUps({ jobs, requests, inquiries: businessInquiries, brand: tenantDisplayName(getActiveTenant()) }),
    [jobs, requests, businessInquiries],
  );
  const followUpsDue       = followUps.filter(f => bucketOf(f, followUpState.state.get(f.key)) === 'due').length;

  // ── Loading gate ─────────────────────────────────────────────────────────────
  if (loading && !selectedDriver) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <Zap className="w-12 h-12 text-brand-neon animate-pulse" />
      </div>
    );
  }

  // ── Nav / tab meta ───────────────────────────────────────────────────────────
  const NAV_ITEMS: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: 'pipeline', label: t('nav.jobs'),     icon: LayoutDashboard },
    { id: 'map',      label: t('nav.map'),      icon: MapPin },
    { id: 'quotes',   label: t('nav.quotes'),   icon: FileText, badge: stats.pending },
    { id: 'followups', label: t('nav.followUps'), icon: MessageSquareReply, badge: followUpsDue },
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
    followups: { title: t('tabMeta.followUps.title'), subtitle: t('tabMeta.followUps.subtitle') },
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
  // The bell lists every tab with something waiting (the same counts as the sidebar badges).
  const notifItems = NAV_ITEMS.filter(item => (item.badge || 0) > 0);
  const hasUrgentBadges = notifItems.length > 0;

  const CONTEXT_STATS: Record<typeof activeTab, { title: string; value: number; icon: any; tone?: StatTone }[]> = {
    pipeline: [],  // JobsView has its own stat cards with additional metrics
    quotes: [],
    followups: [],
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

      {/* ── Sidebar (hidden below 1024px via index.css; the tab strip replaces it) */}
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
      <main className={statsHidden ? 'stats-hidden' : undefined}>

        {/* Top bar (compact below 1024px via index.css) */}
        <header className="topbar">
          <div>
            <h1>{TAB_META[activeTab].title}</h1>
            <p>{TAB_META[activeTab].subtitle}</p>
          </div>
          <div className="top-actions">
            <button
              className={cn('notification', !statsHidden && 'is-active')}
              onClick={toggleStats}
              aria-pressed={!statsHidden}
              aria-label={statsToggleLabel}
              title={statsToggleLabel}
            >
              <BarChart3 className="w-[17px] h-[17px]" />
            </button>
            <button
              className="notification"
              onClick={() => syncAll()}
              disabled={refreshing}
              aria-label={t('profile.sync', { defaultValue: 'Sync now' })}
              title={lastSyncedAt
                ? t('profile.lastSynced', { time: lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), defaultValue: 'Sync now · last synced {{time}}' })
                : t('profile.sync', { defaultValue: 'Sync now' })}
            >
              <RefreshCw className={cn('w-[17px] h-[17px]', refreshing && 'animate-spin')} />
            </button>
            {currentRole === 'viewer' && (
              <span className="neutral-badge" title={READ_ONLY_MESSAGE} style={{ fontSize: 11, padding: '5px 10px' }}>
                {t('profile.viewOnly', { defaultValue: 'View only' })}
              </span>
            )}
            <div className="profile-control" ref={notifRef}>
              <button
                className="notification"
                aria-label={t('profile.notifications')}
                aria-expanded={notifOpen}
                onClick={() => setNotifOpen(open => !open)}
              >
                <Bell className="w-[17px] h-[17px]" />
                {hasUrgentBadges && <i />}
              </button>
              {notifOpen && (
                <div className="profile-menu notif-menu">
                  <div className="profile-menu-title">
                    <b>{t('profile.notifications')}</b>
                    <small>{t('profile.notificationsHint', { defaultValue: 'Items waiting for your review' })}</small>
                  </div>
                  {notifItems.length ? notifItems.map(item => (
                    <button
                      key={item.id}
                      className="notif-item"
                      onClick={() => { setActiveTab(item.id); setNotifOpen(false); }}
                    >
                      <item.icon className="w-4 h-4" aria-hidden="true" />
                      <span>{item.label}</span>
                      <b>{item.badge}</b>
                    </button>
                  )) : (
                    <p className="notif-empty">{t('profile.notificationsEmpty', { defaultValue: 'You’re all caught up.' })}</p>
                  )}
                  {pushState === 'off' && orgId && (
                    <button
                      className="notif-push-cta"
                      onClick={() => enableStaffPush(orgId).then(setPushState).catch(() => setPushState('off'))}
                    >
                      {t('profile.enablePush', { defaultValue: 'Get these as push notifications' })}
                    </button>
                  )}
                </div>
              )}
            </div>
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
                  {(install.canPrompt || install.iosManual) && (
                    <button
                      className="profile-menu-link profile-install"
                      onClick={() => {
                        setProfileOpen(false);
                        if (install.canPrompt) install.install(); else setIosInstallHelp(true);
                      }}
                    >
                      <span>{t('pwa.install', { defaultValue: 'Install Nokael Dispatch app' })}</span>
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                  <button className="profile-logout" onClick={handleLogout}>
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    <span>{t('nav.logout')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

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
            <div className="context-stats grid grid-cols-3 gap-4 mb-8">
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
              selectedId={selectedJobId}
              onSelectJob={setSelectedJobId}
              onEditJob={guard(setEditingJob)}
              onDuplicateJob={guard(setDuplicatingJob)}
            />
          ) : activeTab === 'map' ? (
            <React.Suspense fallback={<div className="h-[420px] rounded-2xl border border-brand-border bg-brand-input animate-pulse" />}>
              <LiveMapView jobs={jobs} drivers={drivers} orgId={orgId} onJobClick={job => openJob(job.id)} onChanged={fetchData} />
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
          ) : activeTab === 'followups' ? (
            <FollowUpsView
              items={followUps}
              state={followUpState.state}
              stateMissing={followUpState.missing}
              onSave={followUpState.save}
              onOpenQuote={() => setActiveTab('quotes')}
              onOpenInquiry={id => {
                const inquiry = businessInquiries.find(b => b.id === id);
                if (inquiry) setSelectedBusiness(inquiry);
              }}
              onOpenJob={openJob}
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
              onOpenJob={openJob}
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
              orgId={orgId}
              driverPoolSummary={driverPoolSummary}
              filteredDrivers={filteredDrivers}
              driverPresence={driverPresence}
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

        {/* Phone / small-screen bottom bar (below 1024px the sidebar is hidden via index.css) */}
        {(() => {
          const primary: Tab[] = ['pipeline', 'map', 'alerts', 'quotes'];
          const main = NAV_ITEMS.filter(item => primary.includes(item.id));
          const more = NAV_ITEMS.filter(item => !primary.includes(item.id));
          const moreActive = more.some(item => item.id === activeTab);
          const moreBadge = more.reduce((sum, item) => sum + (item.badge || 0), 0);
          return (
            <>
              <nav className="mobile-nav" aria-label={t('nav.menu', { defaultValue: 'Menu' })}>
                {main.map(item => (
                  <button
                    key={item.id}
                    onClick={() => goTab(item.id)}
                    className={activeTab === item.id && !moreOpen ? 'active' : ''}
                    aria-current={activeTab === item.id ? 'page' : undefined}
                  >
                    <span className="mobile-nav-icon">
                      <item.icon className="w-5 h-5" aria-hidden="true" />
                      {!!item.badge && <em>{item.badge > 99 ? '99+' : item.badge}</em>}
                    </span>
                    <span>{item.label}</span>
                  </button>
                ))}
                <button
                  onClick={() => setMoreOpen(open => !open)}
                  className={moreActive || moreOpen ? 'active' : ''}
                  aria-expanded={moreOpen}
                  aria-current={moreActive ? 'page' : undefined}
                >
                  <span className="mobile-nav-icon">
                    <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
                    {!!moreBadge && <em>{moreBadge > 99 ? '99+' : moreBadge}</em>}
                  </span>
                  <span>{moreActive ? NAV_ITEMS.find(item => item.id === activeTab)?.label : t('nav.more', { defaultValue: 'More' })}</span>
                </button>
              </nav>
              {moreOpen && (
                <div className="mobile-more" role="dialog" aria-label={t('nav.more', { defaultValue: 'More' })} onClick={() => setMoreOpen(false)}>
                  <div className="mobile-more-sheet" onClick={e => e.stopPropagation()}>
                    <div className="mobile-more-head">
                      <b>{t('nav.more', { defaultValue: 'More' })}</b>
                      <button onClick={() => setMoreOpen(false)} aria-label={t('common.close', { defaultValue: 'Close' })}>
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    {more.map(item => (
                      <button
                        key={item.id}
                        onClick={() => goTab(item.id)}
                        className={activeTab === item.id ? 'active' : ''}
                      >
                        <item.icon className="w-5 h-5" aria-hidden="true" />
                        <span>{item.label}</span>
                        {!!item.badge && <em>{item.badge}</em>}
                      </button>
                    ))}
                    {(install.canPrompt || install.iosManual) && (
                      <button
                        className="mobile-more-install"
                        onClick={() => {
                          setMoreOpen(false);
                          if (install.canPrompt) install.install(); else setIosInstallHelp(true);
                        }}
                      >
                        <Download className="w-5 h-5" aria-hidden="true" />
                        <span>{t('pwa.installShort', { defaultValue: 'Install app' })}</span>
                      </button>
                    )}
                    <button className="mobile-more-logout" onClick={handleLogout}>
                      <LogOut className="w-5 h-5" aria-hidden="true" />
                      <span>{t('nav.logout')}</span>
                    </button>
                  </div>
                </div>
              )}
              {iosInstallHelp && (
                <div className="mobile-more ios-install" role="dialog" aria-label={t('pwa.iosTitle', { defaultValue: 'Add to Home Screen' })} onClick={() => setIosInstallHelp(false)}>
                  <div className="mobile-more-sheet" onClick={e => e.stopPropagation()}>
                    <div className="mobile-more-head">
                      <b>{t('pwa.iosTitle', { defaultValue: 'Add to Home Screen' })}</b>
                      <button onClick={() => setIosInstallHelp(false)} aria-label={t('common.close', { defaultValue: 'Close' })}>
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <ol className="ios-install-steps">
                      <li>
                        <b>1</b>
                        <span>
                          {t('pwa.iosStep1', { defaultValue: 'Tap the Share button' })}{' '}
                          <Share className="w-4 h-4 inline align-[-2px]" aria-hidden="true" />{' '}
                          {t('pwa.iosStep1b', { defaultValue: 'in Safari.' })}
                        </span>
                      </li>
                      <li><b>2</b><span>{t('pwa.iosStep2', { defaultValue: 'Choose “Add to Home Screen”.' })}</span></li>
                      <li><b>3</b><span>{t('pwa.iosStep3', { defaultValue: 'Open Dispatch from your Home Screen. Notifications on iPhone work only from there.' })}</span></li>
                    </ol>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </main>

      {/* Driver near pickup / drop-off, on any tab */}
      <GeofenceAlerts jobs={jobs} onOpenJob={job => openJob(job.id)} />

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
            sourceJob={jobPrefillSource?.job}
            sourceReversed={jobPrefillSource?.reversed}
            drivers={approvedDrivers}
            businessInquiries={businessInquiries}
            onClose={() => {
              setShowJobCreateModal(false);
              setJobPrefillData(undefined);
              setJobPrefillSource(null);
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
