import React from 'react';
import { motion } from 'motion/react';
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
  Navigation,
  Package,
  Truck,
  FileText,
  ExternalLink,
  Star,
  X,
  Mail,
  MapPin
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
  type DriverDocument
} from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';

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
  const [activeTab, setActiveTab] = React.useState<'jobs' | 'drivers'>('jobs');
  const [requests, setRequests] = React.useState<QuoteRequest[]>([]);
  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = React.useState<(Driver & { documents: DriverDocument[] }) | null>(null);
  const [loading, setLoading] = React.useState(true);
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
  }, [navigate]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Always fetch both so we can assign drivers in the jobs tab
      const [requestsData, driversData] = await Promise.all([
        getQuoteRequests(),
        getDrivers()
      ]);
      setRequests(requestsData);
      setDrivers(driversData);
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
    try {
      await updateDriverStatus(id, updates);
      setDrivers(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
      if (selectedDriver?.id === id) {
        setSelectedDriver(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (error) {
      console.error('Error updating driver:', error);
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
                          r.delivery_location.toLowerCase().includes(searchTerm.toLowerCase());
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

  const approvedDrivers = drivers.filter(d => d.onboarding_status === 'approved');

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    completed: requests.filter(r => r.status === 'completed').length,
    drivers: drivers.length,
    pendingDrivers: drivers.filter(d => d.onboarding_status === 'pending').length,
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
            <div className="w-10 h-10 bg-brand-neon/10 rounded-lg flex items-center justify-center text-brand-neon">
              <Activity className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-display font-medium tracking-tighter">Dispatch Command Center.</h1>
          </div>
          
          <nav className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => setActiveTab('jobs')}
              className={`text-[10px] font-bold uppercase tracking-[0.3em] transition-colors ${activeTab === 'jobs' ? 'text-brand-neon' : 'text-brand-muted hover:text-brand-text'}`}
            >
              Dispatch Log
            </button>
            <button 
              onClick={() => setActiveTab('drivers')}
              className={`text-[10px] font-bold uppercase tracking-[0.3em] transition-colors ${activeTab === 'drivers' ? 'text-brand-neon' : 'text-brand-muted hover:text-brand-text'}`}
            >
              Driver Network
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
          <StatCard title="Total Dispatch" value={stats.total} icon={LayoutDashboard} trend="+12%" />
          <StatCard title="Pending Pickup" value={stats.pending} icon={Clock} />
          <StatCard title="Active Units" value={stats.drivers} icon={Truck} />
          <StatCard title="Driver Intake" value={stats.pendingDrivers} icon={Users} />
        </div>

        {activeTab === 'jobs' ? (
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
                            {req.tracking_id && (
                              <div className="text-[9px] text-brand-neon font-bold uppercase tracking-widest font-mono">ID: {req.tracking_id}</div>
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
                            <span className="text-xs font-bold">{driver.reliability_score}</span>
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
            <div className="p-8 border-b border-brand-border flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-display font-medium tracking-tighter mb-1">{selectedDriver.full_name}</h2>
                <p className="text-[10px] text-brand-muted uppercase tracking-[0.3em] font-bold">Driver ID: {selectedDriver.id?.substring(0, 8)}</p>
              </div>
              <button 
                onClick={() => setSelectedDriver(null)}
                className="p-2 text-brand-muted hover:text-brand-text transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-8 no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <div className="space-y-6">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted">Contact Details</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-brand-neon" />
                      <span>{selectedDriver.phone}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-brand-neon" />
                      <span>{selectedDriver.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-brand-neon" />
                      <span>{selectedDriver.base_location}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted">Vehicle & Logistics</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sm">
                      <Truck className="w-4 h-4 text-brand-neon" />
                      <span>{selectedDriver.vehicle_type}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Navigation className="w-4 h-4 text-brand-neon" />
                      <span>Inter-Emirate: {selectedDriver.inter_emirate_yes_no ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Clock className="w-4 h-4 text-brand-neon" />
                      <span>{selectedDriver.availability_hours}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted">Internal Management</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Tier</label>
                      <select 
                        value={selectedDriver.tier}
                        onChange={(e) => handleDriverStatusUpdate(selectedDriver.id!, { tier: e.target.value as any })}
                        className="bg-brand-input border border-brand-input-border rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest outline-none"
                      >
                        <option value="A">Tier A</option>
                        <option value="B">Tier B</option>
                        <option value="C">Tier C</option>
                        <option value="D">Tier D</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Score</label>
                      <input 
                        type="number"
                        value={selectedDriver.reliability_score}
                        onChange={(e) => handleDriverStatusUpdate(selectedDriver.id!, { reliability_score: parseInt(e.target.value) })}
                        className="w-20 bg-brand-input border border-brand-input-border rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-12">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted mb-6">Uploaded Documents (Google Drive)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedDriver.documents.map((doc) => (
                    <div key={doc.id} className="p-6 bg-brand-input border border-brand-input-border rounded-2xl flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-brand-neon/10 flex items-center justify-center text-brand-neon">
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
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted mb-6">Internal Notes</h3>
                <textarea 
                  className="w-full bg-brand-input border border-brand-input-border rounded-2xl p-6 text-sm outline-none focus:border-brand-neon/50 transition-all min-h-[120px]"
                  placeholder="Add internal notes about this driver..."
                  value={selectedDriver.internal_notes || ''}
                  onChange={(e) => handleDriverStatusUpdate(selectedDriver.id!, { internal_notes: e.target.value })}
                />
              </div>
            </div>

            <div className="p-8 border-t border-brand-border bg-brand-surface/50 flex gap-4">
              <button 
                onClick={() => handleDriverStatusUpdate(selectedDriver.id!, { onboarding_status: 'approved' })}
                className="flex-1 py-4 bg-brand-neon text-brand-bg text-[10px] font-bold uppercase tracking-[0.3em] rounded-xl hover:opacity-90 transition-all"
              >
                Approve Driver
              </button>
              <button 
                onClick={() => handleDriverStatusUpdate(selectedDriver.id!, { onboarding_status: 'rejected' })}
                className="flex-1 py-4 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase tracking-[0.3em] rounded-xl hover:bg-red-500 hover:text-white transition-all"
              >
                Reject Application
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
