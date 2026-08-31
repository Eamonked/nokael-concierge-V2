import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  Search, 
  Filter, 
  MoreVertical, 
  Phone, 
  MessageSquare,
  Trash2,
  LogOut,
  Zap,
  ArrowRight,
  Activity,
  Shield,
  User,
  Navigation,
  Package,
  Truck,
  FileText,
  ExternalLink,
  Copy,
  Star,
  X,
  Mail,
  MapPin,
  Loader2,
  Plus,
  ChevronRight,
  Download,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Send,
  BarChart3,
  RotateCcw,
  CheckSquare,
  XCircle,
  Sliders,
  FastForward,
  Edit3,
  Check,
  Undo2,
  HelpCircle,
  Ban,
  UserPlus,
  Crown
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { 
  supabase, 
  getQuoteRequests, 
  updateQuoteStatus, 
  deleteQuoteRequest, 
  assignDriverToJob,
  type QuoteRequest,
  getDrivers,
  setDriverPin,
  getDriverWithDocuments,
  updateDriverStatus,
  type Driver,
  type DriverDocument,
  getBusinessInquiries,
  updateBusinessInquiry,
  type BusinessInquiry,
  getJobs,
  createJob,
  updateJob,
  overrideJobLevel,
  overrideCocStep,
  cancelJob,
  reactivateJob,
  subscribeToJobs,
  type Job,
  type JobStatus,
  type ItemType,
  type UrgencyType,
  type JobWithDriver,
  getSafeSession,
  clearStaleAuthSession
} from '../lib/supabase';
import {
  getTeamMembers,
  inviteTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  getCurrentUserOrg,
  type OrgMember,
  type OrgRole
} from '../lib/team';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { generateJobPOC } from '../lib/pdf-export';
import { sendTelegramNotification, formatJobAssignmentNotification } from '../lib/notifications';

type StatTone = 'attention' | 'pending' | 'complete' | 'neutral';

const STAT_TONE_COLOR: Record<StatTone, string> = {
  attention: 'var(--color-signal)',
  pending: 'var(--color-stage-pending)',
  complete: 'var(--color-stage-complete)',
  neutral: 'var(--color-brand-border)',
};

