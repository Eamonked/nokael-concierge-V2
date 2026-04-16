import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramNotification, formatQuoteNotification, formatBusinessNotification } from './notifications';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return supabaseInstance;
};

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
  status?: 'pending' | 'contacted' | 'completed';
  // New Fields
  customer_type?: 'business' | 'personal';
  company_name?: string;
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
  const supabase = getSupabase();
  const { error } = await supabase
    .from('quote_requests')
    .insert([data]);
  
  if (error) throw error;

  // Send Telegram Notification
  await sendTelegramNotification(formatQuoteNotification(data));
};

export const getQuoteRequests = async () => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('quote_requests')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as QuoteRequest[];
};

export const updateQuoteStatus = async (id: string, status: QuoteRequest['status']) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('quote_requests')
    .update({ status })
    .eq('id', id)
    .select();
  
  if (error) throw error;

  // Notify of status update
  if (data && data.length > 0) {
    const dashboardUrl = `${window.location.origin}/login`;
    const message = `
🔄 <b>Quote Status Updated</b>

<b>Customer:</b> ${data[0].name}
<b>New Status:</b> ${status}

<a href="${dashboardUrl}">Open Dashboard</a>
    `.trim();
    await sendTelegramNotification(message);
  }

  return data;
};

export const deleteQuoteRequest = async (id: string) => {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('quote_requests')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

export interface BusinessInquiry {
  id?: string;
  created_at?: string;
  company_name: string;
  contact_person: string;
  phone_whatsapp: string;
  email: string;
  typical_routes?: string;
  item_types?: string;
  estimated_monthly_volume?: string;
  urgent_express_dedicated_needs?: string;
  invoicing_required?: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
}

export const submitBusinessInquiry = async (data: BusinessInquiry) => {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('business_inquiries')
    .insert([data]);
  
  if (error) throw error;

  // Send Telegram Notification
  await sendTelegramNotification(formatBusinessNotification(data));
};

export const getBusinessInquiries = async () => {
  const supabase = getSupabase();
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
  const supabase = getSupabase();
  const { data: driver, error } = await supabase
    .from('drivers')
    .insert([data])
    .select()
    .single();
  
  if (error) throw error;

  // Send Telegram Notification
  const dashboardUrl = `${window.location.origin}/login`;
  const message = `
🚛 <b>New Driver Application</b>

<b>Name:</b> ${data.full_name}
<b>Location:</b> ${data.base_location}
<b>Vehicle:</b> ${data.vehicle_type}
<b>Phone:</b> ${data.phone}

<a href="${dashboardUrl}">Review Application</a>
  `.trim();
  await sendTelegramNotification(message);

  return driver as Driver;
};

export const uploadDriverDocument = async (data: DriverDocument) => {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('driver_documents')
    .insert([data]);
  
  if (error) throw error;
};

export const getDrivers = async () => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Driver[];
};

export const getDriverWithDocuments = async (id: string) => {
  const supabase = getSupabase();
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
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('drivers')
    .update(updates)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data;
};
