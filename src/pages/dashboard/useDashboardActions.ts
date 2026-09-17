import type { Dispatch, SetStateAction } from 'react';
import {
  updateQuoteStatus,
  deleteQuoteRequest,
  markQuoteAsLost,
  reopenQuoteRequest,
  getDriverWithDocuments,
  updateDriverStatus,
  updateBusinessInquiry,
  type QuoteRequest,
  type Driver,
  type DriverDocument,
  type BusinessInquiry
} from '../../lib/supabase';

interface UseDashboardActionsArgs {
  setRequests: Dispatch<SetStateAction<QuoteRequest[]>>;
  setDrivers: Dispatch<SetStateAction<Driver[]>>;
  setBusinessInquiries: Dispatch<SetStateAction<BusinessInquiry[]>>;
  selectedDriver: (Driver & { documents: DriverDocument[] }) | null;
  setSelectedDriver: Dispatch<SetStateAction<(Driver & { documents: DriverDocument[] }) | null>>;
  selectedBusiness: BusinessInquiry | null;
  setSelectedBusiness: Dispatch<SetStateAction<BusinessInquiry | null>>;
  lostModalQuote: QuoteRequest | null;
  setLostModalQuote: Dispatch<SetStateAction<QuoteRequest | null>>;
}

/**
 * CRUD action handlers for the dashboard. These mutate server data
 * (via the setters passed in from useDashboardData) and, where relevant,
 * keep whatever's currently selected in the UI in sync with the change.
 */
export function useDashboardActions({
  setRequests,
  setDrivers,
  setBusinessInquiries,
  selectedDriver,
  setSelectedDriver,
  selectedBusiness,
  setSelectedBusiness,
  lostModalQuote,
  setLostModalQuote
}: UseDashboardActionsArgs) {
  const handleStatusUpdate = async (id: string, status: QuoteRequest['status']) => {
    try {
      await updateQuoteStatus(id, status);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleConfirmMarkLost = async (reason: string) => {
    if (!lostModalQuote?.id) return;
    try {
      await markQuoteAsLost(lostModalQuote.id, reason);
      setRequests(prev => prev.map(r => r.id === lostModalQuote.id ? { ...r, status: 'lost', lost_reason: reason, lost_at: new Date().toISOString() } : r));
      setLostModalQuote(null);
    } catch (error: any) {
      alert(`Failed to mark quote as lost: ${error.message || error}`);
    }
  };

  const handleReopenQuote = async (id: string) => {
    try {
      await reopenQuoteRequest(id);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'pending', lost_reason: null, lost_at: null } : r));
    } catch (error: any) {
      alert(`Failed to reopen quote: ${error.message || error}`);
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

  return {
    handleStatusUpdate,
    handleConfirmMarkLost,
    handleReopenQuote,
    handleDriverStatusUpdate,
    handleBusinessUpdate,
    handleViewDriver,
    handleDelete
  };
}