const StatCard: React.FC<{ title: string; value: number; icon: any; tone?: StatTone }> = ({ title, value, icon: Icon, tone = 'neutral' }) => {
  const active = tone !== 'neutral' && value > 0;
  const spine = active ? STAT_TONE_COLOR[tone] : STAT_TONE_COLOR.neutral;
  return (
    <div className="stat-ticket" style={{ '--stat-spine': spine } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-3">
        <p
          className="stat-figure text-3xl font-medium leading-none"
          style={{ color: active ? spine : 'var(--color-brand-text)' }}
        >
          {value}
        </p>
        <Icon className="w-3.5 h-3.5 text-brand-muted opacity-40 shrink-0 mt-0.5" />
      </div>
      <h3 className="text-brand-muted text-xs mt-2 truncate">{title}</h3>
    </div>
  );
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = React.useState<'pipeline' | 'quotes' | 'drivers' | 'business' | 'team'>('pipeline');
  const [orgId, setOrgId] = React.useState<string | null>(null);
  const [currentRole, setCurrentRole] = React.useState<OrgRole | null>(null);
  const [jobs, setJobs] = React.useState<JobWithDriver[]>([]);
  const [requests, setRequests] = React.useState<QuoteRequest[]>([]);
  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [businessInquiries, setBusinessInquiries] = React.useState<BusinessInquiry[]>([]);
  
  const [selectedDriver, setSelectedDriver] = React.useState<(Driver & { documents: DriverDocument[] }) | null>(null);
  const [selectedBusiness, setSelectedBusiness] = React.useState<BusinessInquiry | null>(null);
  const [selectedJob, setSelectedJob] = React.useState<JobWithDriver | null>(null);
  const [showJobCreateModal, setShowJobCreateModal] = React.useState(false);
  const [jobPrefillData, setJobPrefillData] = React.useState<Partial<Job> | undefined>(undefined);
  const [jobViewMode, setJobViewMode] = React.useState<'kanban' | 'list'>('kanban');
  const [jobStatusFilter, setJobStatusFilter] = React.useState<'all' | 'pending' | 'in_transit' | 'completed' | 'cancelled'>('all');

  const [loading, setLoading] = React.useState(true);
  const [isUpdating, setIsUpdating] = React.useState<string | null>(null);
  const [pinDraft, setPinDraft] = React.useState('');
  const [copiedDriverLink, setCopiedDriverLink] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState<string>('all');
  const [filterVehicle, setFilterVehicle] = React.useState<string>('all');
  const navigate = useNavigate();

  // Auth check using real Supabase session
  React.useEffect(() => {
    let isMounted = true;

    if (!supabase) {
      setLoading(false);
      return;
    }
    
    getSafeSession()
      .then((session) => {
        if (!isMounted) return;
        if (!session) {
          navigate('/login');
        } else {
          fetchData();
          getCurrentUserOrg().then((org) => {
            if (!isMounted || !org) return;
            setOrgId(org.orgId);
            setCurrentRole(org.role);
          });
        }
      })
      .catch((err) => {
        console.warn('[Dashboard] Auth validation error:', err);
        clearStaleAuthSession().finally(() => {
          if (isMounted) navigate('/login');
        });
      });

    // Subscribe to job changes
    const subscription = subscribeToJobs((payload) => {
      getJobs().then(jobsData => {
        if (!isMounted) return;
        setJobs(jobsData);
        if (selectedJob?.id) {
          const updatedSelected = jobsData.find(j => j.id === selectedJob.id);
          if (updatedSelected) {
            setSelectedJob(updatedSelected);
          }
        }
      }).catch(console.error);
    });

    return () => {
      isMounted = false;
      if (subscription && supabase) supabase.removeChannel(subscription);
    };
  }, [navigate, selectedJob?.id]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Always fetch everything for cross-referencing
      const [requestsData, driversData, businessData, jobsData] = await Promise.all([
        getQuoteRequests(),
        getDrivers(),
        getBusinessInquiries(),
        getJobs()
      ]);
      setRequests(requestsData);
      setDrivers(driversData);
      setBusinessInquiries(businessData);
      setJobs(jobsData);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to fetch data.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: QuoteRequest['status']) => {
    try {
      await updateQuoteStatus(id, status);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

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
      quote_id: quote.id
    });
    setShowJobCreateModal(true);
  };

  const handleDriverStatusUpdate = async (id: string, updates: Partial<Driver>) => {
    setIsUpdating(id);
    try {
      await updateDriverStatus(id, updates);
      setDrivers(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
      if (selectedDriver?.id === id) {
        setSelectedDriver(prev => prev ? { ...prev, ...updates } : null);
      }
      // Show success briefly? Or just let the UI update
    } catch (error) {
      console.error('Error updating driver:', error);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleBusinessUpdate = async (id: string, updates: Partial<BusinessInquiry>) => {
    try {
      await updateBusinessInquiry(id, updates);
      setBusinessInquiries(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
      if (selectedBusiness?.id === id) {
        setSelectedBusiness(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (error) {
      console.error('Error updating business:', error);
    }
  };

  const handleViewDriver = async (id: string) => {
    try {
      const data = await getDriverWithDocuments(id);
      setSelectedDriver(data);
    } catch (error) {
      console.error('Error fetching driver details:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this request?')) return;
    try {
      await deleteQuoteRequest(id);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting request:', error);
    }
  };

  const handleLogout = async () => {
    await clearStaleAuthSession();
    navigate('/login');
  };

  const filteredRequests = requests.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.pickup_location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.delivery_location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (r.corporate_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (r.tracking_id || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const filteredJobs = jobs.filter(j => {
    const s = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm.trim() || 
                          (j.job_ref || '').toLowerCase().includes(s) ||
                          (j.sender_name || '').toLowerCase().includes(s) ||
                          (j.sender_phone || '').toLowerCase().includes(s) ||
                          (j.recipient_name || '').toLowerCase().includes(s) ||
                          (j.recipient_phone || '').toLowerCase().includes(s) ||
                          (j.pickup_location || '').toLowerCase().includes(s) ||
                          (j.delivery_location || '').toLowerCase().includes(s) ||
                          (j.tracking_token || '').toLowerCase().includes(s) ||
                          (j.company_name || '').toLowerCase().includes(s) ||
                          (j.id || '').toLowerCase().includes(s) ||
                          (j.cancellation_reason || '').toLowerCase().includes(s) ||
                          (j.operator_notes || '').toLowerCase().includes(s) ||
                          (j.driver?.full_name || '').toLowerCase().includes(s);
    
    let matchesStatus = true;
    if (jobStatusFilter === 'pending') matchesStatus = j.status === 'pending';
    else if (jobStatusFilter === 'in_transit') matchesStatus = ['client_pickup', 'driver_pickup', 'driver_delivery'].includes(j.status);
    else if (jobStatusFilter === 'completed') matchesStatus = j.status === 'completed';
    else if (jobStatusFilter === 'cancelled') matchesStatus = j.status === 'cancelled';

    return matchesSearch && matchesStatus;
  });

  const filteredDrivers = drivers.filter(d => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = d.full_name.toLowerCase().includes(searchLower) || 
                          d.email.toLowerCase().includes(searchLower) ||
                          d.phone.toLowerCase().includes(searchLower) ||
                          (d.base_location || '').toLowerCase().includes(searchLower) ||
                          (d.vehicle_type || '').toLowerCase().includes(searchLower);
    const matchesStatus = filterStatus === 'all' || d.onboarding_status === filterStatus;
    const matchesVehicle = filterVehicle === 'all' || d.vehicle_type === filterVehicle;
    return matchesSearch && matchesStatus && matchesVehicle;
  });

  const filteredBusiness = businessInquiries.filter(b => {
    const searchLower = searchTerm.toLowerCase();
    return b.company_name.toLowerCase().includes(searchLower) || 
           b.contact_person.toLowerCase().includes(searchLower) ||
           (b.corporate_code || '').toLowerCase().includes(searchLower);
  });

  const statusSortWeight: Record<string, number> = { available: 0, on_job: 1, offline: 2 };
  const approvedDrivers = drivers
    .filter(d => d.onboarding_status === 'approved')
    .slice()
    .sort((a, b) => {
      const statusDiff = (statusSortWeight[a.status || 'offline'] ?? 2) - (statusSortWeight[b.status || 'offline'] ?? 2);
      if (statusDiff !== 0) return statusDiff;
      return (a.tier || 'D').localeCompare(b.tier || 'D');
    });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    completed: requests.filter(r => r.status === 'completed').length,
    drivers: drivers.length,
    pendingDrivers: drivers.filter(d => d.onboarding_status === 'pending').length,
    business: businessInquiries.length,
    pendingBusiness: businessInquiries.filter(b => b.status === 'pending').length,
  };

  // Mock data for chart (in real app derive from requests)
  const chartData = [
    { name: 'Mon', jobs: 4 },
    { name: 'Tue', jobs: 7 },
    { name: 'Wed', jobs: 5 },
    { name: 'Thu', jobs: 12 },
    { name: 'Fri', jobs: 15 },
    { name: 'Sat', jobs: 9 },
    { name: 'Sun', jobs: 6 },
  ];

  if (loading && !selectedDriver) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <Zap className="w-12 h-12 text-brand-neon animate-pulse" />
      </div>
    );
  }

  const NAV_ITEMS: { id: typeof activeTab; label: string; icon: any; badge?: number }[] = [
    { id: 'pipeline', label: 'Jobs', icon: LayoutDashboard },
    { id: 'quotes', label: 'Quotes', icon: FileText, badge: stats.pending },
    { id: 'drivers', label: 'Drivers', icon: Truck, badge: stats.pendingDrivers },
    { id: 'business', label: 'Business', icon: Shield, badge: stats.pendingBusiness },
    { id: 'team', label: 'Team', icon: Users },
  ];

  const TAB_META: Record<typeof activeTab, { title: string; subtitle: string }> = {
    pipeline: { title: 'Active Jobs', subtitle: 'Track and manage deliveries' },
    quotes: { title: 'Quote Requests', subtitle: 'Incoming delivery requests' },
    drivers: { title: 'Drivers', subtitle: 'Manage driver applications' },
    business: { title: 'Business Clients', subtitle: 'Corporate accounts' },
    team: { title: 'Team', subtitle: 'Manage team access' },
  };

  const jobsActive = jobs.filter(j => j.status !== 'completed').length;
  const jobsCompleted = jobs.filter(j => j.status === 'completed').length;

  const CONTEXT_STATS: Record<typeof activeTab, { title: string; value: number; icon: any; tone?: StatTone }[]> = {
    pipeline: [
      { title: 'Active', value: jobsActive, icon: Zap, tone: 'attention' },
      { title: 'Pending', value: jobs.filter(j => j.status === 'pending').length, icon: Clock, tone: 'pending' },
      { title: 'Completed', value: jobsCompleted, icon: CheckCircle2, tone: 'complete' },
    ],
    quotes: [
      { title: 'New', value: stats.pending, icon: Clock, tone: 'attention' },
      { title: 'Total', value: stats.total, icon: LayoutDashboard },
      { title: 'Completed', value: stats.completed, icon: CheckCircle2, tone: 'complete' },
    ],
    drivers: [
      { title: 'Needs Review', value: stats.pendingDrivers, icon: Clock, tone: 'attention' },
      { title: 'Total', value: stats.drivers, icon: Truck },
      { title: 'Active', value: approvedDrivers.length, icon: CheckCircle2, tone: 'complete' },
    ],
    business: [
      { title: 'New', value: stats.pendingBusiness, icon: Clock, tone: 'attention' },
      { title: 'Total', value: stats.business, icon: Shield },
      { title: 'Active', value: businessInquiries.filter(b => b.status === 'active').length, icon: CheckCircle2, tone: 'complete' },
    ],
    team: [],
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex">
      {/* Sidebar */}
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
                activeTab === item.id ? "bg-brand-neon/10 text-brand-neon" : "text-brand-muted hover:text-brand-text hover:bg-brand-surface"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left truncate">{item.label}</span>
              {!!item.badge && (
                <span className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                  activeTab === item.id ? "bg-brand-neon text-brand-bg" : "bg-brand-input text-brand-muted"
                )}>{item.badge}</span>
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
            Logout
          </button>
        </div>
      </aside>

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

      <div className="flex-1 px-5 md:px-8 py-8 max-w-[1600px] w-full mx-auto">
        {error && (
          <div className="mb-6 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5" />
              <h3 className="text-sm font-semibold">System Error</h3>
            </div>
            <p className="text-xs leading-relaxed opacity-80 mb-3">{error}</p>
            <button onClick={fetchData} className="text-xs font-semibold underline">Retry Connection</button>
          </div>
        )}

        {/* Contextual stats */}
        {CONTEXT_STATS[activeTab].length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {CONTEXT_STATS[activeTab].map(stat => (
              <StatCard key={stat.title} title={stat.title} value={stat.value} icon={stat.icon} tone={stat.tone} />
            ))}
          </div>
        )}

        {activeTab === 'pipeline' ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-brand-surface border border-brand-border rounded-xl p-1">
                  <button 
                    onClick={() => setJobViewMode('kanban')}
                    className={cn(
                      "flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-all",
                      jobViewMode === 'kanban' ? "bg-brand-neon/10 text-brand-neon" : "text-brand-muted hover:text-brand-text"
                    )}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Board
                  </button>
                  <button 
                    onClick={() => setJobViewMode('list')}
                    className={cn(
                      "flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-all",
                      jobViewMode === 'list' ? "bg-brand-neon/10 text-brand-neon" : "text-brand-muted hover:text-brand-text"
                    )}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    List
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-brand-surface border border-brand-border rounded-xl p-1">
                  {[
                    { key: 'all', label: 'All', count: jobs.length },
                    { key: 'pending', label: 'Pending', count: jobs.filter(j => j.status === 'pending').length },
                    { key: 'in_transit', label: 'In Transit', count: jobs.filter(j => ['client_pickup', 'driver_pickup', 'driver_delivery'].includes(j.status)).length },
                    { key: 'completed', label: 'Completed', count: jobs.filter(j => j.status === 'completed').length },
                    { key: 'cancelled', label: 'Cancelled', count: jobs.filter(j => j.status === 'cancelled').length },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setJobStatusFilter(tab.key as any)}
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-all",
                        jobStatusFilter === tab.key 
                          ? tab.key === 'cancelled' ? "bg-red-500/10 text-red-400 font-semibold" : "bg-brand-neon/10 text-brand-neon font-semibold"
                          : "text-brand-muted hover:text-brand-text"
                      )}
                    >
                      {tab.label}
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                        jobStatusFilter === tab.key 
                          ? tab.key === 'cancelled' ? "bg-red-500/20 text-red-400" : "bg-brand-neon/20 text-brand-neon" 
                          : "bg-brand-input text-brand-muted"
                      )}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => setShowJobCreateModal(true)}
                className="flex items-center gap-2 bg-brand-neon text-brand-bg px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90 active:scale-95 transition-all self-end sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                New Job
              </button>
            </div>

            {jobViewMode === 'kanban' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-[calc(100vh-320px)] min-h-[560px]">
                <KanbanColumn 
                  title="Pending" 
                  status="pending" 
                  jobs={filteredJobs.filter(j => j.status === 'pending')} 
                  onJobClick={setSelectedJob} 
                />
                <KanbanColumn 
                  title="In Transit" 
                  status="in_transit" 
                  jobs={filteredJobs.filter(j => ['client_pickup', 'driver_pickup', 'driver_delivery'].includes(j.status))} 
                  onJobClick={setSelectedJob} 
                />
                <KanbanColumn 
                  title="Completed" 
                  status="completed" 
                  jobs={filteredJobs.filter(j => j.status === 'completed')} 
                  onJobClick={setSelectedJob} 
                />
                <KanbanColumn 
                  title="Cancelled" 
                  status="cancelled" 
                  jobs={filteredJobs.filter(j => j.status === 'cancelled')} 
                  onJobClick={setSelectedJob} 
                />
              </div>
            ) : (
              <div className="dispatch-card p-0 overflow-hidden">
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[11px] font-medium text-brand-muted border-b border-brand-border">
                        <th className="pl-6 pr-4 py-3 font-medium">Job</th>
                        <th className="px-4 py-3 font-medium">Corridor</th>
                        <th className="px-4 py-3 font-medium">Driver</th>
                        <th className="px-4 py-3 font-medium w-[160px]">Custody</th>
                        <th className="pl-4 pr-6 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJobs.map((job) => {
                        const stageColor =
                          job.status === 'completed' ? 'var(--color-stage-complete)' :
                          job.status === 'cancelled' ? 'var(--color-stage-cancelled)' :
                          job.status === 'pending' ? 'var(--color-stage-pending)' :
                          'var(--color-stage-transit)';
                        const custodySteps = [
                          { key: 'client_pickup_at', label: 'Sender handover' },
                          { key: 'driver_pickup_at', label: 'Driver pickup' },
                          { key: 'driver_delivery_at', label: 'Inbound' },
                          { key: 'client_delivery_at', label: 'Delivered' }
                        ];
                        return (
                          <tr
                            key={job.id}
                            className="manifest-row border-b border-brand-border last:border-0 hover:bg-brand-surface/40 cursor-pointer"
                            style={{ '--row-spine': stageColor } as React.CSSProperties}
                            onClick={() => setSelectedJob(job)}
                          >
                            <td className="pl-6 pr-4 py-4">
                                <div className="manifest-ref text-sm font-medium text-brand-text mb-1.5">NOK-{job.job_ref?.toString().padStart(4, '0')}</div>
                                <div className="flex items-center gap-1.5">
                                  <span className="stage-dot" style={{ '--dot-color': stageColor } as React.CSSProperties} />
                                  <span className="text-xs text-brand-muted capitalize">{job.status?.replace('_', ' ')}</span>
                                </div>
                                {job.status === 'cancelled' && job.cancellation_reason && (
                                  <p className="text-[10px] text-brand-muted/70 mt-1 line-clamp-1 max-w-[160px]">
                                    {job.cancellation_reason}
                                  </p>
                                )}
                            </td>
                            <td className="px-4 py-4">
                                <div className="manifest-corridor text-sm font-medium text-brand-text mb-1">
                                  {(job.pickup_emirate || '').slice(0, 3).toUpperCase() || 'DXB'} → {(job.delivery_emirate || '').slice(0, 3).toUpperCase() || 'AUH'}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-brand-muted">
                                  <span className="truncate max-w-[110px]">{job.pickup_location}</span>
                                  <span className="opacity-40">–</span>
                                  <span className="truncate max-w-[110px]">{job.delivery_location}</span>
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                {job.driver ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full border border-brand-input-border flex items-center justify-center shrink-0 text-[10px] font-mono text-brand-muted">
                                      {job.driver.full_name?.charAt(0) || '?'}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium text-brand-text truncate">{job.driver.full_name}</p>
                                      <p className="text-[10px] text-brand-muted font-mono">{job.driver.phone}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-brand-muted">Unassigned</span>
                                )}
                            </td>
                            <td className="px-4 py-4">
                                <div className="custody-strip" style={{ '--seg-color': stageColor } as React.CSSProperties}>
                                  {custodySteps.map((step) => (
                                    <span key={step.key} title={step.label} data-done={Boolean((job as any)[step.key])} />
                                  ))}
                                </div>
                            </td>
                            <td className="pl-4 pr-6 py-4 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedJob(job);
                                }}
                                className="text-xs font-medium text-brand-muted hover:text-brand-text transition-colors underline decoration-brand-border hover:decoration-brand-text underline-offset-4"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'quotes' ? (
          <>
            {/* Growth chart — collapsed by default to reduce clutter, real data would replace the placeholder series */}
            <details className="dispatch-card p-6 mb-6 group">
              <summary className="flex justify-between items-center cursor-pointer list-none">
                <div>
                  <h2 className="text-base font-display font-medium tracking-tight">Weekly volume</h2>
                  <p className="text-xs text-brand-muted">Corridor throughput trend</p>
                </div>
                <ChevronRight className="w-4 h-4 text-brand-muted transition-transform group-open:rotate-90" />
              </summary>
              <div className="h-[220px] w-full mt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorJobs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#39FF14" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#39FF14" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="name" stroke="#4A4E54" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#4A4E54" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-border)', borderRadius: '16px' }}
                      itemStyle={{ color: '#39FF14', fontSize: '10px', fontWeight: 600 }}
                    />
                    <Area type="monotone" dataKey="jobs" stroke="#39FF14" fillOpacity={1} fill="url(#colorJobs)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </details>

            {/* Quotes table */}
            <div className="dispatch-card overflow-hidden p-0">
              <div className="p-5 border-b border-brand-border flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-base font-display font-medium tracking-tight self-start md:self-auto">Quote requests</h2>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                    <input 
                      type="text" 
                      placeholder="Search quotes..."
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      className="w-full bg-brand-input border border-brand-input-border rounded-xl py-2.5 pl-10 pr-4 text-xs focus:border-brand-neon/50 outline-none transition-all"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <select 
                    className="bg-brand-input border border-brand-input-border rounded-xl px-4 py-2.5 text-xs font-medium outline-none focus:border-brand-neon/50"
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                  >
                    <option value="all">All status</option>
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="picked_up">Picked up</option>
                    <option value="in_transit">In transit</option>
                    <option value="delivered">Delivered</option>
                    <option value="contacted">Contacted</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-brand-input text-[11px] uppercase tracking-wide font-medium text-brand-muted">
                      <th className="px-6 py-3">Customer</th>
                      <th className="px-6 py-3">Route</th>
                      <th className="px-6 py-3">Details</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-brand-input transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-medium text-brand-text mb-1.5 text-sm">{req.name}</div>
                          <div className="flex flex-col gap-1">
                            <div className="text-xs text-brand-muted font-medium">{req.phone}</div>
                            {req.corporate_code && (
                              <div className="flex items-center gap-1.5">
                                <Shield className="w-3 h-3 text-brand-neon" />
                                <span className="text-[11px] text-brand-neon font-medium font-mono">Corp: {req.corporate_code}</span>
                              </div>
                            )}
                            {req.tracking_id && (
                              <div className="text-[11px] text-brand-muted font-medium font-mono">ID: {req.tracking_id}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3 text-sm font-medium mb-2">
                            <span>{req.pickup_location}</span>
                            <ArrowRight className="w-3 h-3 text-brand-neon" />
                            <span>{req.delivery_location}</span>
                          </div>
                          <div className="text-xs uppercase tracking-wide text-brand-muted font-medium">{req.emirate} Corridor</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-medium text-brand-text mb-1 capitalize">{req.item_type}</div>
                          <div className={cn(
                            "text-xs font-medium capitalize inline-flex items-center gap-1.5",
                            req.urgency === 'immediate' && 'text-red-500',
                            req.urgency === 'today' && 'text-yellow-500',
                            req.urgency === 'scheduled' && 'text-blue-500'
                          )}>
                            {req.urgency === 'immediate' && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                            {req.urgency}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select 
                            value={req.status}
                            onChange={(e) => handleStatusUpdate(req.id!, e.target.value as any)}
                            className={`text-[11px] font-medium uppercase tracking-wide px-4 py-2 rounded-lg border outline-none transition-all ${
                              req.status === 'completed' || req.status === 'delivered' ? 'bg-brand-neon/5 border-brand-neon/20 text-brand-neon' :
                              req.status === 'in_transit' || req.status === 'picked_up' ? 'bg-blue-500/5 border-blue-500/20 text-blue-500' :
                              req.status === 'assigned' ? 'bg-purple-500/5 border-purple-500/20 text-purple-500' :
                              'bg-yellow-500/5 border-yellow-500/20 text-yellow-500'
                            }`}
                          >
                            <option value="pending">Pending</option>
                            <option value="assigned">Assigned</option>
                            <option value="picked_up">Picked Up</option>
                            <option value="in_transit">In Transit</option>
                            <option value="delivered">Delivered</option>
                            <option value="completed">Completed</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleConvertToJob(req)}
                              title="Create Job"
                              className="px-3 py-1.5 bg-brand-neon/10 text-brand-neon text-xs font-medium rounded-lg flex items-center gap-1.5 hover:bg-brand-neon hover:text-brand-bg transition-all"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              Create Job
                            </button>
                            <a 
                              href={`https://wa.me/${req.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-8 h-8 bg-brand-input text-brand-muted rounded-lg flex items-center justify-center hover:bg-brand-surface hover:text-brand-text transition-all"
                              title="WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                            <button 
                              onClick={() => handleDelete(req.id!)}
                              className="w-8 h-8 bg-brand-input text-brand-muted rounded-lg flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 transition-all"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : activeTab === 'business' ? (
          <div className="dispatch-card overflow-hidden p-0">
            <div className="p-5 border-b border-brand-border flex justify-end">
              <div className="relative w-full md:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input 
                  type="text" 
                  placeholder="Search accounts..."
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full bg-brand-input border border-brand-input-border rounded-xl py-2.5 pl-10 pr-4 text-xs focus:border-brand-neon/50 outline-none transition-all"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-brand-input text-[11px] uppercase tracking-wide font-medium text-brand-muted">
                    <th className="px-6 py-3">Company</th>
                    <th className="px-6 py-3">Volume</th>
                    <th className="px-6 py-3">Billing</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {filteredBusiness.map((biz) => (
                    <tr key={biz.id} className="hover:bg-brand-input transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-medium text-brand-text mb-1.5 text-sm">{biz.company_name}</div>
                        <div className="flex flex-col gap-1">
                          <div className="text-xs text-brand-muted font-medium">{biz.contact_person} • {biz.phone_whatsapp}</div>
                          <div className="text-[11px] text-brand-neon font-medium font-mono">ID: {biz.corporate_code}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium mb-1.5">{biz.estimated_monthly_volume} jobs/mo</div>
                        <div className="text-xs uppercase tracking-wide text-brand-muted font-medium truncate max-w-[200px]">{biz.typical_routes}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={cn(
                          "px-3 py-1 inline-block rounded text-[11px] font-medium",
                          biz.invoicing_required ? "bg-brand-neon/10 text-brand-neon border border-brand-neon/20" : "bg-brand-muted/10 text-brand-muted"
                        )}>
                          {biz.invoicing_required ? 'Monthly Invoicing' : 'Standard Pay'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={biz.status}
                          onChange={(e) => handleBusinessUpdate(biz.id!, { status: e.target.value as any })}
                          className={`text-[11px] font-medium uppercase tracking-wide px-4 py-2 rounded-lg border outline-none transition-all ${
                            biz.status === 'active' ? 'bg-brand-neon/5 border-brand-neon/20 text-brand-neon' :
                            biz.status === 'archived' ? 'bg-red-500/5 border-red-500/20 text-red-500' :
                            'bg-yellow-500/5 border-yellow-500/20 text-yellow-500'
                          }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="active">Active</option>
                          <option value="archived">Archived</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setSelectedBusiness(biz)}
                          className="px-6 py-2.5 bg-brand-surface border border-brand-border text-brand-text text-xs font-medium rounded-lg hover:bg-brand-neon hover:text-brand-bg transition-all"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'team' ? (
          <TeamPanel orgId={orgId} currentRole={currentRole} />
        ) : (
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
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="all">All status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
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
                        <select 
                          value={driver.onboarding_status}
                          onChange={(e) => handleDriverStatusUpdate(driver.id!, { onboarding_status: e.target.value as any })}
                          className={`text-[11px] font-medium uppercase tracking-wide px-4 py-2 rounded-lg border outline-none transition-all ${
                            driver.onboarding_status === 'approved' ? 'bg-brand-neon/5 border-brand-neon/20 text-brand-neon' :
                            driver.onboarding_status === 'rejected' ? 'bg-red-500/5 border-red-500/20 text-red-500' :
                            'bg-yellow-500/5 border-yellow-500/20 text-yellow-500'
                          }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleViewDriver(driver.id!)}
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
        )}
      </div>
      </div>

      {/* Driver Profile Modal */}
      {selectedDriver && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-brand-bg/90 backdrop-blur-sm"
            onClick={() => setSelectedDriver(null)}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-4xl bg-brand-bg border border-brand-border rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="p-8 border-b border-brand-border flex justify-between items-center bg-brand-surface/30">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-brand-neon/10 flex items-center justify-center border border-brand-neon/20">
                  <User className="w-8 h-8 text-brand-neon" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-medium tracking-tighter mb-1">{selectedDriver.full_name}</h2>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-brand-muted uppercase tracking-wide font-medium">Driver ID: {selectedDriver.id?.substring(0, 8)}</p>
                    <div className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium border",
                      selectedDriver.onboarding_status === 'approved' ? "bg-brand-neon/10 text-brand-neon border-brand-neon/20" :
                      selectedDriver.onboarding_status === 'rejected' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                      "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                    )}>
                      {selectedDriver.onboarding_status || 'pending'}
                    </div>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDriver(null)}
                className="p-2 text-brand-muted hover:text-brand-text transition-colors bg-brand-input rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-8 no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div className="space-y-6">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted border-b border-brand-border pb-2">Contact Details</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-brand-input rounded-lg"><Phone className="w-4 h-4 text-brand-neon" /></div>
                      <span className="text-sm font-mono tracking-tight">{selectedDriver.phone}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-brand-input rounded-lg"><Mail className="w-4 h-4 text-brand-neon" /></div>
                      <span className="text-sm truncate">{selectedDriver.email}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-brand-input rounded-lg"><MapPin className="w-4 h-4 text-brand-neon" /></div>
                      <span className="text-sm">{selectedDriver.base_location}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted border-b border-brand-border pb-2">Vehicle & Logistics</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-brand-input rounded-lg"><Truck className="w-4 h-4 text-brand-neon" /></div>
                      <span className="text-sm">{selectedDriver.vehicle_type}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-brand-input rounded-lg"><Navigation className="w-4 h-4 text-brand-neon" /></div>
                      <span className="text-sm">Inter-Emirate: {selectedDriver.inter_emirate ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-brand-input rounded-lg"><Clock className="w-4 h-4 text-brand-neon" /></div>
                      <span className="text-xs text-brand-muted">{selectedDriver.availability_hours}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted border-b border-brand-border pb-2">Internal Management</h3>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-medium text-brand-muted">Tiering Strategy</label>
                      <select 
                        value={selectedDriver.tier || 'D'}
                        onChange={(e) => handleDriverStatusUpdate(selectedDriver.id!, { tier: e.target.value as any })}
                        className="w-full bg-brand-input border border-brand-input-border rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-brand-neon/50 transition-all font-mono"
                      >
                        <option value="A">Elite Rank (A)</option>
                        <option value="B">Priority Rank (B)</option>
                        <option value="C">Standard Rank (C)</option>
                        <option value="D">New Arrival (D)</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-medium text-brand-muted">Reliability Score (1-10)</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="number"
                          min="0"
                          max="10"
                          value={isNaN(selectedDriver.reliability_score!) ? 0 : (selectedDriver.reliability_score || 0)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            handleDriverStatusUpdate(selectedDriver.id!, { reliability_score: isNaN(val) ? 0 : val });
                          }}
                          className="w-16 bg-brand-input border border-brand-input-border rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-brand-neon transition-all font-mono"
                        />
                        <div className="flex-1 bg-brand-input h-2 rounded-full overflow-hidden border border-brand-border">
                          <div 
                            className="h-full bg-brand-neon transition-all" 
                            style={{ width: `${(isNaN(selectedDriver.reliability_score!) ? 0 : (selectedDriver.reliability_score || 0)) * 10}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-medium text-brand-muted">Dispatch Pool Status</label>
                      {(() => {
                        const statusMap: Record<string, { label: string; dot: string; text: string }> = {
                          available: { label: 'Available now', dot: 'bg-emerald-400', text: 'text-emerald-400' },
                          on_job: { label: 'On a job', dot: 'bg-amber-400', text: 'text-amber-400' },
                          offline: { label: 'Offline', dot: 'bg-brand-muted', text: 'text-brand-muted' },
                        };
                        const cfg = statusMap[selectedDriver.status || 'offline'] || statusMap.offline;
                        return (
                          <div className="flex items-center gap-2 px-3 py-2 bg-brand-input border border-brand-input-border rounded-lg w-fit">
                            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                            <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                          </div>
                        );
                      })()}
                      <p className="text-[10px] text-brand-muted">Set by the driver in their app, or automatically when a job is assigned or completed.</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-medium text-brand-muted">Driver App PIN</label>
                      <p className="text-[10px] text-brand-muted mb-1">Set a 4-6 digit PIN so this driver can log into the status app and toggle their own availability. Share it with them over WhatsApp along with their status link.</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="e.g. 4821"
                          value={pinDraft}
                          onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ''))}
                          className="w-28 bg-brand-input border border-brand-input-border rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-brand-neon transition-all font-mono"
                        />
                        <button
                          type="button"
                          disabled={!/^[0-9]{4,6}$/.test(pinDraft) || isUpdating === selectedDriver.id}
                          onClick={async () => {
                            try {
                              await setDriverPin(selectedDriver.id!, pinDraft);
                              setPinDraft('');
                              alert(`PIN set. Send ${selectedDriver.full_name} their status link + this PIN over WhatsApp.`);
                            } catch (err: any) {
                              alert(`Failed to set PIN: ${err.message || err}`);
                            }
                          }}
                          className="px-4 py-2 bg-brand-neon/10 border border-brand-neon/20 text-brand-neon rounded-lg text-[11px] font-medium uppercase tracking-wide hover:bg-brand-neon/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Set PIN
                        </button>
                      </div>
                      {(() => {
                        const cocDomain = (import.meta.env.VITE_COC_URL || 'https://nokael.ae').replace(/\/$/, '');
                        const statusUrl = `${cocDomain}/driver/${selectedDriver.id}/status`;
                        return (
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(statusUrl);
                                setCopiedDriverLink(true);
                                setTimeout(() => setCopiedDriverLink(false), 2000);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-input hover:bg-brand-border rounded-lg border border-brand-border text-xs font-semibold text-brand-neon tracking-wider uppercase transition-all hover:scale-105"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedDriverLink ? 'Copied' : 'Copy status link'}
                            </button>
                            <a
                              href={statusUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-input hover:bg-brand-border rounded-lg border border-brand-border text-xs font-semibold text-brand-muted hover:text-brand-text tracking-wider uppercase transition-all hover:scale-105"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Open link
                            </a>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted border-b border-brand-border pb-4 mb-6">Uploaded Documents (Google Drive)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedDriver.documents?.map((doc) => (
                    <div key={doc.id} className="p-6 bg-brand-input border border-brand-input-border rounded-2xl flex items-center justify-between group hover:border-brand-neon/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-brand-bg flex items-center justify-center text-brand-muted group-hover:text-brand-neon transition-all">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-brand-text mb-1">{doc.document_type.replace('_', ' ')}</div>
                          <div className="text-[11px] text-brand-muted ">Status: {doc.verification_status}</div>
                        </div>
                      </div>
                      <a 
                        href={doc.file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-lg border border-brand-border flex items-center justify-center text-brand-muted hover:bg-brand-neon hover:text-brand-bg hover:border-brand-neon transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                  {(!selectedDriver.documents || selectedDriver.documents.length === 0) && (
                    <div className="col-span-2 p-8 bg-brand-input rounded-3xl border border-dashed border-brand-border text-center opacity-50">
                      <FileText className="w-10 h-10 text-brand-muted mx-auto mb-4" />
                      <p className="text-xs font-medium text-brand-muted">No documents found</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted mb-6">Internal Audit Notes</h3>
                <textarea 
                  className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-6 text-sm outline-none focus:border-brand-neon/50 transition-all min-h-[150px] font-mono text-[11px]"
                  placeholder="Record verification results or history..."
                  value={selectedDriver.internal_notes || ''}
                  onChange={(e) => handleDriverStatusUpdate(selectedDriver.id!, { internal_notes: e.target.value })}
                />
              </div>
            </div>

            <div className="p-8 border-t border-brand-border bg-brand-surface/50 flex gap-4">
              <button 
                disabled={isUpdating === selectedDriver.id}
                onClick={async (e) => {
                  e.stopPropagation();
                  await handleDriverStatusUpdate(selectedDriver.id!, { onboarding_status: 'approved' });
                }}
                className="flex-1 py-5 bg-brand-neon text-brand-bg text-xs font-medium uppercase tracking-wide rounded-2xl hover:bg-white disabled:opacity-50 transition-all flex items-center justify-center gap-3 group shadow-lg shadow-brand-neon/10"
              >
                {isUpdating === selectedDriver.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-brand-bg" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                )}
                {selectedDriver.onboarding_status === 'approved' ? 'Update & Re-Approve' : 'Approve Driver'}
              </button>
              <button 
                disabled={isUpdating === selectedDriver.id}
                onClick={async (e) => {
                  e.stopPropagation();
                  await handleDriverStatusUpdate(selectedDriver.id!, { onboarding_status: 'rejected' });
                }}
                className="flex-1 py-5 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium uppercase tracking-wide rounded-2xl hover:bg-red-500 hover:text-white disabled:opacity-50 transition-all flex items-center justify-center gap-3 group"
              >
                {isUpdating === selectedDriver.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                )}
                Reject Application
              </button>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Business Details Modal */}
      {selectedBusiness && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-brand-bg/90 backdrop-blur-sm"
            onClick={() => setSelectedBusiness(null)}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-4xl bg-brand-bg border border-brand-border rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="p-8 border-b border-brand-border flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-display font-medium tracking-tighter mb-1">{selectedBusiness.company_name}</h2>
                <p className="text-xs text-brand-muted uppercase tracking-wide font-medium">Business Entity</p>
              </div>
              <button 
                onClick={() => setSelectedBusiness(null)}
                className="p-2 text-brand-muted hover:text-brand-text transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-8 no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div className="space-y-6">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted">Point of Contact</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sm">
                      <User className="w-4 h-4 text-brand-neon" />
                      <span>{selectedBusiness.contact_person}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-brand-neon" />
                      <span>{selectedBusiness.phone_whatsapp}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-brand-neon" />
                      <span>{selectedBusiness.email}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted">Operational Scope</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sm">
                      <Navigation className="w-4 h-4 text-brand-neon" />
                      <span className="text-xs">{selectedBusiness.typical_routes}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Package className="w-4 h-4 text-brand-neon" />
                      <span>{selectedBusiness.item_types}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Activity className="w-4 h-4 text-brand-neon" />
                      <span>{selectedBusiness.estimated_monthly_volume} Jobs/mo</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted">Contract Admin</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-brand-muted">Status</label>
                      <select 
                        value={selectedBusiness.status}
                        onChange={(e) => handleBusinessUpdate(selectedBusiness.id!, { status: e.target.value as any })}
                        className="bg-brand-input border border-brand-input-border rounded-lg px-3 py-1.5 text-xs font-medium outline-none"
                      >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        selectedBusiness.invoicing_required ? "bg-brand-neon" : "bg-brand-muted"
                      )} />
                      <span className="text-xs font-medium text-brand-text">
                        {selectedBusiness.invoicing_required ? 'Monthly Invoicing' : 'Standard Payment'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-brand-muted mb-6">CRM & Follow-up Notes</h3>
                <textarea 
                  className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-6 text-sm outline-none focus:border-brand-neon/50 transition-all min-h-[150px]"
                  placeholder="Logs, pre-agreed rates, contract details..."
                  value={selectedBusiness.follow_up_notes || ''}
                  onChange={(e) => handleBusinessUpdate(selectedBusiness.id!, { follow_up_notes: e.target.value })}
                />
              </div>
            </div>

            <div className="p-8 border-t border-brand-border bg-brand-surface/50 flex gap-4">
              <a 
                href={`https://wa.me/${selectedBusiness.phone_whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-4 bg-brand-neon text-brand-bg text-xs font-medium uppercase tracking-wide rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-3"
              >
                <MessageSquare className="w-4 h-4" />
                Contact Decision Maker
              </a>
              <button 
                onClick={() => setSelectedBusiness(null)}
                className="px-8 py-4 bg-brand-input border border-brand-input-border text-brand-text text-xs font-medium uppercase tracking-wide rounded-xl hover:bg-brand-surface transition-all"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Unified Mission Modals */}
      <AnimatePresence>
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
            initialData={jobPrefillData}
            drivers={approvedDrivers}
            onClose={() => {
              setShowJobCreateModal(false);
              setJobPrefillData(undefined);
            }}
            onSuccess={fetchData}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// UNIFIED COMMAND CENTRE SUB-COMPONENTS
// ==========================================

const KanbanColumn = ({ title, status, jobs, onJobClick }: { title: string, status: JobStatus | 'in_transit', jobs: Job[], onJobClick: (job: Job) => void }) => {
  return (
    <div className="flex flex-col h-full bg-brand-surface/30 rounded-3xl border border-brand-border/50 overflow-hidden">
      <div className="p-5 border-b border-brand-border flex justify-between items-center bg-brand-surface/50">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "w-2.5 h-2.5 rounded-full animate-pulse",
            status === 'pending' ? "bg-yellow-500" :
            status === 'client_pickup' || status === 'driver_pickup' ? "bg-blue-500" :
            status === 'driver_delivery' ? "bg-purple-500" : 
            status === 'cancelled' ? "bg-red-500" : "bg-brand-neon"
          )} />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-text">{title}</h3>
        </div>
        <span className={cn(
          "text-xs font-mono font-semibold px-2 py-0.5 rounded border",
          status === 'cancelled' && jobs.length > 0 ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-brand-bg text-brand-muted border-brand-border"
        )}>{jobs.length}</span>
      </div>
      <div className="p-3.5 flex-grow overflow-y-auto no-scrollbar space-y-3">
        {jobs.map((job) => (
          <motion.div
            layoutId={job.id}
            key={job.id}
            onClick={() => onJobClick(job)}
            className={cn(
              "dispatch-card p-4 cursor-pointer transition-all group relative",
              job.status === 'cancelled' 
                ? "border-red-500/30 hover:border-red-500/60 bg-red-950/10" 
                : "hover:border-brand-neon/50"
            )}
          >
            <div className="flex justify-between items-start mb-3">
              <span className={cn(
                "text-[11px] font-semibold font-mono px-2 py-0.5 rounded",
                job.status === 'cancelled' 
                  ? "text-red-400 bg-red-500/10" 
                  : "text-brand-neon bg-brand-neon/10"
              )}>
                #{job.job_ref?.toString().padStart(4, '0')}
              </span>
              <span className="text-[11px] font-medium text-brand-muted">{format(new Date(job.created_at || new Date()), 'HH:mm')}</span>
            </div>

            {job.status === 'cancelled' && (
              <div className="mb-3 px-2.5 py-1 bg-red-500/15 border border-red-500/30 rounded-lg flex items-center gap-1.5 text-red-400 text-xs font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{job.cancellation_reason || 'Failed / Cancelled'}</span>
              </div>
            )}

            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-brand-muted shrink-0" />
                <p className="text-xs font-medium truncate">{job.pickup_location}</p>
              </div>
              <ChevronRight className="w-3 h-3 text-brand-muted mx-auto" />
              <div className="flex items-center gap-2">
                <Navigation className="w-3 h-3 text-brand-muted shrink-0" />
                <p className="text-xs font-medium truncate">{job.delivery_location}</p>
              </div>
            </div>

            {/* COC Mini Progress Bar */}
            <div className="flex items-center gap-1 my-3 pt-2 border-t border-brand-border/60">
              {[
                { key: 'client_pickup_at', label: 'Sender' },
                { key: 'driver_pickup_at', label: 'Driver' },
                { key: 'driver_delivery_at', label: 'Arrive' },
                { key: 'client_delivery_at', label: 'Signed' }
              ].map((step, idx) => (
                <div 
                  key={step.key} 
                  title={step.label}
                  className={cn(
                    "flex-1 h-1.5 rounded-full transition-colors",
                    (job as any)[step.key] ? "bg-brand-neon" : "bg-brand-input"
                  )} 
                />
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-brand-border">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-5 h-5 rounded-full bg-brand-input flex items-center justify-center border border-brand-border shrink-0">
                  <User className="w-2.5 h-2.5 text-brand-muted" />
                </div>
                <span className="text-xs text-brand-muted font-medium truncate max-w-[90px]">{job.sender_name}</span>
              </div>
              <div className={cn(
                "px-2 py-0.5 rounded text-[11px] font-medium shrink-0",
                job.urgency === 'immediate' ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                job.urgency === 'today' ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" :
                "bg-blue-500/10 text-blue-500 border border-blue-500/20"
              )}>
                {job.urgency}
              </div>
            </div>
          </motion.div>
        ))}
        {jobs.length === 0 && (
          <div className="h-32 flex items-center justify-center border-2 border-dashed border-brand-border rounded-2xl opacity-30">
            <span className="text-xs font-medium">Clear</span>
          </div>
        )}
      </div>
    </div>
  );
};

const STAGE_ORDER: JobStatus[] = ['pending', 'client_pickup', 'driver_pickup', 'driver_delivery', 'completed'];

const STAGE_CONFIG: Record<JobStatus, { label: string; short: string; color: string; desc: string; icon: any }> = {
  pending: {
    label: 'Pending Dispatch',
    short: 'Pending',
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    desc: 'Job created, awaiting driver pickup or sender handover.',
    icon: Clock
  },
  client_pickup: {
    label: 'Sender Handover',
    short: 'Sender Handover',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    desc: 'Sender confirmed item handover to driver.',
    icon: Package
  },
  driver_pickup: {
    label: 'Driver In-Transit',
    short: 'In Transit',
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    desc: 'Driver confirmed package in custody, moving along corridor.',
    icon: Truck
  },
  driver_delivery: {
    label: 'Destination Arrival',
    short: 'Arrived',
    color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    desc: 'Driver arrived at recipient drop-off point.',
    icon: Navigation
  },
  completed: {
    label: 'Delivered & Signed',
    short: 'Completed',
    color: 'bg-brand-neon/10 text-brand-neon border-brand-neon/20',
    desc: 'Recipient confirmed package delivery. Full COC sealed.',
    icon: CheckCircle2
  },
  cancelled: {
    label: 'Failed / Cancelled',
    short: 'Failed',
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
    desc: 'Job encountered an operational failure or cancellation.',
    icon: Ban
  }
};

const COMMON_FAILURE_REASONS = [
  'Client / Sender unavailable (No-Show)',
  'Recipient refused to accept package',
  'Building / Gate security denied entry',
  'Incorrect / Non-existent address',
  'Damaged or prohibited item',
  'Client cancelled shipment request',
  'Pilot / Vehicle mechanical breakdown',
  'Corridor weather / road closure'
];

const JobDetailModal = ({ job, drivers, onClose, onUpdate }: { job: JobWithDriver, drivers: Driver[], onClose: () => void, onUpdate: () => void }) => {
  const [copiedStep, setCopiedStep] = React.useState<string | null>(null);
  const [reassigning, setReassigning] = React.useState(false);
  const [assigningDriver, setAssigningDriver] = React.useState(false);

  // Command Center Override State
  const [targetStatus, setTargetStatus] = React.useState<JobStatus>(job.status || 'pending');
  const [autoTimestampCoc, setAutoTimestampCoc] = React.useState(true);
  const [operatorNotes, setOperatorNotes] = React.useState(job.operator_notes || '');
  const [isApplyingOverride, setIsApplyingOverride] = React.useState(false);
  const [overrideMessage, setOverrideMessage] = React.useState<string | null>(null);

  // Failure modal state
  const [showFailModal, setShowFailModal] = React.useState(false);
  const [failReason, setFailReason] = React.useState(COMMON_FAILURE_REASONS[0]);
  const [customFailReason, setCustomFailReason] = React.useState('');
  const [isCancelling, setIsCancelling] = React.useState(false);

  // COC Step Force-action state
  const [actingStep, setActingStep] = React.useState<string | null>(null);
  const [stepNotes, setStepNotes] = React.useState<Record<string, string>>({});

  // Keep targetStatus in sync when job updates
  React.useEffect(() => {
    setTargetStatus(job.status || 'pending');
    setOperatorNotes(job.operator_notes || '');
  }, [job.status, job.operator_notes]);

  const handleNextStage = async () => {
    const currentIndex = STAGE_ORDER.indexOf(job.status as any);
    if (currentIndex === -1 || currentIndex >= STAGE_ORDER.length - 1) return;
    const nextStatus = STAGE_ORDER[currentIndex + 1];
    
    setIsApplyingOverride(true);
    try {
      await overrideJobLevel(job.id!, {
        status: nextStatus,
        autoTimestampCoc: true,
        overrideNotes: operatorNotes || `Advanced to ${STAGE_CONFIG[nextStatus].label} by Command Centre`
      });
      setOverrideMessage(`Job advanced to ${STAGE_CONFIG[nextStatus].label}`);
      setTimeout(() => setOverrideMessage(null), 3000);
      onUpdate();
    } catch (err: any) {
      alert(`Failed to advance job stage: ${err.message || err}`);
    } finally {
      setIsApplyingOverride(false);
    }
  };

  const handleApplyOverride = async () => {
    setIsApplyingOverride(true);
    try {
      await overrideJobLevel(job.id!, {
        status: targetStatus,
        autoTimestampCoc: autoTimestampCoc,
        overrideNotes: operatorNotes
      });
      setOverrideMessage(`Level manually overridden to ${STAGE_CONFIG[targetStatus].label}`);
      setTimeout(() => setOverrideMessage(null), 3000);
      onUpdate();
    } catch (err: any) {
      alert(`Failed to apply override: ${err.message || err}`);
    } finally {
      setIsApplyingOverride(false);
    }
  };

  const handleFailJob = async () => {
    const finalReason = customFailReason.trim() ? customFailReason.trim() : failReason;
    setIsCancelling(true);
    try {
      await cancelJob(job.id!, finalReason, operatorNotes);
      setShowFailModal(false);
      setOverrideMessage('Job marked as Failed / Cancelled');
      setTimeout(() => setOverrideMessage(null), 3000);
      onUpdate();
    } catch (err: any) {
      alert(`Failed to cancel job: ${err.message || err}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReactivateJob = async (targetLevel: JobStatus = 'pending') => {
    setIsApplyingOverride(true);
    try {
      await reactivateJob(job.id!, targetLevel);
      setOverrideMessage(`Job reactivated to ${STAGE_CONFIG[targetLevel].label}`);
      setTimeout(() => setOverrideMessage(null), 3000);
      onUpdate();
    } catch (err: any) {
      alert(`Failed to reactivate job: ${err.message || err}`);
    } finally {
      setIsApplyingOverride(false);
    }
  };

  const handleToggleCocStep = async (
    stepKey: 'client_pickup_at' | 'driver_pickup_at' | 'driver_delivery_at' | 'client_delivery_at',
    currentlyConfirmed: boolean,
    stepLabel?: string,
    note?: string
  ) => {
    setActingStep(stepKey);
    try {
      const action = !currentlyConfirmed ? 'force-confirmed' : 'reset';
      const entry = note?.trim()
        ? `[${format(new Date(), 'HH:mm')}] ${stepLabel || stepKey} ${action} — ${note.trim()}`
        : `[${format(new Date(), 'HH:mm')}] ${stepLabel || stepKey} ${action} via Command Centre`;
      // Append rather than overwrite — operator_notes is a single shared
      // field on the job row, and a per-step note shouldn't clobber notes
      // left on a previous step or in the main override panel.
      const combinedNotes = job.operator_notes ? `${job.operator_notes}\n${entry}` : entry;

      await overrideCocStep(job.id!, stepKey, !currentlyConfirmed, combinedNotes);
      setOverrideMessage(`COC Step updated.`);
      setTimeout(() => setOverrideMessage(null), 2500);
      setStepNotes(prev => ({ ...prev, [stepKey]: '' }));
      onUpdate();
    } catch (err: any) {
      alert(`Failed to update COC step: ${err.message || err}`);
    } finally {
      setActingStep(null);
    }
  };

  const dispatchWhatsApp = (type: 'sender' | 'driver' | 'recipient') => {
    let message = '';
    let phone = '';
    const cocDomain = (import.meta.env.VITE_COC_URL || 'https://nokael.ae').replace(/\/$/, '');
    
    if (type === 'sender') {
      phone = job.sender_phone;
      message = `Hi ${job.sender_name}, your Nokael pickup is confirmed.\nRoute: ${job.pickup_location} → ${job.delivery_location}\nItem: ${job.item_type} | Urgency: ${job.urgency}\n\nWhen handing over your package, tap to confirm:\n${cocDomain}/${job.token_client_pickup}/client-pickup\nNo internet? Give the driver your OTP: ${job.otp_sender}`;
    } else if (type === 'driver') {
      phone = job.driver?.phone || '';
      message = `New job assigned — Job #${job.job_ref}\nPickup: ${job.pickup_location}, ${job.pickup_emirate}\nDelivery: ${job.delivery_location}, ${job.delivery_emirate}\nItem: ${job.item_type} | Urgency: ${job.urgency}\nSender: ${job.sender_name} | Recipient: ${job.recipient_name}\n\nYour job hub (pickup + delivery, one link):\n${cocDomain}/${job.token_driver_pickup}/driver-hub`;
    } else {
      phone = job.recipient_phone;
      message = `Hi ${job.recipient_name}, a package is on its way to you.\nFrom: ${job.sender_name} | Route: ${job.pickup_location} → ${job.delivery_location}\nItem: ${job.item_type}\n\nWhen you receive it, tap to confirm:\n${cocDomain}/${job.token_client_delivery}/client-delivery\nNo internet? Give the driver your OTP: ${job.otp_recipient}`;
    }
    
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
    
    // Update local sent flag
    const updatePayload: any = {};
    if (type === 'sender') updatePayload.sender_notified = true;
    if (type === 'driver') updatePayload.driver_notified = true;
    if (type === 'recipient') updatePayload.recipient_notified = true;
    
    updateJob(job.id!, updatePayload).then(onUpdate);
  };

  const currentStageIndex = STAGE_ORDER.indexOf(job.status as any);
  
  // Calculate highest reached stage index even if job is cancelled
  let effectiveStageIndex = currentStageIndex;
  if (job.status === 'cancelled') {
    if (job.client_delivery_at || job.client_delivery_confirmed_at) effectiveStageIndex = 4;
    else if (job.driver_delivery_at || job.driver_delivery_confirmed_at || job.driver_arrived_delivery_at) effectiveStageIndex = 3;
    else if (job.driver_pickup_at || job.driver_pickup_confirmed_at) effectiveStageIndex = 2;
    else if (job.client_pickup_at || job.client_pickup_confirmed_at || job.sender_ready_at || job.driver_arrived_pickup_at) effectiveStageIndex = 1;
    else effectiveStageIndex = 0;
  }

  const canAdvance = currentStageIndex >= 0 && currentStageIndex < STAGE_ORDER.length - 1 && job.status !== 'cancelled';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-brand-bg/90 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-6xl bg-brand-bg border border-brand-border rounded-[32px] sm:rounded-[40px] shadow-3xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Top Header Bar */}
        <div className="px-6 py-5 border-b border-brand-border flex justify-between items-center bg-brand-surface/70">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-brand-neon bg-brand-neon/10 px-3 py-1 rounded-lg border border-brand-neon/20">
              #{job.job_ref?.toString().padStart(4, '0')}
            </span>
            <div>
              <h2 className="text-lg font-display font-semibold tracking-tight text-brand-text flex items-center gap-2">
                Mission Command Center
              </h2>
              <p className="text-[11px] text-brand-muted font-medium">
                {format(new Date(job.created_at || new Date()), 'PPPP · HH:mm')} · Corridor: <span className="text-brand-text">{job.pickup_emirate} → {job.delivery_emirate}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={cn(
              "px-3.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5",
              STAGE_CONFIG[job.status]?.color || "bg-brand-surface text-brand-text border-brand-border"
            )}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              {STAGE_CONFIG[job.status]?.label || job.status}
            </div>

            <button 
              onClick={onClose}
              className="p-2 bg-brand-input hover:bg-brand-surface rounded-full text-brand-muted hover:text-brand-text transition-colors border border-brand-border"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Alert / Toast */}
        {overrideMessage && (
          <div className="bg-brand-neon/15 border-b border-brand-neon/30 px-6 py-2 flex items-center justify-between text-xs font-semibold text-brand-neon">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{overrideMessage}</span>
            </div>
          </div>
        )}

        {/* Failed / Cancelled Banner */}
        {job.status === 'cancelled' && (
          <div className="bg-red-500/15 border-b border-red-500/30 px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2.5 text-red-400 text-xs font-medium">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
              <div>
                <span className="font-bold uppercase tracking-wider text-red-300">Job Marked as Failed / Cancelled:</span>{' '}
                <span className="italic">{job.cancellation_reason || 'Manual Failure Recorded'}</span>
                {job.cancelled_at && (
                  <span className="text-[11px] text-red-400/70 ml-2">({format(new Date(job.cancelled_at), 'HH:mm')})</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleReactivateJob('pending')}
                disabled={isApplyingOverride}
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reactivate (Pending)
              </button>
              <button
                onClick={() => handleReactivateJob('driver_pickup')}
                disabled={isApplyingOverride}
                className="px-3 py-1.5 bg-brand-neon/10 hover:bg-brand-neon/20 text-brand-neon border border-brand-neon/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Resume (In-Transit)
              </button>
            </div>
          </div>
        )}

        {/* Level Progression Stepper (Command Lifecycle) */}
        <div className="px-6 py-3.5 bg-brand-surface/40 border-b border-brand-border overflow-x-auto no-scrollbar">
          <div className="flex items-center justify-between min-w-[620px] gap-2">
            {STAGE_ORDER.map((stageKey, idx) => {
              const isPast = job.status === 'cancelled' ? effectiveStageIndex >= idx : currentStageIndex > idx;
              const isCurrent = job.status !== 'cancelled' && currentStageIndex === idx;
              const config = STAGE_CONFIG[stageKey];
              const Icon = config.icon;

              return (
                <React.Fragment key={stageKey}>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border transition-all",
                      isCurrent ? "bg-brand-neon border-brand-neon text-brand-bg shadow-[0_0_12px_rgba(57,255,20,0.35)] scale-105" :
                      isPast ? "bg-brand-neon/20 border-brand-neon/40 text-brand-neon" :
                      "bg-brand-input border-brand-border text-brand-muted opacity-50"
                    )}>
                      {isPast ? <Check className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <div className="text-left">
                      <p className={cn(
                        "text-xs font-semibold leading-none mb-0.5",
                        isCurrent ? "text-brand-neon" : isPast ? "text-brand-text" : "text-brand-muted opacity-60"
                      )}>
                        {config.short}
                      </p>
                      <span className="text-[10px] text-brand-muted">L{idx + 1}</span>
                    </div>
                  </div>

                  {idx < STAGE_ORDER.length - 1 && (
                    <div className={cn(
                      "flex-1 h-0.5 min-w-[24px] mx-1 transition-all",
                      isPast ? "bg-brand-neon" : "bg-brand-border"
                    )} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto no-scrollbar">
          {/* Left Column: Job Details & Mission Control */}
          <div className="md:w-1/2 p-6 sm:p-8 border-r border-brand-border overflow-y-auto no-scrollbar space-y-6">
            
            {/* Command Centre Manual Override Panel */}
            <div className="p-5 bg-brand-surface/60 border border-brand-neon/30 rounded-3xl space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-brand-neon" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text">Manual Level Override</h3>
                </div>
                {canAdvance && (
                  <button
                    onClick={handleNextStage}
                    disabled={isApplyingOverride}
                    className="px-3 py-1.5 bg-brand-neon text-brand-bg rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(57,255,20,0.25)]"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    Advance to L{currentStageIndex + 2}
                  </button>
                )}
              </div>

              <p className="text-xs text-brand-muted leading-relaxed">
                If the client or pilot never accessed the digital COC link/OTP, manually force the job through its delivery lifecycle.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-brand-muted uppercase mb-1.5">Target Job Level</label>
                  <select
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value as JobStatus)}
                    className="w-full bg-brand-input border border-brand-input-border rounded-xl px-3 py-2 text-xs font-medium text-brand-text focus:border-brand-neon outline-none"
                  >
                    <option value="pending">L1: Pending Dispatch</option>
                    <option value="client_pickup">L2: Sender Handover</option>
                    <option value="driver_pickup">L3: Driver In-Transit</option>
                    <option value="driver_delivery">L4: Destination Arrival</option>
                    <option value="completed">L5: Delivered & Verified</option>
                    <option value="cancelled">L6: Failed / Cancelled</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <button
                    onClick={handleApplyOverride}
                    disabled={isApplyingOverride || targetStatus === job.status}
                    className={cn(
                      "w-full py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                      targetStatus === job.status 
                        ? "bg-brand-input text-brand-muted border border-brand-border cursor-not-allowed" 
                        : "bg-brand-neon/20 hover:bg-brand-neon/30 text-brand-neon border border-brand-neon/50 active:scale-95"
                    )}
                  >
                    {isApplyingOverride ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
                    Apply Level Override
                  </button>
                </div>
              </div>

              {/* Auto-fill COC Timestamps Checkbox */}
              <label className="flex items-center gap-2 text-xs text-brand-text cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={autoTimestampCoc}
                  onChange={(e) => setAutoTimestampCoc(e.target.checked)}
                  className="rounded border-brand-border text-brand-neon focus:ring-0 w-3.5 h-3.5"
                />
                <span>Auto-stamp missing Chain of Custody (COC) timestamps for prior levels</span>
              </label>

              {/* Operator Notes Field */}
              <div>
                <label className="block text-[11px] font-semibold text-brand-muted uppercase mb-1">Dispatcher / Audit Notes</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={operatorNotes}
                    onChange={(e) => setOperatorNotes(e.target.value)}
                    placeholder="e.g., Client confirmed handover by phone - manual override"
                    className="flex-1 bg-brand-input border border-brand-input-border rounded-xl px-3 py-1.5 text-xs text-brand-text placeholder:text-brand-muted/50 focus:border-brand-neon outline-none"
                  />
                  <button
                    onClick={async () => {
                      try {
                        await updateJob(job.id!, { operator_notes: operatorNotes });
                        setOverrideMessage('Notes saved.');
                        setTimeout(() => setOverrideMessage(null), 2000);
                        onUpdate();
                      } catch (err: any) {
                        alert(`Failed to save notes: ${err.message || err}`);
                      }
                    }}
                    className="px-3 py-1.5 bg-brand-input hover:bg-brand-surface border border-brand-border text-brand-text rounded-xl text-xs font-semibold"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Mark as Failed Trigger */}
              {job.status !== 'cancelled' && (
                <div className="pt-2 border-t border-brand-border/60 flex justify-between items-center">
                  <span className="text-[11px] text-brand-muted">Mission exception or failed drop?</span>
                  <button
                    onClick={() => setShowFailModal(true)}
                    className="text-xs font-semibold text-red-400 hover:text-red-300 hover:underline flex items-center gap-1"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Declare Job Failed / Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Consignor & Consignee Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">Consignor (Sender)</p>
                <div className="p-4 bg-brand-input rounded-2xl border border-brand-border">
                  <p className="text-sm font-semibold text-brand-text mb-0.5 truncate">{job.sender_name}</p>
                  <p className="text-xs font-mono text-brand-neon">{job.sender_phone}</p>
                  <div className="mt-2 text-xs text-brand-muted line-clamp-2">
                    <span className="text-brand-text font-medium">{job.pickup_emirate}:</span> {job.pickup_location}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">Consignee (Recipient)</p>
                <div className="p-4 bg-brand-input rounded-2xl border border-brand-border">
                  <p className="text-sm font-semibold text-brand-text mb-0.5 truncate">{job.recipient_name}</p>
                  <p className="text-xs font-mono text-brand-neon">{job.recipient_phone}</p>
                  <div className="mt-2 text-xs text-brand-muted line-clamp-2">
                    <span className="text-brand-text font-medium">{job.delivery_emirate}:</span> {job.delivery_location}
                  </div>
                </div>
              </div>
            </div>

            {/* Pilot Assignment */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">Assigned Pilot</p>
              <div className="p-4 bg-brand-surface border border-brand-border rounded-2xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-neon/10 flex items-center justify-center border border-brand-neon/20">
                    <Truck className="w-5 h-5 text-brand-neon" />
                  </div>
                  <div>
                    {job.driver?.full_name ? (
                      <>
                        <p className="text-sm font-semibold text-brand-text">{job.driver.full_name}</p>
                        <p className="text-xs text-brand-muted font-mono">{job.driver.phone} · {job.driver.vehicle_type || 'Corridor Pilot'}</p>
                      </>
                    ) : (
                      <p className="text-sm font-medium text-brand-muted italic">Pilot Pending Assignment</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReassigning(v => !v)}
                  className="px-3.5 py-1.5 bg-brand-input hover:bg-brand-surface border border-brand-border rounded-xl text-xs font-semibold uppercase tracking-wider"
                >
                  {job.driver?.full_name ? 'Reassign' : 'Assign'}
                </button>
              </div>
              {reassigning && (
                <div className="flex items-center gap-2 pt-1">
                  <select
                    defaultValue={job.driver_id || 'unassigned'}
                    disabled={assigningDriver}
                    onChange={async (e) => {
                      const val = e.target.value;
                      setAssigningDriver(true);
                      try {
                        await assignDriverToJob(job.id!, val === 'unassigned' ? null : val);
                        setReassigning(false);
                        onUpdate();
                      } catch (err: any) {
                        alert(`Failed to assign driver: ${err.message || err}`);
                      } finally {
                        setAssigningDriver(false);
                      }
                    }}
                    className="flex-1 bg-brand-input border border-brand-input-border rounded-xl px-3 py-2 text-xs font-medium text-brand-text focus:border-brand-neon outline-none"
                  >
                    <option value="unassigned">Unassigned</option>
                    {drivers.map(d => {
                      const statusIcon = d.status === 'available' ? '🟢' : d.status === 'on_job' ? '🟠' : '⚪';
                      return (
                        <option key={d.id} value={d.id}>{statusIcon} {d.full_name} (Tier {d.tier || 'D'} · {d.vehicle_type})</option>
                      );
                    })}
                  </select>
                  {assigningDriver && <Loader2 className="w-4 h-4 animate-spin text-brand-muted" />}
                </div>
              )}
            </div>

            {/* Quick Dispatch WhatsApp Buttons */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">Operational WhatsApp Links</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'sender', label: 'Sender Dsp.', sent: job.sender_notified },
                  { id: 'driver', label: 'Pilot Dsp.', sent: job.driver_notified },
                  { id: 'recipient', label: 'Client Dsp.', sent: job.recipient_notified }
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => dispatchWhatsApp(btn.id as any)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all gap-1.5 text-center",
                      btn.sent ? "bg-brand-surface border-brand-border text-brand-muted" : "bg-brand-input border-brand-neon/30 hover:border-brand-neon hover:shadow-[0_0_12px_rgba(57,255,20,0.15)] text-brand-text"
                    )}
                  >
                    <MessageSquare className={cn("w-4 h-4", btn.sent ? "text-brand-muted" : "text-brand-neon")} />
                    <span className="text-[11px] font-semibold">{btn.label}</span>
                    <span className={cn("text-[10px]", btn.sent ? "text-brand-muted" : "text-brand-neon font-medium")}>
                      {btn.sent ? 'Dispatched' : 'Ready'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Chain of Custody (COC) Timeline & Force Controls */}
          <div className="md:w-1/2 p-6 sm:p-8 bg-brand-surface/30 flex flex-col justify-between overflow-y-auto no-scrollbar space-y-6">
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-base font-display font-bold tracking-tight text-brand-text">Chain of Custody (COC)</h3>
                  <p className="text-xs text-brand-muted">Individual step validation and emergency override stamps</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-brand-muted font-mono bg-brand-input px-2.5 py-1 rounded-lg border border-brand-border">
                  <Shield className="w-3.5 h-3.5 text-brand-neon" />
                  <span>OTP Protected</span>
                </div>
              </div>

              {/* COC Steps List */}
              <div className="space-y-4 relative">
                <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-brand-border" />
                
                {[
                  { 
                    label: 'Sender Handover', 
                    stepKey: 'client_pickup_at' as const,
                    status: job.client_pickup_at, 
                    tokenKey: 'token_client_pickup', 
                    icon: Package,
                    otp: job.otp_sender,
                    desc: 'Sender signs or gives OTP to pilot'
                  },
                  { 
                    label: 'Driver Pickup Confirmed', 
                    stepKey: 'driver_pickup_at' as const,
                    status: job.driver_pickup_at, 
                    tokenKey: 'token_driver_pickup', 
                    icon: Truck,
                    otp: job.otp_driver_pickup,
                    desc: 'Pilot confirms possession on highway'
                  },
                  { 
                    label: 'In-Transit / Destination Arrival', 
                    stepKey: 'driver_delivery_at' as const,
                    status: job.driver_delivery_at, 
                    tokenKey: 'token_driver_delivery', 
                    icon: Navigation,
                    otp: job.otp_driver_delivery,
                    desc: 'Pilot validates arrival at recipient hub'
                  },
                  { 
                    label: 'Final Receipt & Signature', 
                    stepKey: 'client_delivery_at' as const,
                    status: job.client_delivery_at, 
                    tokenKey: 'token_client_delivery', 
                    icon: CheckCircle2,
                    otp: job.otp_recipient,
                    desc: 'Recipient confirms sealed delivery'
                  }
                ].map((step, i) => {
                  const cocDomain = (import.meta.env.VITE_COC_URL || 'https://nokael.ae').replace(/\/$/, '');
                  const stepSlug = step.tokenKey.replace('token_', '').replace('_', '-');
                  const tokenValue = (job as any)[step.tokenKey];
                  const stepUrl = tokenValue ? `${cocDomain}/${tokenValue}/${stepSlug}` : '';
                  const isConfirmed = !!step.status;
                  const isBusy = actingStep === step.stepKey;

                  return (
                    <div key={i} className="flex gap-4 relative z-10 p-3.5 bg-brand-bg/80 border border-brand-border rounded-2xl hover:border-brand-neon/30 transition-all">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center border transition-all shrink-0 mt-0.5",
                        isConfirmed 
                          ? "bg-brand-neon border-brand-neon text-brand-bg shadow-[0_0_12px_rgba(57,255,20,0.3)]" 
                          : "bg-brand-input border-brand-border text-brand-muted"
                      )}>
                        {isConfirmed ? <CheckCircle2 className="w-5 h-5" /> : <step.icon className="w-4 h-4" />}
                      </div>

                      <div className="flex-grow min-w-0">
                        <div className="flex justify-between items-start mb-0.5">
                          <p className={cn("text-xs font-bold", isConfirmed ? "text-brand-text" : "text-brand-muted")}>
                            {step.label}
                          </p>
                          {isConfirmed && (
                            <span className="text-[11px] font-mono text-brand-neon font-semibold bg-brand-neon/10 px-2 py-0.5 rounded border border-brand-neon/20">
                              {format(new Date(step.status!), 'HH:mm:ss')}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-brand-muted font-medium mb-2">
                          {isConfirmed 
                            ? 'Verified & Sealed in Chain of Custody'
                            : `Awaiting verification · OTP: ${step.otp || 'N/A'}`
                          }
                        </p>

                        {/* Per-step audit note — appended to the job's operator_notes log, not a shared/overwritten field */}
                        <div className="pt-1">
                          <input
                            type="text"
                            value={stepNotes[step.stepKey] || ''}
                            onChange={(e) => setStepNotes(prev => ({ ...prev, [step.stepKey]: e.target.value }))}
                            placeholder="Optional note for this step..."
                            className="w-full bg-brand-input border border-brand-input-border rounded-lg px-2.5 py-1.5 text-[11px] text-brand-text placeholder:text-brand-muted/50 focus:border-brand-neon outline-none"
                          />
                        </div>

                        {/* Force Pass / Undo & Link Actions */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-brand-border/60">
                          <button
                            onClick={() => handleToggleCocStep(step.stepKey, isConfirmed, step.label, stepNotes[step.stepKey])}
                            disabled={isBusy}
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold tracking-wide uppercase transition-all",
                              isConfirmed
                                ? "bg-brand-input hover:bg-brand-surface text-brand-muted hover:text-brand-text border border-brand-border"
                                : "bg-brand-neon/15 hover:bg-brand-neon/25 text-brand-neon border border-brand-neon/40 shadow-[0_0_8px_rgba(57,255,20,0.15)]"
                            )}
                          >
                            {isBusy ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : isConfirmed ? (
                              <>
                                <Undo2 className="w-3 h-3" />
                                Undo Step
                              </>
                            ) : (
                              <>
                                <FastForward className="w-3 h-3" />
                                Force Pass
                              </>
                            )}
                          </button>

                          {tokenValue && (
                            <>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(stepUrl);
                                  setCopiedStep(step.tokenKey);
                                  setTimeout(() => setCopiedStep(null), 2000);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-brand-input hover:bg-brand-surface rounded-lg border border-brand-border text-[10px] font-semibold text-brand-muted hover:text-brand-text uppercase transition-all"
                              >
                                <Copy className="w-2.5 h-2.5" />
                                {copiedStep === step.tokenKey ? 'Copied' : 'Copy'}
                              </button>
                              <a
                                href={stepUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 bg-brand-input hover:bg-brand-surface rounded-lg border border-brand-border text-[10px] font-semibold text-brand-muted hover:text-brand-text uppercase transition-all"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                                Open
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions: Certificate PDF Export */}
            {(job.status === 'completed' || !!job.client_delivery_at) && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pt-4 border-t border-brand-border"
              >
                <button 
                  onClick={() => generateJobPOC(job)}
                  className="btn-primary w-full py-4 text-xs font-bold flex items-center justify-center gap-2.5"
                >
                  <Download className="w-4 h-4" />
                  Generate COC Certificate (PDF)
                </button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Declare Failed Modal Overlay */}
        <AnimatePresence>
          {showFailModal && (
            <div className="absolute inset-0 z-50 bg-brand-bg/95 backdrop-blur-md p-6 flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-md w-full bg-brand-surface border border-red-500/40 rounded-3xl p-6 shadow-2xl space-y-4"
              >
                <div className="flex items-center gap-3 text-red-400">
                  <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/30">
                    <Ban className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-brand-text">Declare Mission Failure</h3>
                    <p className="text-xs text-brand-muted">Record reason for audit & dispatch logs</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-brand-muted uppercase mb-1">Standard Failure Reason</label>
                    <select
                      value={failReason}
                      onChange={(e) => setFailReason(e.target.value)}
                      className="w-full bg-brand-input border border-brand-input-border rounded-xl px-3 py-2 text-xs text-brand-text outline-none focus:border-red-500"
                    >
                      {COMMON_FAILURE_REASONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                      <option value="Custom">Custom / Other Reason...</option>
                    </select>
                  </div>

                  {failReason === 'Custom' && (
                    <div>
                      <label className="block text-xs font-semibold text-brand-muted uppercase mb-1">Specify Reason</label>
                      <textarea
                        value={customFailReason}
                        onChange={(e) => setCustomFailReason(e.target.value)}
                        placeholder="Provide details about the exception..."
                        rows={2}
                        className="w-full bg-brand-input border border-brand-input-border rounded-xl p-3 text-xs text-brand-text outline-none focus:border-red-500"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-brand-border">
                  <button
                    onClick={() => setShowFailModal(false)}
                    className="px-4 py-2 bg-brand-input hover:bg-brand-surface border border-brand-border rounded-xl text-xs font-medium text-brand-text"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleFailJob}
                    disabled={isCancelling}
                    className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-red-500/20"
                  >
                    {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                    Confirm Failure Status
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
};

const JobCreateModal = ({ onClose, onSuccess, initialData, drivers }: { onClose: () => void, onSuccess: () => void, initialData?: Partial<Job>, drivers: Driver[] }) => {
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    sender_name: initialData?.sender_name || '',
    sender_phone: initialData?.sender_phone || '',
    recipient_name: initialData?.recipient_name || '',
    recipient_phone: initialData?.recipient_phone || '',
    pickup_emirate: initialData?.pickup_emirate || 'Dubai',
    pickup_location: initialData?.pickup_location || '',
    delivery_emirate: initialData?.delivery_emirate || 'Abu Dhabi',
    delivery_location: initialData?.delivery_location || '',
    item_type: initialData?.item_type || 'parcel' as ItemType,
    urgency: initialData?.urgency || 'immediate' as UrgencyType,
    driver_id: initialData?.driver_id || '',
    notes: (initialData as any)?.notes || initialData?.special_instructions || '',
    quote_id: initialData?.quote_id || null
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const genOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
      const tokens = {
        token_client_pickup: crypto.randomUUID(),
        token_driver_pickup: crypto.randomUUID(),
        token_driver_delivery: crypto.randomUUID(),
        token_client_delivery: crypto.randomUUID()
      };

      const otpVal = genOtp();
      const payload: Partial<Job> = {
        sender_name: formData.sender_name,
        sender_phone: formData.sender_phone,
        recipient_name: formData.recipient_name,
        recipient_phone: formData.recipient_phone,
        pickup_emirate: formData.pickup_emirate,
        pickup_location: formData.pickup_location,
        delivery_emirate: formData.delivery_emirate,
        delivery_location: formData.delivery_location,
        item_type: formData.item_type,
        urgency: formData.urgency,
        driver_id: formData.driver_id || null,
        special_instructions: formData.notes,
        operator_notes: formData.notes,
        quote_id: formData.quote_id,
        ...tokens,
        otp_sender: genOtp(),
        otp_driver_pickup: otpVal,
        otp_driver_delivery: otpVal,
        otp_recipient: genOtp(),
        source: 'manual',
        status: 'pending'
      };
      
      const result = await createJob(payload);

      // If it came from a quote, update the quote status
      if (formData.quote_id && supabase) {
        await supabase
          .from('quote_requests')
          .update({ status: 'assigned' })
          .eq('id', formData.quote_id);
      }

      await sendTelegramNotification(formatJobAssignmentNotification({
        ...payload,
        job_ref: result.job_ref
      }));

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating job:', err);
      alert('Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-brand-bg/90 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-brand-bg border border-brand-border rounded-[40px] shadow-3xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-6 border-b border-brand-border flex justify-between items-center bg-brand-surface/20">
           <div>
              <h2 className="text-2xl font-display font-medium tracking-tighter mb-1">Manual Job Intake.</h2>
              <p className="text-xs text-brand-muted uppercase tracking-wide font-medium font-mono">Operator manual dispatch override</p>
           </div>
           <button onClick={onClose} className="p-2 bg-brand-input rounded-full text-brand-muted hover:text-brand-text transition-colors">
              <X className="w-6 h-6" />
           </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto no-scrollbar space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-6">
                 <h3 className="text-xs font-medium text-brand-neon flex items-center gap-2">
                   <User className="w-3 h-3" />
                   Sender Information
                 </h3>
                 <div className="space-y-4">
                   <input required value={formData.sender_name} onChange={e => setFormData({...formData, sender_name: e.target.value})} type="text" placeholder="Full Name / Company" className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm focus:border-brand-neon/50 outline-none" />
                   <input required value={formData.sender_phone} onChange={e => setFormData({...formData, sender_phone: e.target.value})} type="tel" placeholder="WhatsApp Number" className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm focus:border-brand-neon/50 outline-none" />
                 </div>
               </div>
               <div className="space-y-6">
                 <h3 className="text-xs font-medium text-brand-neon flex items-center gap-2">
                   <User className="w-3 h-3" />
                   Recipient Information
                 </h3>
                 <div className="space-y-4">
                   <input required value={formData.recipient_name} onChange={e => setFormData({...formData, recipient_name: e.target.value})} type="text" placeholder="Full Name / Company" className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm focus:border-brand-neon/50 outline-none" />
                   <input required value={formData.recipient_phone} onChange={e => setFormData({...formData, recipient_phone: e.target.value})} type="tel" placeholder="WhatsApp Number" className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm focus:border-brand-neon/50 outline-none" />
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-6">
                 <h3 className="text-xs font-medium text-brand-neon flex items-center gap-2">
                   <MapPin className="w-3 h-3" />
                   Pickup Logistics
                 </h3>
                 <div className="space-y-4">
                   <select required value={formData.pickup_emirate} onChange={e => setFormData({...formData, pickup_emirate: e.target.value})} className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm outline-none">
                     {['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'RAK', 'Fujairah', 'UMM Al Quwain'].map(e => <option key={e} value={e}>{e}</option>)}
                   </select>
                   <input required value={formData.pickup_location} onChange={e => setFormData({...formData, pickup_location: e.target.value})} type="text" placeholder="Specific Pickup Address / Area" className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm focus:border-brand-neon/50 outline-none" />
                 </div>
               </div>
               <div className="space-y-6">
                 <h3 className="text-xs font-medium text-brand-neon flex items-center gap-2">
                   <Navigation className="w-3 h-3" />
                   Delivery Logistics
                 </h3>
                 <div className="space-y-4">
                    <select required value={formData.delivery_emirate} onChange={e => setFormData({...formData, delivery_emirate: e.target.value})} className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm outline-none">
                     {['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'RAK', 'Fujairah', 'UMM Al Quwain'].map(e => <option key={e} value={e}>{e}</option>)}
                   </select>
                   <input required value={formData.delivery_location} onChange={e => setFormData({...formData, delivery_location: e.target.value})} type="text" placeholder="Specific Delivery Address / Area" className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm focus:border-brand-neon/50 outline-none" />
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="space-y-4">
                  <p className="text-xs font-medium text-brand-muted">Item Category</p>
                  <select value={formData.item_type} onChange={e => setFormData({...formData, item_type: e.target.value as any})} className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm outline-none">
                    <option value="parcel">Standard Parcel</option>
                    <option value="document">Legal Document</option>
                    <option value="spare_part">Machine Spare Part</option>
                    <option value="other">Other Manifest</option>
                  </select>
               </div>
               <div className="space-y-4">
                  <p className="text-xs font-medium text-brand-muted">Urgency Status</p>
                  <select value={formData.urgency} onChange={e => setFormData({...formData, urgency: e.target.value as any})} className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm outline-none">
                    <option value="immediate">Immediate Dispatch</option>
                    <option value="today">Same Day UAE</option>
                    <option value="scheduled">Scheduled Logistics</option>
                  </select>
               </div>
               <div className="space-y-4">
                  <p className="text-xs font-medium text-brand-muted">Driver Assignment</p>
                  <select
                    value={formData.driver_id}
                    onChange={e => setFormData({...formData, driver_id: e.target.value})}
                    className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm outline-none"
                  >
                    <option value="">Unassigned — assign later</option>
                    {drivers.map(d => {
                      const statusIcon = d.status === 'available' ? '🟢' : d.status === 'on_job' ? '🟠' : '⚪';
                      return (
                        <option key={d.id} value={d.id}>{statusIcon} {d.full_name} (Tier {d.tier || 'D'} · {d.vehicle_type})</option>
                      );
                    })}
                  </select>
               </div>
            </div>

            <button disabled={loading} type="submit" className="btn-primary w-full py-6 flex items-center justify-center gap-4 text-sm font-semibold transition-all">
               {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6" />}
               Commit Dispatch to Pipeline
            </button>
        </form>
      </motion.div>
    </div>
  );
};

// ==========================================
// TEAM MANAGEMENT PANEL
// ==========================================

const ROLE_META: Record<OrgRole, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-brand-neon/10 text-brand-neon border-brand-neon/20' },
  admin: { label: 'Admin', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  operator: { label: 'Operator', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  viewer: { label: 'Viewer', color: 'bg-brand-input text-brand-muted border-brand-border' },
};

const TeamPanel = ({ orgId, currentRole }: { orgId: string | null; currentRole: OrgRole | null }) => {
  const [members, setMembers] = React.useState<OrgMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showInvite, setShowInvite] = React.useState(false);
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null);

  const canManage = currentRole === 'owner' || currentRole === 'admin';

  const loadMembers = React.useCallback(() => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    getTeamMembers()
      .then(setMembers)
      .catch((err: any) => setError(err.message || 'Failed to load team'))
      .finally(() => setLoading(false));
  }, [orgId]);

  React.useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRoleChange = async (userId: string, role: OrgRole) => {
    if (!orgId) return;
    setBusyUserId(userId);
    try {
      await updateTeamMemberRole(userId, role);
      loadMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRemove = async (userId: string, email: string) => {
    if (!orgId) return;
    if (!window.confirm(`Remove ${email} from this organization?`)) return;
    setBusyUserId(userId);
    try {
      await removeTeamMember(userId);
      loadMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to remove team member');
    } finally {
      setBusyUserId(null);
    }
  };

  if (!orgId) {
    return (
      <div className="dispatch-card p-8 text-center text-brand-muted text-sm">
        Resolving your organization membership...
      </div>
    );
  }

  return (
    <div className="dispatch-card overflow-hidden p-0">
      <div className="p-5 border-b border-brand-border flex justify-between items-center">
        <div>
          <h2 className="text-base font-display font-medium tracking-tight">Command Centre access</h2>
          <p className="text-xs text-brand-muted">Who can log in and what they can do</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 bg-brand-neon text-brand-bg px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90 active:scale-95 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Invite
          </button>
        )}
      </div>

      {error && (
        <div className="m-5 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-10 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-brand-neon" />
        </div>
      ) : (
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-brand-input text-[11px] uppercase tracking-wide font-medium text-brand-muted">
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Member Since</th>
                {canManage && <th className="px-6 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-brand-input transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {m.role === 'owner' && <Crown className="w-3.5 h-3.5 text-brand-neon shrink-0" />}
                      <span className="text-sm font-medium text-brand-text truncate">{m.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {canManage ? (
                      <select
                        value={m.role}
                        disabled={busyUserId === m.user_id}
                        onChange={(e) => handleRoleChange(m.user_id, e.target.value as OrgRole)}
                        className={cn(
                          'text-[11px] font-medium uppercase tracking-wide px-3 py-1.5 rounded-lg border outline-none transition-all',
                          ROLE_META[m.role].color
                        )}
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="operator">Operator</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className={cn('px-3 py-1.5 rounded-lg text-[11px] font-medium uppercase tracking-wide border inline-block', ROLE_META[m.role].color)}>
                        {ROLE_META[m.role].label}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-brand-muted">
                    {format(new Date(m.created_at), 'PP')}
                  </td>
                  {canManage && (
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRemove(m.user_id, m.email)}
                        disabled={busyUserId === m.user_id}
                        className="w-9 h-9 bg-red-500/10 text-red-500 rounded-lg items-center justify-center hover:bg-red-500 hover:text-white transition-all disabled:opacity-40 inline-flex"
                      >
                        {busyUserId === m.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {members.length === 0 && (
            <div className="p-10 text-center text-brand-muted text-xs">No team members found.</div>
          )}
        </div>
      )}

      {showInvite && orgId && (
        <InviteModal
          orgId={orgId}
          onClose={() => setShowInvite(false)}
          onSuccess={() => {
            setShowInvite(false);
            loadMembers();
          }}
        />
      )}
    </div>
  );
};

const InviteModal = ({ orgId, onClose, onSuccess }: { orgId: string; onClose: () => void; onSuccess: () => void }) => {
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<OrgRole>('operator');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await inviteTeamMember(email.trim(), role);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-brand-bg/90 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-brand-bg border border-brand-border rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-brand-border flex justify-between items-center">
          <h2 className="text-lg font-display font-medium tracking-tight">Invite team member</h2>
          <button onClick={onClose} className="p-2 bg-brand-input rounded-full text-brand-muted hover:text-brand-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-[11px] font-semibold text-brand-muted uppercase mb-2">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full bg-brand-input border border-brand-input-border rounded-xl px-4 py-3 text-sm focus:border-brand-neon/50 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-brand-muted uppercase mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as OrgRole)}
              className="w-full bg-brand-input border border-brand-input-border rounded-xl px-4 py-3 text-sm outline-none"
            >
              <option value="admin">Admin — full access, can manage team</option>
              <option value="operator">Operator — dispatch and driver management</option>
              <option value="viewer">Viewer — read-only</option>
              <option value="owner">Owner — full access, org ownership</option>
            </select>
          </div>
          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3.5 text-xs"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Send Invite
          </button>
        </form>
      </motion.div>
    </div>
  );
};