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

  const fetchData = React.useCallback(async () => {
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
    refetch: fetchData
  };
}
