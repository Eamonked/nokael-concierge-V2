import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { 
  sendTelegramNotification, 
  formatQuoteNotification, 
  formatBusinessNotification,
  formatDriverNotification,
  formatStatusUpdateNotification
} from './notifications';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Nokael] Missing Supabase configuration. DB operations will be skipped. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
}

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export interface QuoteRequest {
  id?: string;
  created_at?: string;
  pickup_location: string;
  delivery_location: string;
  emirate: string;
  item_type: 'document' | 'parcel' | 'spare_part' | 'other';
  urgency: 'immediate' | 'today' | 'scheduled';
  name: string;
  phone: string;
  whatsapp_opt_in: boolean;
  status?: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'completed' | 'contacted';
  tracking_id?: string;
  assigned_driver_id?: string;
  // Join data
  assigned_driver?: Partial<Driver>;
  // New Fields
  customer_type?: 'business' | 'personal';
  company_name?: string;
  corporate_code?: string;
  repeat_business?: boolean;
  // UTM Attribution Fields
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
}

export const submitQuoteRequest = async (data: QuoteRequest) => {
  // Generate a human-readable tracking ID (e.g. NK-4921)
  const tracking_id = `NK-${Math.floor(1000 + Math.random() * 9000)}`;
  const payload = { ...data, tracking_id };

  if (supabase) {
    const { error } = await supabase
      .from('quote_requests')
      .insert([payload]);
    
    if (error) throw error;
  } else {
    console.warn('[Nokael] Supabase not configured — skipping DB insert.');
  }

  // Send Telegram Notification (still works via server-side API)
  await sendTelegramNotification(formatQuoteNotification(payload));
};

export const getQuoteRequests = async () => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('quote_requests')
    .select('*, assigned_driver:drivers(*)')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as QuoteRequest[];
};

export const assignDriverToJob = async (jobId: string, driverId: string | null) => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('quote_requests')
    .update({ 
      assigned_driver_id: driverId,
      status: driverId ? 'assigned' : 'pending'
    })
    .eq('id', jobId)
    .select();
  
  if (error) throw error;
  return data;
};

export const updateQuoteStatus = async (id: string, status: QuoteRequest['status']) => {
  let data: any[] | null = null;
  if (supabase) {
    const { data: updateData, error } = await supabase
      .from('quote_requests')
      .update({ status })
      .eq('id', id)
      .select();
    
    if (error) throw error;
    data = updateData;
  }

  // Notify of status update
  if (data && data.length > 0) {
    await sendTelegramNotification(formatStatusUpdateNotification(data[0].name, status || 'pending'));
  }

  return data;
};

export const deleteQuoteRequest = async (id: string) => {
  if (!supabase) return;
  const { error } = await supabase
    .from('quote_requests')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

export const getQuoteByTrackingId = async (trackingId: string) => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('quote_requests')
    .select('*')
    .eq('tracking_id', trackingId.toUpperCase())
    .single();
  
  if (error) return null;
  return data as QuoteRequest;
};

export interface BusinessInquiry {
  id?: string;
  created_at?: string;
  company_name: string;
  contact_person: string;
  phone_whatsapp: string;
  email: string;
  corporate_code?: string;
  typical_routes?: string;
  item_types?: string;
  estimated_monthly_volume?: string;
  urgent_express_dedicated_needs?: string;
  invoicing_required?: boolean;
  status?: 'pending' | 'active' | 'archived';
  follow_up_notes?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
}

export const submitBusinessInquiry = async (data: BusinessInquiry) => {
  // Generate a unique Business ID (e.g. NOK-9241)
  const corporate_code = `NOK-${Math.floor(1000 + Math.random() * 9000)}`;
  const payload = { ...data, corporate_code, status: 'pending' };

  if (supabase) {
    const { error } = await supabase
      .from('business_inquiries')
      .insert([payload]);
    
    if (error) throw error;
  }

  // Send Telegram Notification
  await sendTelegramNotification(formatBusinessNotification(payload));
  
  return payload;
};

export const updateBusinessInquiry = async (id: string, updates: Partial<BusinessInquiry>) => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('business_inquiries')
    .update(updates)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data;
};

export const getBusinessInquiries = async () => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('business_inquiries')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as BusinessInquiry[];
};

// ==========================================
// Driver Onboarding
// ==========================================

export interface Driver {
  id?: string;
  created_at?: string;
  full_name: string;
  phone: string;
  whatsapp: string;
  email: string;
  base_location: string;
  vehicle_type: string;
  inter_emirate_yes_no: boolean;
  availability_hours: string;
  onboarding_status?: 'pending' | 'approved' | 'rejected';
  tier?: 'A' | 'B' | 'C' | 'D';
  reliability_score?: number;
  internal_notes?: string;
  last_active_at?: string;
}

export interface DriverDocument {
  id?: string;
  driver_id: string;
  document_type: 'emirates_id' | 'license' | 'registration' | 'vehicle_photo';
  file_url: string;
  drive_file_id: string;
  verification_status?: 'pending' | 'verified' | 'rejected';
  expiry_date?: string;
  uploaded_at?: string;
}

export const submitDriverApplication = async (data: Driver) => {
  // Generate ID client-side
  const id = crypto.randomUUID();
  const payload = { ...data, id };

  if (supabase) {
    const { error } = await supabase
      .from('drivers')
      .insert([payload]);

    if (error) throw error;
  }

  // Send Telegram Notification
  await sendTelegramNotification(formatDriverNotification(data));

  return payload as Driver;
};

export const uploadDriverDocument = async (data: DriverDocument) => {
  if (!supabase) return;
  const { error } = await supabase
    .from('driver_documents')
    .insert([data]);
  
  if (error) throw error;
};

export const getDrivers = async () => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Driver[];
};

export const getDriverWithDocuments = async (id: string) => {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', id)
    .single();
  
  if (driverError) throw driverError;

  const { data: documents, error: docsError } = await supabase
    .from('driver_documents')
    .select('*')
    .eq('driver_id', id);
  
  if (docsError) throw docsError;

  return {
    ...driver,
    documents: documents as DriverDocument[]
  };
};

export const updateDriverStatus = async (id: string, updates: Partial<Driver>) => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('drivers')
    .update(updates)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data;
};
