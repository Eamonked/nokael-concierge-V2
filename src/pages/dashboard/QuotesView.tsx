import React from 'react';
import {
  ChevronRight,
  Search,
  Shield,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Undo2,
  Zap,
  XCircle,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Area,
} from 'recharts';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import type { QuoteRequest } from '../../lib/supabase';

const CHART_DATA = [
  { name: 'Mon', jobs: 4  },
  { name: 'Tue', jobs: 7  },
  { name: 'Wed', jobs: 5  },
  { name: 'Thu', jobs: 12 },
  { name: 'Fri', jobs: 15 },
  { name: 'Sat', jobs: 9  },
  { name: 'Sun', jobs: 6  },
];

interface QuotesViewProps {
  filteredRequests: QuoteRequest[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  onStatusUpdate: (id: string, status: QuoteRequest['status']) => void;
  onReopenQuote: (id: string) => void;
  onConvertToJob: (quote: QuoteRequest) => void;
  onMarkLost: (quote: QuoteRequest) => void;
  onDelete: (id: string) => void;
}

export function QuotesView({
  filteredRequests,
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  onStatusUpdate,
  onReopenQuote,
  onConvertToJob,
  onMarkLost,
  onDelete,
}: QuotesViewProps) {
  return (
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
            <AreaChart data={CHART_DATA}>
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
              <option value="active">Active (Pending + Contacted)</option>
              <option value="all">All status</option>
              <option value="pending">Pending</option>
              <option value="contacted">Contacted</option>
              <option value="completed">Completed / Converted</option>
              <option value="lost">Lost / Never Converted</option>
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
                      {req.status === 'lost' && req.lost_reason && (
                        <div className="flex items-start gap-1.5 mt-1 p-2 bg-red-500/5 border border-red-500/20 rounded">
                          <AlertTriangle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-[10px] text-red-500/70 font-medium uppercase tracking-wide mb-0.5">Lost Reason:</div>
                            <div className="text-xs text-red-500 font-medium">{req.lost_reason}</div>
                            {req.lost_at && (
                              <div className="text-[10px] text-red-500/60 font-medium mt-0.5">
                                {format(new Date(req.lost_at), 'MMM d, yyyy')}
                              </div>
                            )}
                          </div>
                        </div>
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
                      onChange={(e) => onStatusUpdate(req.id!, e.target.value as any)}
                      className={`text-[11px] font-medium uppercase tracking-wide px-4 py-2 rounded-lg border outline-none transition-all ${
                        req.status === 'completed' ? 'bg-brand-neon/5 border-brand-neon/20 text-brand-neon' :
                        req.status === 'contacted' ? 'bg-blue-500/5 border-blue-500/20 text-blue-500' :
                        req.status === 'lost' ? 'bg-red-500/5 border-red-500/20 text-red-500' :
                        'bg-yellow-500/5 border-yellow-500/20 text-yellow-500'
                      }`}
                    >
                      <option value="pending">Pending</option>
                      <option value="contacted">Contacted</option>
                      <option value="completed">Completed / Converted</option>
                      <option value="lost">Lost / Never Converted</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {req.status === 'completed' ? (
                        <span
                          title="This quote has already been converted to a job"
                          className="px-3 py-1.5 bg-brand-neon/5 text-brand-neon/70 text-xs font-medium rounded-lg flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Converted
                        </span>
                      ) : req.status === 'lost' ? (
                        <button 
                          onClick={() => onReopenQuote(req.id!)}
                          title="Reopen Quote"
                          className="px-3 py-1.5 bg-blue-500/10 text-blue-500 text-xs font-medium rounded-lg flex items-center gap-1.5 hover:bg-blue-500 hover:text-white transition-all"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          Reopen
                        </button>
                      ) : (
                        <>
                          <button 
                            onClick={() => onConvertToJob(req)}
                            title="Create Job"
                            className="px-3 py-1.5 bg-brand-neon/10 text-brand-neon text-xs font-medium rounded-lg flex items-center gap-1.5 hover:bg-brand-neon hover:text-brand-bg transition-all"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            Create Job
                          </button>
                          <button 
                            onClick={() => onMarkLost(req)}
                            title="Mark as Lost"
                            className="px-3 py-1.5 bg-red-500/10 text-red-500 text-xs font-medium rounded-lg flex items-center gap-1.5 hover:bg-red-500 hover:text-white transition-all"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Mark Lost
                          </button>
                        </>
                      )}
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
                        onClick={() => onDelete(req.id!)}
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
  );
}
