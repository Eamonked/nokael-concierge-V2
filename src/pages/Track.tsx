import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import { 
  Search, 
  MapPin, 
  Navigation, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  MessageSquare, 
  Phone, 
  Zap, 
  Truck, 
  AlertCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  ShieldAlert, 
  ArrowRight, 
  Calendar, 
  User, 
  Building2, 
  Package, 
  FileText, 
  Wrench, 
  Radio,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { WHATSAPP_NUMBER } from '../constants';
import { trackWhatsAppClick } from '../lib/analytics';
import { 
  getTrackingInfo, 
  getJobById, 
  subscribeToJob, 
  type JobWithDriver, 
  type QuoteRequest,
  type TrackingResult,
  type JobStatus
} from '../lib/supabase';
import { format, formatDistanceToNow } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Map Item types to labels and icons
const getItemMeta = (itemType?: string) => {
  switch (itemType) {
    case 'document':
      return { label: 'Legal & Corporate Documents', icon: FileText, color: 'text-blue-400' };
    case 'spare_part':
      return { label: 'Critical Spare Parts', icon: Wrench, color: 'text-amber-400' };
    case 'parcel':
      return { label: 'Urgent Express Parcel', icon: Package, color: 'text-emerald-400' };
    default:
      return { label: 'Specialized Cargo', icon: Package, color: 'text-brand-neon' };
  }
};

// Map Urgency types
const getUrgencyMeta = (urgency?: string) => {
  switch (urgency) {
    case 'immediate':
      return { label: 'Immediate 60-90 Min Corridor', color: 'bg-brand-neon/10 text-brand-neon border-brand-neon/30' };
    case 'today':
      return { label: 'Same-Day Priority', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    case 'scheduled':
      return { label: 'Pre-Scheduled Dispatch', color: 'bg-white/10 text-brand-muted border-white/20' };
    default:
      return { label: 'Express Direct', color: 'bg-brand-neon/10 text-brand-neon border-brand-neon/30' };
  }
};

// Map exact DB JobStatus to UI step & descriptor
interface StatusConfig {
  title: string;
  badge: string;
  subtext: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  stepIndex: number; // 0 to 4
}

const getJobStatusConfig = (status: JobStatus, hasDriver: boolean): StatusConfig => {
  switch (status) {
    case 'pending':
      return {
        title: hasDriver ? 'Driver Assigned & En Route to Hub' : 'Dispatch Processing & Driver Allocation',
        badge: hasDriver ? 'Driver Assigned' : 'Awaiting Dispatch',
        subtext: hasDriver 
          ? 'Pilot has been assigned to your corridor manifest and is preparing for pickup.'
          : 'Your dispatch request has been logged. Operations control is routing the nearest available driver.',
        badgeBg: 'bg-blue-500/10 border-blue-500/30',
        badgeText: 'text-blue-400',
        dotColor: 'bg-blue-500',
        stepIndex: 0,
      };
    case 'client_pickup':
      return {
        title: 'Pilot Inbound to Pickup Location',
        badge: 'Pilot Inbound to Pickup',
        subtext: 'Pilot is en route to collect the parcel. Handover verification ready.',
        badgeBg: 'bg-amber-500/10 border-amber-500/30',
        badgeText: 'text-amber-400',
        dotColor: 'bg-amber-500',
        stepIndex: 1,
      };
    case 'driver_pickup':
      return {
        title: 'In Dedicated Transit Across Corridor',
        badge: 'In Transit',
        subtext: 'Package collected and secured. Driver is actively cruising the corridor to destination.',
        badgeBg: 'bg-brand-neon/10 border-brand-neon/30',
        badgeText: 'text-brand-neon',
        dotColor: 'bg-brand-neon',
        stepIndex: 2,
      };
    case 'driver_delivery':
      return {
        title: 'Arrived at Destination Point',
        badge: 'Out for Final Handover',
        subtext: 'Pilot has reached the destination address and is completing recipient handover.',
        badgeBg: 'bg-purple-500/10 border-purple-500/30',
        badgeText: 'text-purple-400',
        dotColor: 'bg-purple-400',
        stepIndex: 3,
      };
    case 'completed':
      return {
        title: 'Delivered & Handover Verified',
        badge: 'Delivered & Logged',
        subtext: 'Chain of Custody completed. Package has been received and verified by recipient.',
        badgeBg: 'bg-emerald-500/10 border-emerald-500/30',
        badgeText: 'text-emerald-400',
        dotColor: 'bg-emerald-400',
        stepIndex: 4,
      };
    case 'cancelled':
      return {
        title: 'Dispatch Cancelled',
        badge: 'Cancelled',
        subtext: 'This dispatch operation has been cancelled.',
        badgeBg: 'bg-red-500/10 border-red-500/30',
        badgeText: 'text-red-400',
        dotColor: 'bg-red-500',
        stepIndex: -1,
      };
    default:
      return {
        title: 'Active Corridor Manifest',
        badge: 'Active',
        subtext: 'Monitoring live dispatch telemetry.',
        badgeBg: 'bg-brand-neon/10 border-brand-neon/30',
        badgeText: 'text-brand-neon',
        dotColor: 'bg-brand-neon',
        stepIndex: 0,
      };
  }
};

export default function Track() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { trackingId: routeTrackingId } = useParams<{ trackingId?: string }>();

  // State
  const [queryInput, setQueryInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  // Active Job or Quote reference
  const activeJob = result?.type === 'job' ? result.job : undefined;
  const activeQuote = result?.type === 'quote' ? result.quote : result?.quote;

  // Realtime subscription channel ref
  const subscriptionRef = useRef<any>(null);

  // Execute tracking query
  const executeSearch = useCallback(async (idToTrack: string, isSilentRefresh = false) => {
    const cleanId = idToTrack.trim();
    if (!cleanId) return;

    if (!isSilentRefresh) {
      setIsSearching(true);
      setSearchStatus('searching');
    } else {
      setIsRefreshing(true);
    }

    try {
      const data = await getTrackingInfo(cleanId);
      if (data) {
        setResult(data);
        setSearchStatus('found');
        setLastRefreshedAt(new Date());
        
        // Keep URL in sync without full reload
        setSearchParams({ id: data.trackingId }, { replace: true });
      } else {
        setResult(null);
        setSearchStatus('not_found');
      }
    } catch (err) {
      console.error('[Nokael Track] Search error:', err);
      setResult(null);
      setSearchStatus('not_found');
    } finally {
      setIsSearching(false);
      setIsRefreshing(false);
    }
  }, [setSearchParams]);

  // Initial load check from URL or params
  useEffect(() => {
    const initialId = routeTrackingId || 
      searchParams.get('id') || 
      searchParams.get('ref') || 
      searchParams.get('tracking') || 
      searchParams.get('token') || 
      '';

    if (initialId) {
      setQueryInput(initialId);
      executeSearch(initialId);
    }
  }, [routeTrackingId, searchParams, executeSearch]);

  // Setup Supabase Realtime subscription when an active job is found
  useEffect(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
      setRealtimeConnected(false);
    }

    if (activeJob?.id) {
      const channel = subscribeToJob(activeJob.id, async () => {
        // When postgres sends update notification, refresh the full job with driver join
        try {
          const updated = await getJobById(activeJob.id!);
          if (updated) {
            setResult(prev => prev ? { ...prev, job: updated } : null);
            setLastRefreshedAt(new Date());
          }
        } catch (e) {
          console.error('[Nokael Track] Realtime sync refresh error:', e);
        }
      });

      if (channel) {
        subscriptionRef.current = channel;
        setRealtimeConnected(true);
      }
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [activeJob?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim()) return;
    executeSearch(queryInput);
  };

  const handleRefresh = () => {
    const idToRefresh = result?.trackingId || queryInput;
    if (idToRefresh) {
      executeSearch(idToRefresh, true);
    }
  };

  const handleCopyLink = () => {
    const trackingRef = result?.trackingId || queryInput;
    const url = `${window.location.origin}/track?id=${encodeURIComponent(trackingRef)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Helper to format timestamps safely
  const formatTimestamp = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return {
        time: format(d, 'hh:mm a'),
        date: format(d, 'dd MMM yyyy'),
        ago: formatDistanceToNow(d, { addSuffix: true }),
      };
    } catch {
      return null;
    }
  };

  const hasDriver = !!(activeJob?.driver || activeJob?.driver_id);
  const statusConfig = activeJob 
    ? getJobStatusConfig(activeJob.status, hasDriver)
    : null;

  // Build WhatsApp inquiry link
  const currentTrackingId = result?.trackingId || queryInput;
  const waSupportText = encodeURIComponent(
    `Hi Nokael Dispatch, I am tracking manifest ${currentTrackingId}${
      activeJob ? ` (${activeJob.pickup_emirate} ➔ ${activeJob.delivery_emirate})` : ''
    } and would like a live status update.`
  );

  return (
    <div className="bg-brand-bg min-h-[85vh] py-16 sm:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-neon/10 border border-brand-neon/20 mb-4">
            <Radio className="w-3.5 h-3.5 text-brand-neon animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-neon">
              Live Dispatch Telemetry
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-medium tracking-tighter mb-4 text-brand-text">
            Corridor Tracking
          </h1>
          <p className="text-brand-muted text-sm max-w-lg mx-auto leading-relaxed">
            Enter your Job Ref or Dispatch ID to inspect the exact database status, driver location, and Chain of Custody timestamps.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSubmit} className="mb-10" autoComplete="off">
          <div className="relative group shadow-2xl shadow-black/20">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-muted group-focus-within:text-brand-neon transition-colors" />
            <input
              id="tracking-job-ref-input"
              name="nokael_job_reference_number"
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              placeholder="Enter exact Job Ref (e.g. NOK-1024, NK-8492)"
              className="w-full bg-brand-input border border-brand-input-border rounded-2xl py-5 pl-14 pr-32 text-base sm:text-lg text-brand-text placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-neon/60 focus:ring-1 focus:ring-brand-neon/30 transition-all font-display tracking-tight"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={isSearching}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 btn-primary py-3 px-6 text-xs uppercase tracking-wider font-bold h-auto shadow-md disabled:opacity-50"
            >
              {isSearching ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Locating</span>
                </span>
              ) : (
                'Track'
              )}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 px-2 text-[11px] text-brand-muted">
            <span>Exact match required — enter your exact <b>Job Ref</b> (e.g. NOK-1024, NK-8492) or token</span>
            {lastRefreshedAt && (
              <span className="text-brand-muted/70">
                Synced {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
              </span>
            )}
          </div>
        </form>

        {/* Dynamic Tracking Display */}
        <AnimatePresence mode="wait">
          
          {/* 1. Searching State */}
          {searchStatus === 'searching' && (
            <motion.div
              key="searching"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="dispatch-card text-center py-20 border border-brand-border bg-brand-surface/40"
            >
              <div className="relative w-16 h-16 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full bg-brand-neon/10 animate-ping" />
                <div className="relative w-16 h-16 rounded-full bg-brand-surface border border-brand-neon/40 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-brand-neon animate-spin" />
                </div>
              </div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-brand-text mb-2">
                Querying Live Dispatch System...
              </p>
              <p className="text-xs text-brand-muted max-w-sm mx-auto">
                Retrieving corridor coordinates, driver status, and Chain of Custody records for ID <b>{queryInput}</b>.
              </p>
            </motion.div>
          )}

          {/* 2. Not Found State */}
          {searchStatus === 'not_found' && (
            <motion.div
              key="not_found"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="dispatch-card border-red-500/20 text-center py-14 bg-red-500/[0.02]"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-red-500/20">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-display font-medium mb-2 text-brand-text">
                Dispatch Record Not Found
              </h3>
              <p className="text-brand-muted text-sm mb-6 max-w-md mx-auto leading-relaxed">
                We could not locate an active job or quote matching <b>"{queryInput}"</b>. Please double-check your tracking ID or contact central dispatch for direct assistance.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <a 
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waSupportText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackWhatsAppClick('track_not_found')}
                  className="btn-primary py-3 px-6 text-xs uppercase tracking-wider font-bold"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Verify with Dispatch Desk</span>
                </a>
              </div>
            </motion.div>
          )}

          {/* 3. Found Job Result (Exact DB State) */}
          {searchStatus === 'found' && activeJob && statusConfig && (
            <motion.div
              key={`job-${activeJob.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              {/* Primary Status Card */}
              <div className="dispatch-card relative overflow-hidden border border-brand-border bg-brand-surface/70 shadow-2xl">
                
                {/* Top Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-brand-border/60">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-input border border-brand-input-border flex items-center justify-center text-brand-neon">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">
                          Dispatch Reference
                        </span>
                        {realtimeConnected && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-bold border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Live Sync
                          </span>
                        )}
                      </div>
                      <p className="text-2xl font-display font-medium tracking-tight text-brand-text">
                        {activeJob.job_ref || result.trackingId}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="p-2.5 rounded-xl bg-brand-input border border-brand-input-border text-brand-muted hover:text-brand-text hover:border-brand-border transition-all disabled:opacity-50"
                      title="Refresh State"
                    >
                      <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin text-brand-neon")} />
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-input border border-brand-input-border text-xs font-semibold text-brand-text hover:border-brand-neon/40 transition-all"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-brand-muted" />}
                      <span>{copiedLink ? 'Copied' : 'Share Link'}</span>
                    </button>
                  </div>
                </div>

                {/* Status Hero Banner */}
                <div className="p-5 sm:p-6 rounded-2xl bg-brand-input/50 border border-brand-input-border mb-8">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className={cn("w-3 h-3 rounded-full", statusConfig.dotColor, "animate-pulse shadow-[0_0_10px_currentColor]")} />
                      <h2 className="text-xl sm:text-2xl font-display font-medium tracking-tight text-brand-text">
                        {statusConfig.title}
                      </h2>
                    </div>
                    <span className={cn("px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border", statusConfig.badgeBg, statusConfig.badgeText)}>
                      {statusConfig.badge}
                    </span>
                  </div>
                  <p className="text-sm text-brand-muted leading-relaxed">
                    {statusConfig.subtext}
                  </p>

                  {/* Cancellation Reason if cancelled */}
                  {activeJob.status === 'cancelled' && activeJob.cancellation_reason && (
                    <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                      <b>Cancellation Reason:</b> {activeJob.cancellation_reason}
                    </div>
                  )}
                </div>

                {/* 5-Step Exact Database Lifecycle Milestones */}
                <div className="space-y-6 mb-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-brand-muted">
                      Chain of Custody Milestones
                    </h3>
                    {activeJob.status === 'cancelled' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/30">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        Execution Interrupted
                      </span>
                    )}
                  </div>

                  <div className="relative pl-6 sm:pl-8 border-l-2 border-brand-input-border space-y-8 ml-2 sm:ml-4">
                    {(() => {
                      const ts1 = formatTimestamp(activeJob.created_at);
                      const ts2 = formatTimestamp(
                        activeJob.client_pickup_at || 
                        activeJob.client_pickup_confirmed_at || 
                        activeJob.driver_arrived_pickup_at || 
                        activeJob.sender_ready_at
                      );
                      const ts3 = formatTimestamp(activeJob.driver_pickup_at || activeJob.driver_pickup_confirmed_at);
                      const ts4 = formatTimestamp(activeJob.driver_delivery_at || activeJob.driver_arrived_delivery_at || activeJob.driver_delivery_confirmed_at);
                      const ts5 = formatTimestamp(activeJob.client_delivery_at || activeJob.client_delivery_confirmed_at);
                      const tsCancel = formatTimestamp(activeJob.cancelled_at || (activeJob.status === 'cancelled' ? activeJob.updated_at : null));

                      const isCancelled = activeJob.status === 'cancelled';

                      const step1Done = true;
                      const step2Done = Boolean(ts2) || ['client_pickup', 'driver_pickup', 'driver_delivery', 'completed'].includes(activeJob.status) || Boolean(ts3) || Boolean(ts4) || Boolean(ts5);
                      const step3Done = Boolean(ts3) || ['driver_pickup', 'driver_delivery', 'completed'].includes(activeJob.status) || Boolean(ts4) || Boolean(ts5);
                      const step4Done = Boolean(ts4) || ['driver_delivery', 'completed'].includes(activeJob.status) || Boolean(ts5);
                      const step5Done = Boolean(ts5) || activeJob.status === 'completed';

                      // Find where failure occurred (last completed milestone index)
                      let lastCompletedStep = 1;
                      if (step4Done) lastCompletedStep = 4;
                      else if (step3Done) lastCompletedStep = 3;
                      else if (step2Done) lastCompletedStep = 2;
                      else lastCompletedStep = 1;

                      const renderCancellationNode = () => (
                        <div className="relative p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300">
                          <div className="absolute -left-[31px] sm:-left-[39px] top-4 w-4 h-4 rounded-full border-4 border-brand-bg bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.9)] flex items-center justify-center" />
                          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                              <p className="text-xs font-black uppercase tracking-wider text-red-400">
                                Mission Interrupted / Dispatch Cancelled
                              </p>
                            </div>
                            {tsCancel && (
                              <span className="text-[11px] text-red-400/80 font-mono font-bold">
                                {tsCancel.time} · {tsCancel.date}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-red-300/90 leading-relaxed font-medium">
                            {activeJob.cancellation_reason ? (
                              <span><b>Reason:</b> {activeJob.cancellation_reason}</span>
                            ) : (
                              'Dispatch operations terminated before final handover completion.'
                            )}
                          </p>
                        </div>
                      );

                      return (
                        <>
                          {/* Step 1: Corridor Manifest Booked */}
                          <div className="relative">
                            <div className={cn(
                              "absolute -left-[31px] sm:-left-[39px] top-0 w-4 h-4 rounded-full border-4 border-brand-bg transition-all flex items-center justify-center",
                              !isCancelled && statusConfig.stepIndex === 0 ? "bg-brand-neon shadow-[0_0_12px_rgba(57,255,20,0.8)]" : "bg-brand-neon shadow-[0_0_8px_rgba(57,255,20,0.4)]"
                            )} />
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="text-xs font-bold uppercase tracking-wider text-brand-text flex items-center gap-1.5">
                                <span>1. Corridor Manifest Booked</span>
                                <Check className="w-3 h-3 text-brand-neon" />
                              </p>
                              {ts1 && <span className="text-[11px] text-brand-muted font-mono">{ts1.time} · {ts1.date}</span>}
                            </div>
                            <p className="text-xs text-brand-muted mt-0.5">
                              Logged into dispatch queue. Origin: <b>{activeJob.pickup_emirate}</b>
                            </p>
                          </div>

                          {/* If cancelled right after Step 1 */}
                          {isCancelled && lastCompletedStep === 1 && renderCancellationNode()}

                          {/* Step 2: Pilot Arrival & Sender Handover */}
                          <div className={cn("relative", isCancelled && !step2Done && "opacity-40")}>
                            <div className={cn(
                              "absolute -left-[31px] sm:-left-[39px] top-0 w-4 h-4 rounded-full border-4 border-brand-bg transition-all",
                              step2Done ? "bg-brand-neon shadow-[0_0_8px_rgba(57,255,20,0.4)]" :
                              !isCancelled && statusConfig.stepIndex === 1 ? "bg-brand-neon shadow-[0_0_12px_rgba(57,255,20,0.8)]" :
                              "bg-brand-input-border"
                            )} />
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="text-xs font-bold uppercase tracking-wider text-brand-text flex items-center gap-1.5">
                                <span>2. Pilot Arrival & Sender Handover</span>
                                {step2Done && <Check className="w-3 h-3 text-brand-neon" />}
                                {isCancelled && !step2Done && (
                                  <span className="text-[9px] px-1.5 py-0.2 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-mono">Aborted</span>
                                )}
                              </p>
                              {ts2 && <span className="text-[11px] text-brand-muted font-mono">{ts2.time} · {ts2.date}</span>}
                            </div>
                            <p className="text-xs text-brand-muted mt-0.5">
                              {hasDriver 
                                ? `Assigned Pilot (${activeJob.driver?.full_name || 'Pilot'}) arriving at pickup point.`
                                : 'Awaiting pilot dispatch arrival confirmation.'}
                            </p>
                          </div>

                          {/* If cancelled right after Step 2 */}
                          {isCancelled && lastCompletedStep === 2 && renderCancellationNode()}

                          {/* Step 3: Picked Up & In Dedicated Transit */}
                          <div className={cn("relative", isCancelled && !step3Done && "opacity-40")}>
                            <div className={cn(
                              "absolute -left-[31px] sm:-left-[39px] top-0 w-4 h-4 rounded-full border-4 border-brand-bg transition-all",
                              step3Done ? "bg-brand-neon shadow-[0_0_8px_rgba(57,255,20,0.4)]" :
                              !isCancelled && statusConfig.stepIndex === 2 ? "bg-brand-neon shadow-[0_0_12px_rgba(57,255,20,0.8)]" :
                              "bg-brand-input-border"
                            )} />
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="text-xs font-bold uppercase tracking-wider text-brand-text flex items-center gap-1.5">
                                <span>3. Picked Up & In Dedicated Transit</span>
                                {step3Done && <Check className="w-3 h-3 text-brand-neon" />}
                                {isCancelled && !step3Done && (
                                  <span className="text-[9px] px-1.5 py-0.2 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-mono">Aborted</span>
                                )}
                              </p>
                              {ts3 && <span className="text-[11px] text-brand-muted font-mono">{ts3.time} · {ts3.date}</span>}
                            </div>
                            <p className="text-xs text-brand-muted mt-0.5">
                              Parcel secured. Direct non-stop transit between <b>{activeJob.pickup_emirate}</b> and <b>{activeJob.delivery_emirate}</b>.
                            </p>
                          </div>

                          {/* If cancelled right after Step 3 */}
                          {isCancelled && lastCompletedStep === 3 && renderCancellationNode()}

                          {/* Step 4: Destination Arrival */}
                          <div className={cn("relative", isCancelled && !step4Done && "opacity-40")}>
                            <div className={cn(
                              "absolute -left-[31px] sm:-left-[39px] top-0 w-4 h-4 rounded-full border-4 border-brand-bg transition-all",
                              step4Done ? "bg-brand-neon shadow-[0_0_8px_rgba(57,255,20,0.4)]" :
                              !isCancelled && statusConfig.stepIndex === 3 ? "bg-brand-neon shadow-[0_0_12px_rgba(57,255,20,0.8)]" :
                              "bg-brand-input-border"
                            )} />
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="text-xs font-bold uppercase tracking-wider text-brand-text flex items-center gap-1.5">
                                <span>4. Destination Arrival</span>
                                {step4Done && <Check className="w-3 h-3 text-brand-neon" />}
                                {isCancelled && !step4Done && (
                                  <span className="text-[9px] px-1.5 py-0.2 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-mono">Aborted</span>
                                )}
                              </p>
                              {ts4 && <span className="text-[11px] text-brand-muted font-mono">{ts4.time} · {ts4.date}</span>}
                            </div>
                            <p className="text-xs text-brand-muted mt-0.5">
                              Pilot at {activeJob.delivery_location}, {activeJob.delivery_emirate}. Initiating recipient verification.
                            </p>
                          </div>

                          {/* If cancelled right after Step 4 */}
                          {isCancelled && lastCompletedStep === 4 && renderCancellationNode()}

                          {/* Step 5: Final Delivery Handover */}
                          <div className={cn("relative", isCancelled && !step5Done && "opacity-40")}>
                            <div className={cn(
                              "absolute -left-[31px] sm:-left-[39px] top-0 w-4 h-4 rounded-full border-4 border-brand-bg transition-all",
                              step5Done ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" :
                              !isCancelled && statusConfig.stepIndex === 4 ? "bg-brand-neon shadow-[0_0_12px_rgba(57,255,20,0.8)]" :
                              "bg-brand-input-border"
                            )} />
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="text-xs font-bold uppercase tracking-wider text-brand-text flex items-center gap-1.5">
                                <span>5. Delivered & Handover Confirmed</span>
                                {step5Done && <Check className="w-3 h-3 text-emerald-400" />}
                                {isCancelled && !step5Done && (
                                  <span className="text-[9px] px-1.5 py-0.2 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-mono">Unfulfilled</span>
                                )}
                              </p>
                              {ts5 && <span className="text-[11px] text-emerald-400 font-mono font-bold">{ts5.time} · {ts5.date}</span>}
                            </div>
                            <p className="text-xs text-brand-muted mt-0.5">
                              {step5Done 
                                ? 'Final receipt validated. Complete Chain of Custody digitally signed.' 
                                : isCancelled 
                                ? 'Delivery handover was not completed due to cancellation.' 
                                : 'Final receipt validated. Complete Chain of Custody digitally signed.'}
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Live GPS Telemetry Card if available */}
                {activeJob.driver_lat && activeJob.driver_lng && (
                  <div className="p-4 rounded-xl bg-brand-input/40 border border-brand-input-border flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-neon/10 text-brand-neon flex items-center justify-center">
                        <Navigation className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-brand-text">Pilot GPS Coordinates Active</p>
                        <p className="text-[10px] text-brand-muted font-mono">
                          {activeJob.driver_lat.toFixed(4)}° N, {activeJob.driver_lng.toFixed(4)}° E
                          {activeJob.driver_updated_at && ` · Last ping ${formatDistanceToNow(new Date(activeJob.driver_updated_at), { addSuffix: true })}`}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`https://maps.google.com/?q=${activeJob.driver_lat},${activeJob.driver_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold uppercase tracking-wider text-brand-neon hover:underline inline-flex items-center gap-1"
                    >
                      <span>View Map</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

              </div>

              {/* Route & Manifest Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Route Box */}
                <div className="dispatch-card border border-brand-border bg-brand-surface/60 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-muted">
                    Route Specification
                  </p>
                  
                  <div className="space-y-4 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-widest font-black text-brand-muted block">Pickup ({activeJob.pickup_emirate})</span>
                        <p className="font-semibold text-brand-text">{activeJob.pickup_location}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-brand-neon/10 text-brand-neon flex items-center justify-center shrink-0 mt-0.5">
                        <Navigation className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-widest font-black text-brand-muted block">Delivery ({activeJob.delivery_emirate})</span>
                        <p className="font-semibold text-brand-text">{activeJob.delivery_location}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-brand-border/60 flex flex-wrap gap-2">
                    {activeJob.company_name && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-input text-[10px] font-bold text-brand-muted border border-brand-input-border">
                        <Building2 className="w-3 h-3 text-brand-neon" />
                        {activeJob.company_name}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-input text-[10px] font-bold text-brand-muted border border-brand-input-border">
                      <Clock className="w-3 h-3" />
                      {getUrgencyMeta(activeJob.urgency).label}
                    </span>
                  </div>
                </div>

                {/* Pilot & Handover Info */}
                <div className="dispatch-card border border-brand-border bg-brand-surface/60 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-muted">
                    Assigned Pilot & Custody
                  </p>

                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-input border border-brand-input-border flex items-center justify-center text-brand-neon">
                      {hasDriver ? <Truck className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="text-base font-display font-medium text-brand-text">
                        {activeJob.driver?.full_name || 'Nokael Central Operations'}
                      </p>
                      <p className="text-[11px] text-brand-muted">
                        {activeJob.driver?.vehicle_type ? `${activeJob.driver.vehicle_type} · Dedicated Fleet` : '24/7 Monitoring Desk'}
                      </p>
                      {activeJob.driver?.rating && (
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-400 font-bold">
                          <span>★</span>
                          <span>{activeJob.driver.rating.toFixed(1)} Rating</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Item Description */}
                  {(() => {
                    const itemMeta = getItemMeta(activeJob.item_type);
                    const ItemIcon = itemMeta.icon;
                    return (
                      <div className="pt-3 border-t border-brand-border/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <ItemIcon className={cn("w-4 h-4", itemMeta.color)} />
                          <span className="font-medium text-brand-text">{itemMeta.label}</span>
                        </div>
                        <span className="text-[10px] text-brand-muted uppercase tracking-wider font-bold">
                          Insured Transit
                        </span>
                      </div>
                    );
                  })()}

                  {/* Actions / Support */}
                  <div className="pt-2">
                    <a
                      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waSupportText}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackWhatsAppClick('track_support_click', {
                        phone_number: activeJob.sender_phone,
                        first_name: activeJob.sender_name
                      })}
                      className="btn-primary w-full py-3 text-xs uppercase tracking-wider font-bold"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Chat with Live Dispatch Desk</span>
                    </a>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* 4. Found Quote Request (Pending Conversion) */}
          {searchStatus === 'found' && activeQuote && !activeJob && (
            <motion.div
              key={`quote-${activeQuote.id || activeQuote.tracking_id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              <div className="dispatch-card border border-brand-border bg-brand-surface/70 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-brand-border/60">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted block">
                      Quote Manifest ID
                    </span>
                    <p className="text-2xl font-display font-medium tracking-tight text-brand-text">
                      {activeQuote.tracking_id}
                    </p>
                  </div>
                  <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    Dispatch Pending Allocation
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-brand-input/50 border border-brand-input-border mb-6">
                  <h3 className="text-base font-display font-medium text-brand-text mb-1">
                    Manifest Under Dispatch Review
                  </h3>
                  <p className="text-xs text-brand-muted leading-relaxed">
                    Your quote request has been registered. Our operations control team is coordinating the nearest available driver on the <b>{activeQuote.emirate}</b> corridor.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-6">
                  <div className="p-4 rounded-xl bg-brand-input/30 border border-brand-input-border">
                    <span className="text-[9px] uppercase tracking-widest font-black text-brand-muted block mb-1">Pickup</span>
                    <p className="font-semibold text-brand-text">{activeQuote.pickup_location}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-brand-input/30 border border-brand-input-border">
                    <span className="text-[9px] uppercase tracking-widest font-black text-brand-muted block mb-1">Delivery</span>
                    <p className="font-semibold text-brand-text">{activeQuote.delivery_location}</p>
                  </div>
                </div>

                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi Nokael, I am following up on quote manifest ${activeQuote.tracking_id} for ${activeQuote.item_type} from ${activeQuote.pickup_location} to ${activeQuote.delivery_location}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackWhatsAppClick('track_quote_followup')}
                  className="btn-primary w-full py-3.5 text-xs uppercase tracking-wider font-bold"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Fast-Track with Operations on WhatsApp</span>
                </a>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

      </div>
    </div>
  );
}
