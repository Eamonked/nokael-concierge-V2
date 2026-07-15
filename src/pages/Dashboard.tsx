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
  BarChart3
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
  subscribeToJobs,
  type Job,
  type JobStatus,
  type ItemType,
  type UrgencyType,
  type JobWithDriver
} from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { generateJobPOC } from '../lib/pdf-export';
import { sendTelegramNotification, formatJobAssignmentNotification } from '../lib/notifications';

const StatCard: React.FC<{ title: string; value: number; icon: any }> = ({ title, value, icon: Icon }) => (
  <div className="bg-brand-surface border border-brand-border rounded-2xl px-5 py-4 flex items-center gap-4">
    <div className="w-9 h-9 shrink-0 bg-brand-neon/10 rounded-lg flex items-center justify-center text-brand-neon">
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0">
      <p className="text-2xl font-display font-medium tracking-tight text-brand-text leading-none mb-1">{value}</p>
      <h3 className="text-brand-muted text-xs truncate">{title}</h3>
    </div>
  </div>
);

export default function Dashboard() {
  const [activeTab, setActiveTab] = React.useState<'pipeline' | 'quotes' | 'drivers' | 'business'>('pipeline');
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
    if (!supabase) {
      setLoading(false);
      return;
    }
    
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error && (error.message?.includes('Refresh Token Not Found') || error.message?.includes('Invalid Refresh Token'))) {
        console.warn('Invalid or expired session detected, clearing auth storage.');
        supabase.auth.signOut().finally(() => {
          navigate('/login');
        });
        return;
      }
      if (!session) {
        navigate('/login');
      } else {
        fetchData();
      }
    });

    // Subscribe to job changes
    const subscription = subscribeToJobs((payload) => {
      getJobs().then(jobsData => {
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
      if (subscription) supabase.removeChannel(subscription);
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

  const handleAssignDriver = async (jobId: string, driverId: string) => {
    try {
      const actualDriverId = driverId === 'unassigned' ? null : driverId;
      await assignDriverToJob(jobId, actualDriverId);
      
      // Update local state
      const assignedDriver = drivers.find(d => d.id === actualDriverId);
      setRequests(prev => prev.map(r => r.id === jobId ? { 
        ...r, 
        assigned_driver_id: actualDriverId || undefined,
        assigned_driver: assignedDriver,
        status: actualDriverId ? 'assigned' : 'pending'
      } : r));
    } catch (error) {
      console.error('Error assigning driver:', error);
    }
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
    if (supabase) {
      await supabase.auth.signOut();
    }
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
    { id: 'pipeline', label: 'Command Centre', icon: LayoutDashboard },
    { id: 'quotes', label: 'Dispatch Log', icon: FileText, badge: stats.pending },
    { id: 'drivers', label: 'Driver Network', icon: Truck, badge: stats.pendingDrivers },
    { id: 'business', label: 'Business Accounts', icon: Shield, badge: stats.pendingBusiness },
  ];

  const TAB_META: Record<typeof activeTab, { title: string; subtitle: string }> = {
    pipeline: { title: 'Command Centre', subtitle: 'Live job pipeline and dispatch' },
    quotes: { title: 'Dispatch Log', subtitle: 'Quote requests and conversions' },
    drivers: { title: 'Driver Network', subtitle: 'Onboarding and verification' },
    business: { title: 'Business Accounts', subtitle: 'Corporate partnerships' },
  };

  const jobsActive = jobs.filter(j => j.status !== 'completed').length;
  const jobsCompleted = jobs.filter(j => j.status === 'completed').length;

  const CONTEXT_STATS: Record<typeof activeTab, { title: string; value: number; icon: any }[]> = {
    pipeline: [
      { title: 'Active Jobs', value: jobsActive, icon: Zap },
      { title: 'Pending Dispatch', value: jobs.filter(j => j.status === 'pending').length, icon: Clock },
      { title: 'Completed', value: jobsCompleted, icon: CheckCircle2 },
    ],
    quotes: [
      { title: 'Total Quotes', value: stats.total, icon: LayoutDashboard },
      { title: 'Pending', value: stats.pending, icon: Clock },
      { title: 'Completed', value: stats.completed, icon: CheckCircle2 },
    ],
    drivers: [
      { title: 'Total Drivers', value: stats.drivers, icon: Truck },
      { title: 'Pending Review', value: stats.pendingDrivers, icon: Clock },
      { title: 'Approved', value: approvedDrivers.length, icon: CheckCircle2 },
    ],
    business: [
      { title: 'Total Accounts', value: stats.business, icon: Shield },
      { title: 'Pending', value: stats.pendingBusiness, icon: Clock },
      { title: 'Active', value: businessInquiries.filter(b => b.status === 'active').length, icon: CheckCircle2 },
    ],
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
            <p className="text-[11px] text-brand-muted truncate">Dispatch Centre</p>
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
          <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-brand-muted">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-neon animate-pulse" />
            Live
          </div>
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
        <div className="grid grid-cols-3 gap-4 mb-8">
          {CONTEXT_STATS[activeTab].map(stat => (
            <StatCard key={stat.title} title={stat.title} value={stat.value} icon={stat.icon} />
          ))}
        </div>

        {activeTab === 'pipeline' ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center gap-4">
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
              <button 
                onClick={() => setShowJobCreateModal(true)}
                className="flex items-center gap-2 bg-brand-neon text-brand-bg px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                New Job
              </button>
            </div>

            {jobViewMode === 'kanban' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 h-[calc(100vh-320px)] min-h-[560px]">
                <KanbanColumn 
                  title="Pending Dispatch" 
                  status="pending" 
                  jobs={jobs.filter(j => j.status === 'pending')} 
                  onJobClick={setSelectedJob} 
                />
                <KanbanColumn 
                  title="In Transit / Operational" 
                  status="in_transit" 
                  jobs={jobs.filter(j => ['client_pickup', 'driver_pickup', 'driver_delivery'].includes(j.status))} 
                  onJobClick={setSelectedJob} 
                />
                <KanbanColumn 
                  title="Audit / Completed" 
                  status="completed" 
                  jobs={jobs.filter(j => j.status === 'completed')} 
                  onJobClick={setSelectedJob} 
                />
              </div>
            ) : (
              <div className="dispatch-card p-0 overflow-hidden">
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-brand-input/50 text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                        <th className="px-6 py-3">Job</th>
                        <th className="px-6 py-3">Route</th>
                        <th className="px-6 py-3">People</th>
                        <th className="px-6 py-3">COC Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {jobs.map((job) => (
                        <tr 
                          key={job.id} 
                          className="hover:bg-brand-surface/30 transition-colors group cursor-pointer"
                          onClick={() => setSelectedJob(job)}
                        >
                          <td className="px-6 py-4">
                              <div className="text-sm font-mono font-semibold text-brand-neon mb-1">#{job.job_ref?.toString().padStart(4, '0')}</div>
                              <span className={cn(
                                "text-xs font-medium px-2 py-0.5 rounded",
                                job.status === 'completed' ? "bg-brand-neon/10 text-brand-neon" : "bg-yellow-500/10 text-yellow-500"
                              )}>{job.status?.replace('_', ' ')}</span>
                          </td>
                          <td className="px-6 py-4">
                              <div className="flex items-center gap-3 text-sm font-medium mb-2">
                                <span>{job.pickup_location}</span>
                                <ArrowRight className="w-3 h-3 text-brand-neon" />
                                <span>{job.delivery_location}</span>
                              </div>
                              <div className="text-xs font-medium text-brand-muted">{job.pickup_emirate} Corridor</div>
                          </td>
                          <td className="px-6 py-4">
                              <p className="text-xs font-medium text-brand-text mb-1">{job.sender_name}</p>
                              <div className="flex gap-2 items-center">
                                <Truck className="w-3 h-3 text-brand-muted" />
                                <p className="text-xs text-brand-muted font-medium">{job.driver?.full_name || 'Pilot Pending'}</p>
                              </div>
                          </td>
                          <td className="px-6 py-4">
                              <div className="flex gap-1.5">
                                {[
                                  { key: 'client_pickup_at', label: 'Handover' },
                                  { key: 'driver_pickup_at', label: 'Pickup' },
                                  { key: 'driver_delivery_at', label: 'Inbound' },
                                  { key: 'client_delivery_at', label: 'Final' }
                                ].map((step) => (
                                  <div 
                                      key={step.key}
                                      className={cn(
                                        "w-6 h-6 rounded-lg flex items-center justify-center border",
                                        (job as any)[step.key] ? "bg-brand-neon border-brand-neon text-brand-bg" : "bg-brand-input border-brand-border text-brand-muted opacity-30"
                                      )}
                                  >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                  </div>
                                ))}
                              </div>
                          </td>
                        </tr>
                      ))}
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
                      <th className="px-6 py-3">Client</th>
                      <th className="px-6 py-3">Route</th>
                      <th className="px-6 py-3">Item / Urgency</th>
                      <th className="px-6 py-3">Driver</th>
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
                          <div className="text-xs font-medium uppercase tracking-wide mb-2 text-brand-text">{req.item_type}</div>
                          <div className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-2 ${
                            req.urgency === 'immediate' ? 'text-red-500' : req.urgency === 'today' ? 'text-yellow-500' : 'text-blue-500'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              req.urgency === 'immediate' ? 'bg-red-500 animate-pulse' : req.urgency === 'today' ? 'bg-yellow-500' : 'bg-blue-500'
                            }`} />
                            {req.urgency}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={req.assigned_driver_id || 'unassigned'}
                            onChange={(e) => handleAssignDriver(req.id!, e.target.value)}
                            className="bg-brand-surface border border-brand-border rounded-lg px-4 py-2 text-xs font-medium text-brand-text focus:border-brand-neon/50 outline-none w-full max-w-[180px]"
                          >
                            <option value="unassigned">Unassigned</option>
                            {approvedDrivers.map(d => {
                              const statusIcon = d.status === 'available' ? '🟢' : d.status === 'on_job' ? '🟠' : '⚪';
                              return (
                                <option key={d.id} value={d.id}>{statusIcon} {d.full_name} (Tier {d.tier || 'D'} · {d.vehicle_type})</option>
                              );
                            })}
                          </select>
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
                          <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              onClick={() => handleConvertToJob(req)}
                              title="Convert to Active Job"
                              className="w-10 h-10 bg-brand-neon/10 text-brand-neon rounded-lg flex items-center justify-center hover:bg-brand-neon hover:text-brand-bg transition-all"
                            >
                              <Zap className="w-4 h-4" />
                            </button>
                            <a 
                              href={`https://wa.me/${req.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-10 h-10 bg-brand-neon/10 text-brand-neon rounded-lg flex items-center justify-center hover:bg-brand-neon hover:text-brand-bg transition-all"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </a>
                            <button 
                              onClick={() => handleDelete(req.id!)}
                              className="w-10 h-10 bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
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
                    <th className="px-6 py-3 text-right">Operations</th>
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
        ) : (
          <div className="dispatch-card overflow-hidden p-0">
            <div className="p-5 border-b border-brand-border flex flex-col md:flex-row justify-end items-center gap-3">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input 
                  type="text" 
                  placeholder="Search drivers..."
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
                    <th className="px-6 py-3">Tier / Score</th>
                    <th className="px-6 py-3">Availability</th>
                    <th className="px-6 py-3">Onboarding</th>
                    <th className="px-6 py-3 text-right">Operations</th>
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
                        <div className="flex items-center gap-4">
                          <div className="px-3 py-1 bg-brand-neon/10 border border-brand-neon/20 rounded text-brand-neon text-xs font-medium">Tier {driver.tier}</div>
                          <div className="flex items-center gap-1.5 text-brand-text">
                            <Star className="w-3 h-3 text-brand-neon fill-brand-neon" />
                            <span className="text-xs font-medium">{driver.reliability_score || 0}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const statusMap: Record<string, { label: string; dot: string; text: string }> = {
                            available: { label: 'Available', dot: 'bg-emerald-400', text: 'text-emerald-400' },
                            on_job: { label: 'On Job', dot: 'bg-amber-400', text: 'text-amber-400' },
                            offline: { label: 'Offline', dot: 'bg-brand-muted', text: 'text-brand-muted' },
                          };
                          const cfg = statusMap[driver.status || 'offline'] || statusMap.offline;
                          return (
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                              <span className={`text-[11px] font-medium uppercase tracking-wide ${cfg.text}`}>{cfg.label}</span>
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
                          className="px-6 py-2.5 bg-brand-surface border border-brand-border text-brand-text text-xs font-medium rounded-lg hover:bg-brand-neon hover:text-brand-bg transition-all"
                        >
                          Review Profile
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
      <div className="p-6 border-b border-brand-border flex justify-between items-center bg-brand-surface/50">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-2 h-2 rounded-full animate-pulse",
            status === 'pending' ? "bg-yellow-500" :
            status === 'client_pickup' || status === 'driver_pickup' ? "bg-blue-500" :
            status === 'driver_delivery' ? "bg-purple-500" : "bg-brand-neon"
          )} />
          <h3 className="text-sm font-medium text-brand-text">{title}</h3>
        </div>
        <span className="text-xs font-mono font-semibold text-brand-muted bg-brand-bg px-2 py-0.5 rounded border border-brand-border">{jobs.length}</span>
      </div>
      <div className="p-4 flex-grow overflow-y-auto no-scrollbar space-y-4">
        {jobs.map((job) => (
          <motion.div
            layoutId={job.id}
            key={job.id}
            onClick={() => onJobClick(job)}
            className="dispatch-card p-5 cursor-pointer hover:border-brand-neon/50 transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-[11px] font-semibold font-mono text-brand-neon bg-brand-neon/10 px-2 py-0.5 rounded">#{job.job_ref?.toString().padStart(4, '0')}</span>
              <span className="text-[11px] font-medium text-brand-muted">{format(new Date(job.created_at || new Date()), 'HH:mm')}</span>
            </div>
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-brand-muted" />
                <p className="text-xs font-medium truncate">{job.pickup_location}</p>
              </div>
              <ChevronRight className="w-3 h-3 text-brand-muted mx-auto" />
              <div className="flex items-center gap-2">
                <Navigation className="w-3 h-3 text-brand-muted" />
                <p className="text-xs font-medium truncate">{job.delivery_location}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-brand-border">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-input flex items-center justify-center border border-brand-border">
                  <User className="w-3 h-3 text-brand-muted" />
                </div>
                <span className="text-xs text-brand-muted font-medium truncate max-w-[80px]">{job.sender_name}</span>
              </div>
              <div className={cn(
                "px-2 py-0.5 rounded text-xs font-medium",
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

const JobDetailModal = ({ job, drivers, onClose, onUpdate }: { job: JobWithDriver, drivers: Driver[], onClose: () => void, onUpdate: () => void }) => {
  const [copiedStep, setCopiedStep] = React.useState<string | null>(null);
  const [reassigning, setReassigning] = React.useState(false);
  const [assigningDriver, setAssigningDriver] = React.useState(false);
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
        className="relative w-full max-w-5xl bg-brand-bg border border-brand-border rounded-[40px] shadow-3xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
      >
        <div className="md:w-1/2 p-8 border-r border-brand-border overflow-y-auto no-scrollbar">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-mono font-semibold text-brand-neon bg-brand-neon/10 px-3 py-1 rounded">#{job.job_ref?.toString().padStart(4, '0')}</span>
                <span className="text-xs font-medium uppercase tracking-wide text-brand-muted">{format(new Date(job.created_at || new Date()), 'PPP')}</span>
              </div>
              <h2 className="text-3xl font-display font-medium tracking-tighter">Job Manifest.</h2>
            </div>
            <div className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium border",
              job.status === 'completed' ? "bg-brand-neon/10 text-brand-neon border-brand-neon/20" : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
            )}>
              {job.status?.replace('_', ' ')}
            </div>
          </div>

          <div className="space-y-10">
             <div className="grid grid-cols-2 gap-8">
               <div className="space-y-4">
                 <p className="text-xs font-medium text-brand-muted">Consignor (Sender)</p>
                 <div className="p-5 bg-brand-input rounded-2xl border border-brand-border">
                   <p className="text-sm font-medium mb-1">{job.sender_name}</p>
                   <p className="text-[11px] font-mono text-brand-muted">{job.sender_phone}</p>
                 </div>
               </div>
               <div className="space-y-4">
                 <p className="text-xs font-medium text-brand-muted">Consignee (Recipient)</p>
                 <div className="p-5 bg-brand-input rounded-2xl border border-brand-border">
                   <p className="text-sm font-medium mb-1">{job.recipient_name}</p>
                   <p className="text-[11px] font-mono text-brand-muted">{job.recipient_phone}</p>
                 </div>
               </div>
             </div>

             <div className="space-y-4">
                <p className="text-xs font-medium text-brand-muted">Pilot Assignment</p>
                <div className="p-6 bg-brand-surface border border-brand-neon/20 rounded-3xl flex justify-between items-center group">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-brand-neon/10 flex items-center justify-center border border-brand-neon/20 group-hover:scale-110 transition-transform">
                        <Truck className="w-6 h-6 text-brand-neon" />
                      </div>
                      <div>
                        {job.driver?.full_name ? (
                          <>
                            <p className="text-sm font-medium text-brand-text mb-1">{job.driver.full_name}</p>
                            <p className="text-xs text-brand-muted font-medium">Active: {job.driver.phone}</p>
                          </>
                        ) : (
                          <p className="text-sm font-medium text-brand-muted">No Driver Assigned Yet</p>
                        )}
                      </div>
                   </div>
                   <button
                     type="button"
                     onClick={() => setReassigning(v => !v)}
                     className="btn-secondary px-6 py-2 h-auto text-xs uppercase"
                   >
                     {job.driver?.full_name ? 'Reassign' : 'Assign'}
                   </button>
                </div>
                {reassigning && (
                  <div className="flex items-center gap-2">
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
                      className="flex-1 bg-brand-input border border-brand-input-border rounded-lg px-4 py-2.5 text-xs font-medium text-brand-text focus:border-brand-neon/50 outline-none"
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

             <div className="space-y-4 pt-4">
                <p className="text-xs font-medium text-brand-muted">Operational Comms</p>
                <div className="grid grid-cols-3 gap-4">
                   {[
                     { id: 'sender', label: 'Sender Dsp.', sent: job.sender_notified },
                     { id: 'driver', label: 'Driver Dsp.', sent: job.driver_notified },
                     { id: 'recipient', label: 'Client Dsp.', sent: job.recipient_notified }
                   ].map((btn) => (
                     <button
                        key={btn.id}
                        onClick={() => dispatchWhatsApp(btn.id as any)}
                        className={cn(
                          "flex flex-col items-center justify-center p-6 rounded-2xl border transition-all gap-4",
                          btn.sent ? "bg-brand-surface border-brand-border grayscale" : "bg-brand-input border-brand-neon/20 hover:border-brand-neon hover:shadow-[0_0_15px_rgba(57,255,20,0.1)]"
                        )}
                     >
                        <MessageSquare className={cn("w-6 h-6", btn.sent ? "text-brand-muted" : "text-brand-neon")} />
                        <div className="text-center">
                          <span className="block text-xs font-semibold uppercase tracking-wide mb-1">{btn.label}</span>
                          <span className={cn("text-xs font-medium", btn.sent ? "text-brand-muted" : "text-brand-neon")}>
                            {btn.sent ? 'Dispatched' : 'Ready'}
                          </span>
                        </div>
                     </button>
                   ))}
                </div>
             </div>
          </div>
        </div>

        <div className="md:w-1/2 p-8 bg-brand-surface/30 flex flex-col">
           <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-display font-medium tracking-tighter">Chain of Custody (COC).</h3>
              <button 
                onClick={onClose}
                className="p-2 bg-brand-input rounded-full text-brand-muted hover:text-brand-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
           </div>

           <div className="flex-grow space-y-8 relative">
              <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-brand-border" />
              
              {[
                { label: 'Sender Handover', status: job.client_pickup_at, key: 'token_client_pickup', icon: Package },
                { label: 'Driver Pickup Confirmed', status: job.driver_pickup_at, key: 'token_driver_pickup', icon: Truck },
                { label: 'In-Transit Validation', status: job.driver_delivery_at, key: 'token_driver_delivery', icon: Navigation },
                { label: 'Final Receipt & Signature', status: job.client_delivery_at, key: 'token_client_delivery', icon: Shield }
              ].map((step, i) => {
                const cocDomain = (import.meta.env.VITE_COC_URL || 'https://nokael.ae').replace(/\/$/, '');
                const stepSlug = step.key.replace('token_', '').replace('_', '-');
                const tokenValue = (job as any)[step.key];
                const stepUrl = tokenValue ? `${cocDomain}/${tokenValue}/${stepSlug}` : '';
                return (
                  <div key={i} className="flex gap-8 relative z-10">
                     <div className={cn(
                       "w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500",
                       step.status ? "bg-brand-neon border-brand-neon text-brand-bg shadow-[0_0_15px_rgba(57,255,20,0.3)]" : "bg-brand-bg border-brand-border text-brand-muted"
                     )}>
                        {step.status ? <CheckCircle2 className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                     </div>
                     <div className="flex-grow min-w-0">
                        <div className="flex justify-between items-start mb-1">
                           <p className={cn("text-sm font-medium", step.status ? "text-brand-text" : "text-brand-muted")}>{step.label}</p>
                           {step.status && (
                              <span className="text-xs font-mono text-brand-neon font-semibold">{format(new Date(step.status), 'HH:mm:ss')}</span>
                           )}
                        </div>
                        <p className="text-xs text-brand-muted font-medium leading-relaxed">
                          {step.status ? 
                            `Authorized via Link/OTP Authentication` : 
                            `Waiting for digital confirmation via token [${tokenValue?.toString().substring(0, 8) || '...'}]`
                          }
                        </p>
                        {tokenValue && (
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(stepUrl);
                                setCopiedStep(step.key);
                                setTimeout(() => setCopiedStep(null), 2000);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-input hover:bg-brand-border rounded-lg border border-brand-border text-xs font-semibold text-brand-neon tracking-wider uppercase transition-all hover:scale-105"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedStep === step.key ? 'Copied' : 'Copy link'}
                            </button>
                            <a
                              href={stepUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-input hover:bg-brand-border rounded-lg border border-brand-border text-xs font-semibold text-brand-muted hover:text-brand-text tracking-wider uppercase transition-all hover:scale-105"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Open link
                            </a>
                          </div>
                        )}
                     </div>
                  </div>
                );
              })}
           </div>

           {job.status === 'completed' && (
             <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="pt-10 border-t border-brand-border"
             >
                <button 
                  onClick={() => generateJobPOC(job)}
                  className="btn-primary w-full py-5 text-sm flex items-center justify-center gap-3"
                >
                   <Download className="w-5 h-5" />
                   Generate COC Certificate (PDF)
                </button>
             </motion.div>
           )}
        </div>
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