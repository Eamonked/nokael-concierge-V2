import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  supabase,
  getQuoteRequests,
  getDrivers,
  getBusinessInquiries,
  getJobs,
  subscribeToJobs,
  getSafeSession,
  getDriverPresence,
  type DriverPresence,
  clearStaleAuthSession,
  type QuoteRequest,
  type Driver,
  type BusinessInquiry,
  type JobWithDriver
} from '../../lib/supabase';
import { getCurrentUserOrg, type OrgRole } from '../../lib/team';

/**
 * Owns the dashboard's server-backed state: auth/session check, org context,
 * the four core collections (jobs, requests, drivers, businessInquiries),
 * and the realtime job subscription. Returns the data plus a refetch().
 *
 * View-selection state (activeTab, searchTerm, filters, selectedJob, etc.)
 * stays in Dashboard.tsx — this hook only knows about server data.
 */
export function useDashboardData() {
  const navigate = useNavigate();

  const [orgId, setOrgId] = React.useState<string | null>(null);
  const [currentRole, setCurrentRole] = React.useState<OrgRole | null>(null);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [jobs, setJobs] = React.useState<JobWithDriver[]>([]);
  const [requests, setRequests] = React.useState<QuoteRequest[]>([]);
  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [businessInquiries, setBusinessInquiries] = React.useState<BusinessInquiry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  // Background refreshes (sync button, after edits) keep the page on screen;
  // only the very first load shows the full-screen loader.
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<Date | null>(null);
  const [driverPresence, setDriverPresence] = React.useState<Record<string, DriverPresence>>({});
  const hasLoadedRef = React.useRef(false);

  const fetchData = React.useCallback(async () => {
    if (hasLoadedRef.current) setRefreshing(true);
    else setLoading(true);
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
      setLastSyncedAt(new Date());
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to fetch data.');
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
          setUserEmail(session.user?.email ?? null);
          fetchData();
          getCurrentUserOrg().then(async (org) => {
            if (!isMounted) return;
            if (!org) {
              // Signed in, but no longer (or never) on the team: don't leave
              // them on an empty dashboard.
              await supabase?.auth.signOut();
              navigate('/login?reason=no_access');
              return;
            }
            setOrgId(org.orgId);
            setCurrentRole(org.role);
          }).catch((err) => console.warn('[Dashboard] Could not load team membership:', err));
        }
      })
      .catch((err) => {
        console.warn('[Dashboard] Auth validation error:', err);
        clearStaleAuthSession().finally(() => {
          if (isMounted) navigate('/login');
        });
      });

    // Subscribe to job changes
    const subscription = subscribeToJobs(() => {
      getJobs().then(jobsData => {
        if (!isMounted) return;
        setJobs(jobsData);
      }).catch(console.error);
    });

    return () => {
      isMounted = false;
      if (subscription && supabase) supabase.removeChannel(subscription);
    };
  }, [navigate, fetchData]);

  const fetchPresence = React.useCallback(async () => {
    if (!orgId) return;
    try {
      setDriverPresence(await getDriverPresence(orgId));
    } catch (err) {
      console.warn('[Dashboard] Could not load driver presence:', err);
    }
  }, [orgId]);

  // Presence changes without any row event the dashboard can subscribe to
  // (drivers' GPS table is not exposed), so poll it while the tab is visible.
  React.useEffect(() => {
    if (!orgId) return;
    fetchPresence();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') fetchPresence();
    }, 30_000);
    const onVisible = () => { if (document.visibilityState === 'visible') fetchPresence(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [orgId, fetchPresence]);

  /** The Sync button: everything, including live driver presence. */
  const syncAll = React.useCallback(async () => {
    await Promise.all([fetchData(), fetchPresence()]);
  }, [fetchData, fetchPresence]);

  return {
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
    setJobs,
    refetch: fetchData,
    driverPresence,
    refreshing,
    lastSyncedAt,
    syncAll,
  };
}
