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
  Truck
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
import { getQuoteRequests, updateQuoteStatus, deleteQuoteRequest, type QuoteRequest } from '../lib/supabase';
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
  const [requests, setRequests] = React.useState<QuoteRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState<string>('all');
  const navigate = useNavigate();

  // Simple auth check for demo (in real app use Supabase Auth)
  React.useEffect(() => {
    const isAuth = localStorage.getItem('nokael_admin_auth');
    if (!isAuth) {
      navigate('/login');
    }
    fetchData();
  }, [navigate]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getQuoteRequests();
      setRequests(data);
    } catch (err: any) {
      console.error('Error fetching requests:', err);
      setError(err.message || 'Failed to fetch dispatch data. Please check your Supabase configuration and ensure the "quote_requests" table exists.');
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

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this request?')) return;
    try {
      await deleteQuoteRequest(id);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting request:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('nokael_admin_auth');
    navigate('/login');
  };

  const filteredRequests = requests.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.pickup_location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.delivery_location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    completed: requests.filter(r => r.status === 'completed').length,
    contacted: requests.filter(r => r.status === 'contacted').length,
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

  if (loading) {
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
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-brand-neon/10 rounded-lg flex items-center justify-center text-brand-neon">
            <Activity className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-display font-medium tracking-tighter">Dispatch Command Center.</h1>
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
            <div className="flex gap-4">
              <button 
                onClick={fetchData}
                className="text-[10px] font-bold uppercase tracking-widest underline hover:text-red-400 transition-colors"
              >
                Retry Connection
              </button>
              <a 
                href="https://supabase.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[10px] font-bold uppercase tracking-widest underline hover:text-red-400 transition-colors"
              >
                Supabase Console
              </a>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard title="Total Dispatch" value={stats.total} icon={LayoutDashboard} trend="+12%" />
          <StatCard title="Pending Pickup" value={stats.pending} icon={Clock} />
          <StatCard title="Completed Jobs" value={stats.completed} icon={CheckCircle2} />
          <StatCard title="Active Units" value="14" icon={Truck} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Chart Section */}
          <div className="lg:col-span-2 dispatch-card p-10">
            <div className="flex justify-between items-center mb-12">
              <div>
                <h2 className="text-xl font-display font-medium tracking-tighter mb-1">Growth Analytics.</h2>
                <p className="text-[10px] text-brand-muted uppercase tracking-[0.3em] font-bold font-mono">Real-time corridor volume</p>
              </div>
              <select className="bg-brand-input border border-brand-input-border rounded-xl px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-brand-neon/50">
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
              </select>
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
                  <XAxis 
                    dataKey="name" 
                    stroke="#4A4E54" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fontWeight: 700, letterSpacing: '0.2em' }}
                  />
                  <YAxis 
                    stroke="#4A4E54" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fontWeight: 700 }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-border)', borderRadius: '16px', padding: '12px' }}
                    itemStyle={{ color: '#39FF14', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    labelStyle={{ color: 'var(--color-brand-muted)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '8px' }}
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
                { label: 'Dispatch Server', status: 'Online', color: 'text-brand-neon' },
                { label: 'WhatsApp API', status: 'Connected', color: 'text-brand-neon' },
                { label: 'Driver Network', status: 'Active (14)', color: 'text-brand-neon' },
                { label: 'Database Sync', status: 'Live', color: 'text-brand-neon' },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center p-5 bg-brand-input border border-brand-input-border rounded-2xl">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-neon" />
                    <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${item.color}`}>{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-12 p-8 bg-brand-neon/5 border border-brand-neon/20 rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-4 h-4 text-brand-neon" />
                <p className="text-[10px] font-bold text-brand-neon uppercase tracking-[0.3em]">Operational Insight</p>
              </div>
              <p className="text-sm text-brand-text/80 leading-relaxed font-medium">
                Inter-emirate demand is up 15% in Abu Dhabi. Consider re-positioning 2 drivers to the Yas Island corridor.
              </p>
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
                  <th className="px-10 py-5">System Status</th>
                  <th className="px-10 py-5 text-right">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-brand-input transition-colors group">
                    <td className="px-10 py-8">
                      <div className="font-medium text-brand-text mb-1.5 text-sm">{req.name}</div>
                      <div className="text-[10px] text-brand-muted font-bold uppercase tracking-widest">{req.phone}</div>
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
                        value={req.status}
                        onChange={(e) => handleStatusUpdate(req.id!, e.target.value as any)}
                        className={`text-[9px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-lg border outline-none transition-all ${
                          req.status === 'completed' ? 'bg-brand-neon/5 border-brand-neon/20 text-brand-neon' :
                          req.status === 'contacted' ? 'bg-blue-500/5 border-blue-500/20 text-blue-500' :
                          'bg-yellow-500/5 border-yellow-500/20 text-yellow-500'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="contacted">Contacted</option>
                        <option value="completed">Completed</option>
                      </select>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                        <a 
                          href={`https://wa.me/${req.phone.replace(/\D/g, '')}`}
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
          
          {filteredRequests.length === 0 && (
            <div className="p-32 text-center text-brand-muted uppercase tracking-[0.3em] text-[10px] font-bold">
              No dispatch data available for current parameters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
