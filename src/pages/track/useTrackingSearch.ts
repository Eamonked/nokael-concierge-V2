import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import {
  getTrackingInfo,
  getJobById,
  subscribeToJob,
  type TrackingResult,
} from '../../lib/supabase';

export function useTrackingSearch() {
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

  const handleSubmit = (e: FormEvent) => {
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

  return {
    queryInput,
    setQueryInput,
    isSearching,
    isRefreshing,
    searchStatus,
    result,
    activeJob,
    activeQuote,
    lastRefreshedAt,
    copiedLink,
    realtimeConnected,
    handleSubmit,
    handleRefresh,
    handleCopyLink,
  };
}
