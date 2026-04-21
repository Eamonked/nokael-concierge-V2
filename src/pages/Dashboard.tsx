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
  type UrgencyType
} from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { generateJobPOC } from '../lib/pdf-export';
import { sendTelegramNotification, formatJobAssignmentNotification } from '../lib/notifications';

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <div className="dispatch-card group">
    <div className="flex justify-between items-start mb-6">
      <div className="w-10 h-10 bg-brand-neon/10 rounded-lg flex items-center justify-center text-brand-neon group-hover:bg-brand-neon group-hover:text-brand-bg transition-all duration-500">
        <Icon className="w-5 h-5" />
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-brand-neon text-[10px] font-bold uppercase tracking-widest">
          <TrendingUp className="w-3 h-3" />
          <span>{trend}</span>
        </div>
      )}
    </div>
    <h3 className="text-brand-muted text-[10px] uppercase tracking-[0.3em] font-bold mb-2">{title}</h3>
    <p className="text-4xl font-display font-medium tracking-tighter text-brand-text">{value}</p>
  </div>
);

export default function Dashboard() {
  const [activeTab, setActiveTab] = React.useState<'pipeline' | 'quotes' | 'drivers' | 'business'>('pipeline');
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [requests, setRequests] = React.useState<QuoteRequest[]>([]);
  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [businessInquiries, setBusinessInquiries] = React.useState<BusinessInquiry[]>([]);
  
  const [selectedDriver, setSelectedDriver] = React.useState<(Driver & { documents: DriverDocument[] }) | null>(null);
  const [selectedBusiness, setSelectedBusiness] = React.useState<BusinessInquiry | null>(null);
  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);
  const [showJobCreateModal, setShowJobCreateModal] = React.useState(false);
  const [jobPrefillData, setJobPrefillData] = React.useState<Partial<Job> | undefined>(undefined);
  const [jobViewMode, setJobViewMode] = React.useState<'kanban' | 'list'>('kanban');

  const [loading, setLoading] = React.useState(true);
  const [isUpdating, setIsUpdating] = React.useState<string | null>(null);
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
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/login');
      } else {
        fetchData();
      }
    });

    // Subscribe to job changes
    const subscription = subscribeToJobs((payload) => {
      if (payload.eventType === 'INSERT') {
        setJobs(prev => [payload.new as Job, ...prev]);
      } else if (payload.eventType === 'UPDATE') {
        setJobs(prev => prev.map(job => job.id === payload.new.id ? payload.new as Job : job));
        if (selectedJob?.id === payload.new.id) {
          setSelectedJob(payload.new as Job);
        }
      } else if (payload.eventType === 'DELETE') {
        setJobs(prev => prev.filter(job => job.id !== payload.old.id));
      }
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

  const approvedDrivers = drivers.filter(d => d.onboarding_status === 'approved');

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

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      {/* Sidebar / Header */}
      <div className="fixed top-0 left-0 right-0 h-20 bg-brand-bg/80 backdrop-blur-xl border-b border-brand-border z-50 flex items-center justify-between px-8">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-brand-border">
              <img src="/logo.svg" alt="Nokael Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <h1 className="text-xl font-display font-medium tracking-tighter">Dispatch Command Center.</h1>
          </div>
          
          <nav className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => setActiveTab('pipeline')}
              className={`text-[10px] font-bold uppercase tracking-[0.3em] transition-colors ${activeTab === 'pipeline' ? 'text-brand-neon' : 'text-brand-muted hover:text-brand-text'}`}
            >
              Command Centre
            </button>
            <button 
              onClick={() => setActiveTab('quotes')}
              className={`text-[10px] font-bold uppercase tracking-[0.3em] transition-colors ${activeTab === 'quotes' ? 'text-brand-neon' : 'text-brand-muted hover:text-brand-text'}`}
            >
              Dispatch Log
            </button>
            <button 
              onClick={() => setActiveTab('drivers')}
              className={`text-[10px] font-bold uppercase tracking-[0.3em] transition-colors ${activeTab === 'drivers' ? 'text-brand-neon' : 'text-brand-muted hover:text-brand-text'}`}
            >
              Driver Network
            </button>
            <button 
              onClick={() => setActiveTab('business')}
              className={`text-[10px] font-bold uppercase tracking-[0.3em] transition-colors ${activeTab === 'business' ? 'text-brand-neon' : 'text-brand-muted hover:text-brand-text'}`}
            >
              Business Accounts
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-8">
          <div className="hidden md:flex items-center gap-6 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted">
            <span className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-neon animate-pulse" />
              System Live
            </span>
            <span>Uptime: 99.9%</span>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-brand-muted hover:text-brand-text transition-colors text-[10px] font-bold uppercase tracking-[0.3em]"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="pt-32 pb-20 px-8 max-w-[1600px] mx-auto">
        {error && (
          <div className="mb-12 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-widest">System Error</h3>
            </div>
            <p className="text-xs leading-relaxed opacity-80 mb-4">{error}</p>
            <button onClick={fetchData} className="text-[10px] font-bold uppercase tracking-widest underline">Retry Connection</button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard title="Live Mission Ops" value={jobs.filter(j => j.status !== 'completed').length} icon={Zap} color="neon" />
          <StatCard title="Quotation Pool" value={stats.total} icon={LayoutDashboard} trend="+12%" />
          <StatCard title="Active Units" value={stats.drivers} icon={Truck} />
          <StatCard title="Corporate Leads" value={stats.business} icon={Shield} />
        </div>

        {activeTab === 'pipeline' ? (
          <div className="space-y-8">
            <div className="flex justify-between items-center bg-brand-surface/20 p-6 rounded-3xl border border-brand-border">
              <div className="flex items-center gap-8">
                <nav className="flex items-center gap-6">
                  <button 
                    onClick={() => setJobViewMode('kanban')}
                    className={cn(
                      "flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-all py-2 border-b-2",
                      jobViewMode === 'kanban' ? "text-brand-neon border-brand-neon" : "text-brand-muted border-transparent hover:text-brand-text"
                    )}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Board View
                  </button>
                  <button 
                    onClick={() => setJobViewMode('list')}
                    className={cn(
                      "flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-all py-2 border-b-2",
                      jobViewMode === 'list' ? "text-brand-neon border-brand-neon" : "text-brand-muted border-transparent hover:text-brand-text"
                    )}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Live Pipeline
                  </button>
                </nav>
              </div>
              <button 
                onClick={() => setShowJobCreateModal(true)}
                className="flex items-center gap-3 bg-brand-neon text-brand-bg px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(57,255,20,0.2)]"
              >
                <Plus className="w-4 h-4" />
                Manual Mission Dispatch
              </button>
            </div>

            {jobViewMode === 'kanban' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-[calc(100vh-350px)] min-h-[600px]">
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
                      <tr className="bg-brand-input/50 text-[9px] font-black uppercase tracking-[0.3em] text-brand-muted">
                        <th className="px-10 py-5">Job Reference</th>
                        <th className="px-10 py-5">Route & Timeline</th>
                        <th className="px-10 py-5">Stakeholders</th>
                        <th className="px-10 py-5">Chain of Custody</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {jobs.map((job) => (
                        <tr 
                          key={job.id} 
                          className="hover:bg-brand-surface/30 transition-colors group cursor-pointer"
                          onClick={() => setSelectedJob(job)}
                        >
                          <td className="px-10 py-8">
                              <div className="text-sm font-mono font-black text-brand-neon mb-1">#{job.job_ref?.toString().padStart(4, '0')}</div>
                              <span className={cn(
                                "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                                job.status === 'completed' ? "bg-brand-neon/10 text-brand-neon" : "bg-yellow-500/10 text-yellow-500"
                              )}>{job.status?.replace('_', ' ')}</span>
                          </td>
                          <td className="px-10 py-8">
                              <div className="flex items-center gap-3 text-sm font-medium mb-2">
                                <span>{job.pickup_location}</span>
                                <ArrowRight className="w-3 h-3 text-brand-neon" />
                                <span>{job.delivery_location}</span>
                              </div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{job.pickup_emirate} Corridor</div>
                          </td>
                          <td className="px-10 py-8">
                              <p className="text-xs font-medium text-brand-text mb-1">{job.sender_name}</p>
                              <div className="flex gap-2 items-center">
                                <Truck className="w-3 h-3 text-brand-muted" />
                                <p className="text-[10px] text-brand-muted font-bold">{job.driver_name || 'Pilot Pending'}</p>
                              </div>
                          </td>
                          <td className="px-10 py-8">
                              <div className="flex gap-1.5">
                                {[
                                  { key: 'client_pickup_confirmed_at', label: 'Handover' },
                                  { key: 'driver_pickup_confirmed_at', label: 'Pickup' },
                                  { key: 'driver_delivery_confirmed_at', label: 'Inbound' },
                                  { key: 'client_delivery_confirmed_at', label: 'Final' }
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
              {/* Chart Section */}
              <div className="lg:col-span-2 dispatch-card p-10">
                <div className="flex justify-between items-center mb-12">
                  <div>
                    <h2 className="text-xl font-display font-medium tracking-tighter mb-1">Growth Analytics.</h2>
                    <p className="text-[10px] text-brand-muted uppercase tracking-[0.3em] font-bold font-mono">Real-time corridor volume</p>
                  </div>
                </div>
                <div className="h-[350px] w-full">
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
                        itemStyle={{ color: '#39FF14', fontSize: '10px', fontWeight: 800 }}
                      />
                      <Area type="monotone" dataKey="jobs" stroke="#39FF14" fillOpacity={1} fill="url(#colorJobs)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Quick Actions / Recent Activity */}
              <div className="dispatch-card p-10">
                <h2 className="text-xl font-display font-medium tracking-tighter mb-10">System Status.</h2>
                <div className="space-y-4">
                  {[
                    { label: 'Dispatch Server', status: 'Online' },
                    { label: 'WhatsApp API', status: 'Connected' },
                    { label: 'Driver Network', status: `Active (${stats.drivers})` },
                    { label: 'Google Drive', status: 'Linked' },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center p-5 bg-brand-input border border-brand-input-border rounded-2xl">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-neon" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-neon">{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Jobs Table */}
            <div className="dispatch-card overflow-hidden p-0">
              <div className="p-10 border-b border-brand-border flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <h2 className="text-xl font-display font-medium tracking-tighter mb-1">Live Dispatch Log.</h2>
                  <p className="text-[10px] text-brand-muted uppercase tracking-[0.3em] font-bold">Real-time job monitoring</p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="relative flex-1 md:w-72">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                    <input 
                      type="text" 
                      placeholder="Search dispatch..."
                      className="w-full bg-brand-input border border-brand-input-border rounded-xl py-3 pl-12 pr-4 text-xs focus:border-brand-neon/50 outline-none transition-all"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <select 
                    className="bg-brand-input border border-brand-input-border rounded-xl px-5 py-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-brand-neon/50"
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="picked_up">Picked Up</option>
                    <option value="in_transit">In Transit</option>
                    <option value="delivered">Delivered</option>
                    <option value="contacted">Contacted</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-brand-input text-[9px] uppercase tracking-[0.3em] font-bold text-brand-muted">
                      <th className="px-10 py-5">Client Profile</th>
                      <th className="px-10 py-5">Dispatch Route</th>
                      <th className="px-10 py-5">Item / Urgency</th>
                      <th className="px-10 py-5">Driver Assignment</th>
                      <th className="px-10 py-5">System Status</th>
                      <th className="px-10 py-5 text-right">Operations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-brand-input transition-colors group">
                        <td className="px-10 py-8">
                          <div className="font-medium text-brand-text mb-1.5 text-sm">{req.name}</div>
                          <div className="flex flex-col gap-1">
                            <div className="text-[10px] text-brand-muted font-bold uppercase tracking-widest">{req.phone}</div>
                            {req.corporate_code && (
                              <div className="flex items-center gap-1.5">
                                <Shield className="w-3 h-3 text-brand-neon" />
                                <span className="text-[9px] text-brand-neon font-black uppercase tracking-widest font-mono">Corp: {req.corporate_code}</span>
                              </div>
                            )}
                            {req.tracking_id && (
                              <div className="text-[9px] text-brand-muted font-bold uppercase tracking-widest font-mono">ID: {req.tracking_id}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <div className="flex items-center gap-3 text-sm font-medium mb-2">
                            <span>{req.pickup_location}</span>
                            <ArrowRight className="w-3 h-3 text-brand-neon" />
                            <span>{req.delivery_location}</span>
                          </div>
                          <div className="text-[10px] uppercase tracking-[0.2em] text-brand-muted font-bold">{req.emirate} Corridor</div>
                        </td>
                        <td className="px-10 py-8">
                          <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2 text-brand-text">{req.item_type}</div>
                          <div className={`text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 ${
                            req.urgency === 'immediate' ? 'text-red-500' : req.urgency === 'today' ? 'text-yellow-500' : 'text-blue-500'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              req.urgency === 'immediate' ? 'bg-red-500 animate-pulse' : req.urgency === 'today' ? 'bg-yellow-500' : 'bg-blue-500'
                            }`} />
                            {req.urgency}
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <select
                            value={req.assigned_driver_id || 'unassigned'}
                            onChange={(e) => handleAssignDriver(req.id!, e.target.value)}
                            className="bg-brand-surface border border-brand-border rounded-lg px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-text focus:border-brand-neon/50 outline-none w-full max-w-[180px]"
                          >
                            <option value="unassigned">Unassigned</option>
                            {approvedDrivers.map(d => (
                              <option key={d.id} value={d.id}>{d.full_name} ({d.vehicle_type})</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-10 py-8">
                          <select 
                            value={req.status}
                            onChange={(e) => handleStatusUpdate(req.id!, e.target.value as any)}
                            className={`text-[9px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-lg border outline-none transition-all ${
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
                        <td className="px-10 py-8 text-right">
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
            <div className="p-10 border-b border-brand-border flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <h2 className="text-xl font-display font-medium tracking-tighter mb-1">Business Accounts.</h2>
                <p className="text-[10px] text-brand-muted uppercase tracking-[0.3em] font-bold">Manage corporate partnerships</p>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-72">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                  <input 
                    type="text" 
                    placeholder="Search accounts..."
                    className="w-full bg-brand-input border border-brand-input-border rounded-xl py-3 pl-12 pr-4 text-xs focus:border-brand-neon/50 outline-none transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-brand-input text-[9px] uppercase tracking-[0.3em] font-bold text-brand-muted">
                    <th className="px-10 py-5">Company / Contact</th>
                    <th className="px-10 py-5">Frequency / Route</th>
                    <th className="px-10 py-5">Billing</th>
                    <th className="px-10 py-5">Account Status</th>
                    <th className="px-10 py-5 text-right">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {filteredBusiness.map((biz) => (
                    <tr key={biz.id} className="hover:bg-brand-input transition-colors group">
                      <td className="px-10 py-8">
                        <div className="font-medium text-brand-text mb-1.5 text-sm">{biz.company_name}</div>
                        <div className="flex flex-col gap-1">
                          <div className="text-[10px] text-brand-muted font-bold uppercase tracking-widest">{biz.contact_person} • {biz.phone_whatsapp}</div>
                          <div className="text-[9px] text-brand-neon font-black uppercase tracking-widest font-mono">ID: {biz.corporate_code}</div>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <div className="text-sm font-medium mb-1.5">{biz.estimated_monthly_volume} jobs/mo</div>
                        <div className="text-[10px] uppercase tracking-[0.2em] text-brand-muted font-bold truncate max-w-[200px]">{biz.typical_routes}</div>
                      </td>
                      <td className="px-10 py-8">
                        <div className={cn(
                          "px-3 py-1 inline-block rounded text-[9px] font-black uppercase tracking-widest",
                          biz.invoicing_required ? "bg-brand-neon/10 text-brand-neon border border-brand-neon/20" : "bg-brand-muted/10 text-brand-muted"
                        )}>
                          {biz.invoicing_required ? 'Monthly Invoicing' : 'Standard Pay'}
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <select 
                          value={biz.status}
                          onChange={(e) => handleBusinessUpdate(biz.id!, { status: e.target.value as any })}
                          className={`text-[9px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-lg border outline-none transition-all ${
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
                      <td className="px-10 py-8 text-right">
                        <button 
                          onClick={() => setSelectedBusiness(biz)}
                          className="px-6 py-2.5 bg-brand-surface border border-brand-border text-brand-text text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-brand-neon hover:text-brand-bg transition-all"
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
            <div className="p-10 border-b border-brand-border flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <h2 className="text-xl font-display font-medium tracking-tighter mb-1">Driver Network.</h2>
                <p className="text-[10px] text-brand-muted uppercase tracking-[0.3em] font-bold">Manage onboarding and verification</p>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-72">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                  <input 
                    type="text" 
                    placeholder="Search drivers..."
                    className="w-full bg-brand-input border border-brand-input-border rounded-xl py-3 pl-12 pr-4 text-xs focus:border-brand-neon/50 outline-none transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <select 
                  className="bg-brand-input border border-brand-input-border rounded-xl px-5 py-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-brand-neon/50"
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select 
                  className="bg-brand-input border border-brand-input-border rounded-xl px-5 py-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-brand-neon/50"
                  value={filterVehicle}
                  onChange={e => setFilterVehicle(e.target.value)}
                >
                  <option value="all">Vehicle Type</option>
                  <option value="Sedan">Sedan</option>
                  <option value="Executive SUV">Executive SUV</option>
                  <option value="Panel Van">Panel Van</option>
                  <option value="Motorcycle (License R)">Motorcycle</option>
                  <option value="3-Ton Pickup">3-Ton Pickup</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-brand-input text-[9px] uppercase tracking-[0.3em] font-bold text-brand-muted">
                    <th className="px-10 py-5">Driver Profile</th>
                    <th className="px-10 py-5">Vehicle / Location</th>
                    <th className="px-10 py-5">Tier / Score</th>
                    <th className="px-10 py-5">Onboarding</th>
                    <th className="px-10 py-5 text-right">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {filteredDrivers.map((driver) => (
                    <tr key={driver.id} className="hover:bg-brand-input transition-colors group">
                      <td className="px-10 py-8">
                        <div className="font-medium text-brand-text mb-1.5 text-sm">{driver.full_name}</div>
                        <div className="text-[10px] text-brand-muted font-bold uppercase tracking-widest">{driver.phone}</div>
                      </td>
                      <td className="px-10 py-8">
                        <div className="text-sm font-medium mb-1.5">{driver.vehicle_type}</div>
                        <div className="text-[10px] uppercase tracking-[0.2em] text-brand-muted font-bold">{driver.base_location}</div>
                      </td>
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-4">
                          <div className="px-3 py-1 bg-brand-neon/10 border border-brand-neon/20 rounded text-brand-neon text-[10px] font-bold">Tier {driver.tier}</div>
                          <div className="flex items-center gap-1.5 text-brand-text">
                            <Star className="w-3 h-3 text-brand-neon fill-brand-neon" />
                            <span className="text-xs font-bold">{driver.reliability_score || 0}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <select 
                          value={driver.onboarding_status}
                          onChange={(e) => handleDriverStatusUpdate(driver.id!, { onboarding_status: e.target.value as any })}
                          className={`text-[9px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-lg border outline-none transition-all ${
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
                      <td className="px-10 py-8 text-right">
                        <button 
                          onClick={() => handleViewDriver(driver.id!)}
                          className="px-6 py-2.5 bg-brand-surface border border-brand-border text-brand-text text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-brand-neon hover:text-brand-bg transition-all"
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
                    <p className="text-[10px] text-brand-muted uppercase tracking-[0.3em] font-bold">Driver ID: {selectedDriver.id?.substring(0, 8)}</p>
                    <div className={cn(
                      "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                <div className="space-y-6">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted border-b border-brand-border pb-2">Contact Details</h3>
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
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted border-b border-brand-border pb-2">Vehicle & Logistics</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-brand-input rounded-lg"><Truck className="w-4 h-4 text-brand-neon" /></div>
                      <span className="text-sm">{selectedDriver.vehicle_type}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-brand-input rounded-lg"><Navigation className="w-4 h-4 text-brand-neon" /></div>
                      <span className="text-sm">Inter-Emirate: {selectedDriver.inter_emirate_yes_no ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-brand-input rounded-lg"><Clock className="w-4 h-4 text-brand-neon" /></div>
                      <span className="text-xs text-brand-muted">{selectedDriver.availability_hours}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted border-b border-brand-border pb-2">Internal Management</h3>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-muted">Tiering Strategy</label>
                      <select 
                        value={selectedDriver.tier || 'D'}
                        onChange={(e) => handleDriverStatusUpdate(selectedDriver.id!, { tier: e.target.value as any })}
                        className="w-full bg-brand-input border border-brand-input-border rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-brand-neon/50 transition-all font-mono"
                      >
                        <option value="A">Elite Rank (A)</option>
                        <option value="B">Priority Rank (B)</option>
                        <option value="C">Standard Rank (C)</option>
                        <option value="D">New Arrival (D)</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-muted">Reliability Score (1-10)</label>
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
                          className="w-16 bg-brand-input border border-brand-input-border rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-brand-neon transition-all font-mono"
                        />
                        <div className="flex-1 bg-brand-input h-2 rounded-full overflow-hidden border border-brand-border">
                          <div 
                            className="h-full bg-brand-neon transition-all" 
                            style={{ width: `${(isNaN(selectedDriver.reliability_score!) ? 0 : (selectedDriver.reliability_score || 0)) * 10}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-12">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted border-b border-brand-border pb-4 mb-6">Uploaded Documents (Google Drive)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedDriver.documents?.map((doc) => (
                    <div key={doc.id} className="p-6 bg-brand-input border border-brand-input-border rounded-2xl flex items-center justify-between group hover:border-brand-neon/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-brand-bg flex items-center justify-center text-brand-muted group-hover:text-brand-neon transition-all">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-brand-text mb-1">{doc.document_type.replace('_', ' ')}</div>
                          <div className="text-[9px] text-brand-muted uppercase tracking-widest">Status: {doc.verification_status}</div>
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
                    <div className="col-span-2 p-12 bg-brand-input rounded-3xl border border-dashed border-brand-border text-center opacity-50">
                      <FileText className="w-10 h-10 text-brand-muted mx-auto mb-4" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">No documents found</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted mb-6">Internal Audit Notes</h3>
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
                className="flex-1 py-5 bg-brand-neon text-brand-bg text-[10px] font-bold uppercase tracking-[0.3em] rounded-2xl hover:bg-white disabled:opacity-50 transition-all flex items-center justify-center gap-3 group shadow-lg shadow-brand-neon/10"
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
                className="flex-1 py-5 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase tracking-[0.3em] rounded-2xl hover:bg-red-500 hover:text-white disabled:opacity-50 transition-all flex items-center justify-center gap-3 group"
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
                <p className="text-[10px] text-brand-muted uppercase tracking-[0.3em] font-bold">Business Entity</p>
              </div>
              <button 
                onClick={() => setSelectedBusiness(null)}
                className="p-2 text-brand-muted hover:text-brand-text transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-8 no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <div className="space-y-6">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted">Point of Contact</h3>
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
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted">Operational Scope</h3>
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
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted">Contract Admin</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Status</label>
                      <select 
                        value={selectedBusiness.status}
                        onChange={(e) => handleBusinessUpdate(selectedBusiness.id!, { status: e.target.value as any })}
                        className="bg-brand-input border border-brand-input-border rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest outline-none"
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
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text">
                        {selectedBusiness.invoicing_required ? 'Monthly Invoicing' : 'Standard Payment'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted mb-6">CRM & Follow-up Notes</h3>
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
                className="flex-1 py-4 bg-brand-neon text-brand-bg text-[10px] font-bold uppercase tracking-[0.3em] rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-3"
              >
                <MessageSquare className="w-4 h-4" />
                Contact Decision Maker
              </a>
              <button 
                onClick={() => setSelectedBusiness(null)}
                className="px-8 py-4 bg-brand-input border border-brand-input-border text-brand-text text-[10px] font-bold uppercase tracking-[0.3em] rounded-xl hover:bg-brand-surface transition-all"
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
            onClose={() => setSelectedJob(null)}
            onUpdate={fetchData}
           />
        )}
        {showJobCreateModal && (
          <JobCreateModal 
            initialData={jobPrefillData}
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
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-text">{title}</h3>
        </div>
        <span className="text-[10px] font-mono font-black text-brand-muted bg-brand-bg px-2 py-0.5 rounded border border-brand-border">{jobs.length}</span>
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
              <span className="text-[9px] font-black font-mono text-brand-neon bg-brand-neon/10 px-2 py-0.5 rounded">#{job.job_ref?.toString().padStart(4, '0')}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-brand-muted">{format(new Date(job.created_at || new Date()), 'HH:mm')}</span>
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
                <span className="text-[10px] text-brand-muted font-bold truncate max-w-[80px]">{job.sender_name}</span>
              </div>
              <div className={cn(
                "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
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
            <span className="text-[10px] font-bold uppercase tracking-widest">Clear</span>
          </div>
        )}
      </div>
    </div>
  );
};

const JobDetailModal = ({ job, onClose, onUpdate }: { job: Job, onClose: () => void, onUpdate: () => void }) => {
  const dispatchWhatsApp = (type: 'sender' | 'driver' | 'recipient') => {
    let message = '';
    let phone = '';
    
    if (type === 'sender') {
      phone = job.sender_phone;
      message = `Hi ${job.sender_name}, your Nokael pickup is confirmed.\nRoute: ${job.pickup_location} → ${job.delivery_location}\nItem: ${job.item_type} | Urgency: ${job.urgency}\n\nWhen handing over your package, tap to confirm:\nnokael.com/confirm/${job.token_client_pickup}/client-pickup\nNo internet? Give the driver your OTP: ${job.otp_sender}`;
    } else if (type === 'driver') {
      phone = job.driver_phone || '';
      message = `New job assigned — Job #${job.job_ref}\nPickup: ${job.pickup_location}, ${job.pickup_emirate}\nDelivery: ${job.delivery_location}, ${job.delivery_emirate}\nItem: ${job.item_type} | Urgency: ${job.urgency}\nSender: ${job.sender_name} | Recipient: ${job.recipient_name}\n\n── PICKUP ──\nnokael.com/confirm/${job.token_driver_pickup}/driver-pickup\n\n── DELIVERY ──\nnokael.com/confirm/${job.token_driver_delivery}/driver-delivery`;
    } else {
      phone = job.recipient_phone;
      message = `Hi ${job.recipient_name}, a package is on its way to you.\nFrom: ${job.sender_name} | Route: ${job.pickup_location} → ${job.delivery_location}\nItem: ${job.item_type}\n\nWhen you receive it, tap to confirm:\nnokael.com/confirm/${job.token_client_delivery}/client-delivery\nNo internet? Give the driver your OTP: ${job.otp_recipient}`;
    }
    
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
    
    // Update local sent flag
    const updatePayload: any = {};
    if (type === 'sender') updatePayload.whatsapp_sender_sent = true;
    if (type === 'driver') updatePayload.whatsapp_driver_sent = true;
    if (type === 'recipient') updatePayload.whatsapp_recipient_sent = true;
    
    updateJob(job.id, updatePayload).then(onUpdate);
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
        <div className="md:w-1/2 p-12 border-r border-brand-border overflow-y-auto no-scrollbar">
          <div className="flex justify-between items-start mb-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-mono font-black text-brand-neon bg-brand-neon/10 px-3 py-1 rounded">#{job.job_ref?.toString().padStart(4, '0')}</span>
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-muted">{format(new Date(job.created_at || new Date()), 'PPP')}</span>
              </div>
              <h2 className="text-3xl font-display font-medium tracking-tighter">Job Manifest.</h2>
            </div>
            <div className={cn(
              "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
              job.status === 'completed' ? "bg-brand-neon/10 text-brand-neon border-brand-neon/20" : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
            )}>
              {job.status?.replace('_', ' ')}
            </div>
          </div>

          <div className="space-y-10">
             <div className="grid grid-cols-2 gap-8">
               <div className="space-y-4">
                 <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">Consignor (Sender)</p>
                 <div className="p-5 bg-brand-input rounded-2xl border border-brand-border">
                   <p className="text-sm font-medium mb-1">{job.sender_name}</p>
                   <p className="text-[11px] font-mono text-brand-muted">{job.sender_phone}</p>
                 </div>
               </div>
               <div className="space-y-4">
                 <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">Consignee (Recipient)</p>
                 <div className="p-5 bg-brand-input rounded-2xl border border-brand-border">
                   <p className="text-sm font-medium mb-1">{job.recipient_name}</p>
                   <p className="text-[11px] font-mono text-brand-muted">{job.recipient_phone}</p>
                 </div>
               </div>
             </div>

             <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">Pilot Assignment</p>
                <div className="p-6 bg-brand-surface border border-brand-neon/20 rounded-3xl flex justify-between items-center group">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-brand-neon/10 flex items-center justify-center border border-brand-neon/20 group-hover:scale-110 transition-transform">
                        <Truck className="w-6 h-6 text-brand-neon" />
                      </div>
                      <div>
                        {job.driver_name ? (
                          <>
                            <p className="text-sm font-medium text-brand-text mb-1">{job.driver_name}</p>
                            <p className="text-[10px] text-brand-muted font-bold uppercase tracking-widest">Active: {job.driver_phone}</p>
                          </>
                        ) : (
                          <p className="text-sm font-medium text-brand-muted">No Driver Assigned Yet</p>
                        )}
                      </div>
                   </div>
                   <button className="btn-secondary px-6 py-2 h-auto text-[10px] uppercase">Reassign</button>
                </div>
             </div>

             <div className="space-y-4 pt-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">Operational Comms</p>
                <div className="grid grid-cols-3 gap-4">
                   {[
                     { id: 'sender', label: 'Sender Dsp.', sent: job.whatsapp_sender_sent },
                     { id: 'driver', label: 'Driver Dsp.', sent: job.whatsapp_driver_sent },
                     { id: 'recipient', label: 'Client Dsp.', sent: job.whatsapp_recipient_sent }
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
                          <span className="block text-[8px] font-black uppercase tracking-[0.2em] mb-1">{btn.label}</span>
                          <span className={cn("text-[7px] font-bold uppercase tracking-widest", btn.sent ? "text-brand-muted" : "text-brand-neon")}>
                            {btn.sent ? 'Dispatched' : 'Ready'}
                          </span>
                        </div>
                     </button>
                   ))}
                </div>
             </div>
          </div>
        </div>

        <div className="md:w-1/2 p-12 bg-brand-surface/30 flex flex-col">
           <div className="flex justify-between items-center mb-12">
              <h3 className="text-xl font-display font-medium tracking-tighter">Chain of Custody (COC).</h3>
              <button 
                onClick={onClose}
                className="p-2 bg-brand-input rounded-full text-brand-muted hover:text-brand-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
           </div>

           <div className="flex-grow space-y-12 relative">
              <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-brand-border" />
              
              {[
                { label: 'Sender Handover', status: job.client_pickup_confirmed_at, key: 'token_client_pickup', icon: Package },
                { label: 'Driver Pickup Confirmed', status: job.driver_pickup_confirmed_at, key: 'token_driver_pickup', icon: Truck },
                { label: 'In-Transit Validation', status: job.driver_delivery_confirmed_at, key: 'token_driver_delivery', icon: Navigation },
                { label: 'Final Receipt & Signature', status: job.client_delivery_confirmed_at, key: 'token_client_delivery', icon: Shield }
              ].map((step, i) => (
                <div key={i} className="flex gap-8 relative z-10">
                   <div className={cn(
                     "w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500",
                     step.status ? "bg-brand-neon border-brand-neon text-brand-bg shadow-[0_0_15px_rgba(57,255,20,0.3)]" : "bg-brand-bg border-brand-border text-brand-muted"
                   )}>
                      {step.status ? <CheckCircle2 className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                   </div>
                   <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-start mb-1">
                         <p className={cn("text-sm font-bold uppercase tracking-widest", step.status ? "text-brand-text" : "text-brand-muted")}>{step.label}</p>
                         {step.status && (
                            <span className="text-[10px] font-mono text-brand-neon font-black">{format(new Date(step.status), 'HH:mm:ss')}</span>
                         )}
                      </div>
                      <p className="text-[10px] text-brand-muted font-bold leading-relaxed">
                        {step.status ? 
                          `Authorized via ${job.client_pickup_method || 'Link'} Authentication` : 
                          `Waiting for digital confirmation via token [${(job as any)[step.key]?.toString().substring(0, 8)}...]`
                        }
                      </p>
                   </div>
                </div>
              ))}
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

const JobCreateModal = ({ onClose, onSuccess, initialData }: { onClose: () => void, onSuccess: () => void, initialData?: Partial<Job> }) => {
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
    driver_name: initialData?.driver_name || '',
    driver_phone: initialData?.driver_phone || '',
    notes: initialData?.notes || '',
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

      const payload = {
        ...formData,
        ...tokens,
        otp_sender: genOtp(),
        otp_driver: genOtp(),
        otp_recipient: genOtp(),
        source: 'manual' as any,
        status: 'pending' as any
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
        <div className="p-10 border-b border-brand-border flex justify-between items-center bg-brand-surface/20">
           <div>
              <h2 className="text-2xl font-display font-medium tracking-tighter mb-1">Manual Job Intake.</h2>
              <p className="text-[10px] text-brand-muted uppercase tracking-[0.3em] font-bold font-mono">Operator manual dispatch override</p>
           </div>
           <button onClick={onClose} className="p-2 bg-brand-input rounded-full text-brand-muted hover:text-brand-text transition-colors">
              <X className="w-6 h-6" />
           </button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 overflow-y-auto no-scrollbar space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="space-y-6">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-neon flex items-center gap-2">
                   <User className="w-3 h-3" />
                   Sender Information
                 </h3>
                 <div className="space-y-4">
                   <input required value={formData.sender_name} onChange={e => setFormData({...formData, sender_name: e.target.value})} type="text" placeholder="Full Name / Company" className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm focus:border-brand-neon/50 outline-none" />
                   <input required value={formData.sender_phone} onChange={e => setFormData({...formData, sender_phone: e.target.value})} type="tel" placeholder="WhatsApp Number" className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm focus:border-brand-neon/50 outline-none" />
                 </div>
               </div>
               <div className="space-y-6">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-neon flex items-center gap-2">
                   <User className="w-3 h-3" />
                   Recipient Information
                 </h3>
                 <div className="space-y-4">
                   <input required value={formData.recipient_name} onChange={e => setFormData({...formData, recipient_name: e.target.value})} type="text" placeholder="Full Name / Company" className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm focus:border-brand-neon/50 outline-none" />
                   <input required value={formData.recipient_phone} onChange={e => setFormData({...formData, recipient_phone: e.target.value})} type="tel" placeholder="WhatsApp Number" className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm focus:border-brand-neon/50 outline-none" />
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="space-y-6">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-neon flex items-center gap-2">
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
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-neon flex items-center gap-2">
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
               <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">Item Category</p>
                  <select value={formData.item_type} onChange={e => setFormData({...formData, item_type: e.target.value as any})} className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm outline-none">
                    <option value="parcel">Standard Parcel</option>
                    <option value="document">Legal Document</option>
                    <option value="spare_part">Machine Spare Part</option>
                    <option value="other">Other Manifest</option>
                  </select>
               </div>
               <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">Urgency Status</p>
                  <select value={formData.urgency} onChange={e => setFormData({...formData, urgency: e.target.value as any})} className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm outline-none">
                    <option value="immediate">Immediate Dispatch</option>
                    <option value="today">Same Day UAE</option>
                    <option value="scheduled">Scheduled Logistics</option>
                  </select>
               </div>
               <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">Driver Assignment</p>
                  <input value={formData.driver_name} onChange={e => setFormData({...formData, driver_name: e.target.value})} type="text" placeholder="Pilot Name" className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-5 text-sm outline-none" />
               </div>
            </div>

            <button disabled={loading} type="submit" className="btn-primary w-full py-6 flex items-center justify-center gap-4 text-sm font-black transition-all">
               {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6" />}
               Commit Dispatch to Pipeline
            </button>
        </form>
      </motion.div>
    </div>
  );
};
