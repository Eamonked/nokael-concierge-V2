import { createClient } from '@supabase/supabase-js';
import {
  sendTelegramNotification,
  formatQuoteNotification,
  formatBusinessNotification,
  formatDriverNotification,
  formatStatusUpdateNotification,
} from './notifications';

// ==========================================
// Supabase Client
// ==========================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl !== 'undefined' &&
  supabaseKey !== 'undefined'
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

// ==========================================
// Shared Types & Enums
// ==========================================

export type JobStatus =
  | 'pending'
  | 'client_pickup'
  | 'driver_pickup'
  | 'driver_delivery'
  | 'completed'
  | 'cancelled';

export type ItemType = 'document' | 'parcel' | 'spare_part' | 'other';
export type UrgencyType = 'immediate' | 'today' | 'scheduled';
export type ServiceTier = 'express' | 'priority' | 'standard';

export type DriverStatus = 'offline' | 'available' | 'on_job';
export type DriverAvailability = 'full-time' | 'part-time' | 'on-call';
export type DriverTier = 'A' | 'B' | 'C' | 'D';
export type OnboardingStatus = 'pending' | 'approved' | 'rejected';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

// ==========================================
// Quote Requests
// ==========================================

export interface QuoteRequest {
  id?: string;
  created_at?: string;
  pickup_location: string;
  delivery_location: string;
  emirate: string;
  item_type: ItemType;
  urgency: UrgencyType;
  name: string;
  phone: string;
  whatsapp_opt_in: boolean;
  // DB CHECK: only these 3 statuses are valid
  status?: 'pending' | 'contacted' | 'completed';
  tracking_id?: string;
  customer_type?: 'business' | 'personal';
  company_name?: string;
  corporate_code?: string;
  repeat_business?: boolean;
  // UTM Attribution
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
}

export const submitQuoteRequest = async (data: QuoteRequest): Promise<QuoteRequest> => {
  const tracking_id = `NK-${Math.floor(1000 + Math.random() * 9000)}`;
  const payload: QuoteRequest = { ...data, tracking_id };

  if (supabase) {
    const { error } = await supabase.from('quote_requests').insert([payload]);
    if (error) {
      // Log but don't throw — user can still be redirected to WhatsApp
      console.error('[Nokael] Quote insert error:', error);
    }
  } else {
    console.warn('[Nokael] Supabase not configured — skipping DB insert.');
  }

  try {
    await sendTelegramNotification(formatQuoteNotification(payload));
  } catch (err) {
    console.error('[Nokael] Notification error:', err);
  }

  return payload;
};

export const getQuoteRequests = async (): Promise<QuoteRequest[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('quote_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as QuoteRequest[];
};

export const updateQuoteStatus = async (
  id: string,
  status: QuoteRequest['status']
): Promise<QuoteRequest[] | null> => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('quote_requests')
    .update({ status })
    .eq('id', id)
    .select();

  if (error) throw error;

  if (data && data.length > 0) {
    try {
      await sendTelegramNotification(
        formatStatusUpdateNotification(data[0].name, status ?? 'pending')
      );
    } catch (err) {
      console.error('[Nokael] Status notification error:', err);
    }
  }

  return data as QuoteRequest[];
};

export const deleteQuoteRequest = async (id: string): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase.from('quote_requests').delete().eq('id', id);
  if (error) throw error;
};

export const getQuoteByTrackingId = async (trackingId: string): Promise<QuoteRequest | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('quote_requests')
    .select('*')
    .eq('tracking_id', trackingId.toUpperCase())
    .single();

  if (error) return null;
  return data as QuoteRequest;
};

// ==========================================
// Business Inquiries
// ==========================================

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

export const submitBusinessInquiry = async (data: BusinessInquiry): Promise<BusinessInquiry> => {
  // Auto-generate corporate code — operator can reassign later
  const corporate_code = `NOK-${Math.floor(1000 + Math.random() * 9000)}`;
  const payload: BusinessInquiry = { ...data, corporate_code, status: 'pending' };

  if (supabase) {
    const { error } = await supabase.from('business_inquiries').insert([payload]);
    if (error) throw error;
  }

  try {
    await sendTelegramNotification(formatBusinessNotification(payload));
  } catch (err) {
    console.error('[Nokael] Business notification error:', err);
  }

  return payload;
};

export const updateBusinessInquiry = async (
  id: string,
  updates: Partial<BusinessInquiry>
): Promise<BusinessInquiry[] | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('business_inquiries')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) throw error;
  return data as BusinessInquiry[];
};

export const getBusinessInquiries = async (): Promise<BusinessInquiry[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('business_inquiries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as BusinessInquiry[];
};

// ==========================================
// Jobs
// ==========================================

export interface Job {
  id?: string;
  // Auto-generated by DB trigger as NOK-xxxx
  job_ref?: string | null;
  source?: string;
  quote_id?: string | null;

  // Parties
  sender_name: string;
  sender_phone: string;
  recipient_name: string;
  recipient_phone: string;
  client_name?: string | null;
  client_whatsapp?: string | null;
  company_name?: string | null;

  // Driver — nullable, assigned later via assignDriverToJob()
  driver_id?: string | null;

  // Route
  pickup_emirate: string;
  pickup_location: string;
  delivery_emirate: string;
  delivery_location: string;

  // Package
  item_type: ItemType;
  urgency: UrgencyType;
  service_tier?: ServiceTier | null;
  special_instructions?: string | null;
  operator_notes?: string | null;

  // Pricing
  price_aed?: number | null;

  // OTP — split by event
  otp_sender?: string | null;
  otp_driver_pickup?: string | null;
  otp_driver_delivery?: string | null;
  otp_recipient?: string | null;
  otp_attempts?: number;

  // Lifecycle status
  status: JobStatus;
  cancellation_reason?: string | null;

  // Confirmation tokens
  token_client_pickup?: string;
  token_driver_pickup?: string;
  token_driver_delivery?: string;
  token_client_delivery?: string;
  tracking_token?: string | null;

  // Confirmation timestamps
  client_pickup_at?: string | null;
  driver_pickup_at?: string | null;
  driver_delivery_at?: string | null;
  client_delivery_at?: string | null;
  client_pickup_confirmed_at?: string | null;
  driver_pickup_confirmed_at?: string | null;
  driver_delivery_confirmed_at?: string | null;
  client_delivery_confirmed_at?: string | null;
  driver_arrived_pickup_at?: string | null;
  driver_arrived_delivery_at?: string | null;
  sender_ready_at?: string | null;
  scheduled_pickup_at?: string | null;
  cancelled_at?: string | null;

  // Coordinates (pickup/delivery geo)
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;

  // Driver live location (updated by driver app)
  driver_lat?: number | null;
  driver_lng?: number | null;
  driver_updated_at?: string | null;

  // Notification flags
  sender_notified?: boolean;
  driver_notified?: boolean;
  recipient_notified?: boolean;

  // Meta
  created_at?: string;
  updated_at?: string;
}

// Map database fields to client field expectations (e.g. client_pickup_confirmed_at vs client_pickup_at)
export const mapJobDbToClient = <T extends Partial<Job>>(job: T): T => {
  if (!job) return job;
  const mapped = { ...job };
  
  if (mapped.client_pickup_confirmed_at && !mapped.client_pickup_at) {
    mapped.client_pickup_at = mapped.client_pickup_confirmed_at;
  } else if (mapped.client_pickup_at && !mapped.client_pickup_confirmed_at) {
    mapped.client_pickup_confirmed_at = mapped.client_pickup_at;
  }

  if (mapped.driver_pickup_confirmed_at && !mapped.driver_pickup_at) {
    mapped.driver_pickup_at = mapped.driver_pickup_confirmed_at;
  } else if (mapped.driver_pickup_at && !mapped.driver_pickup_confirmed_at) {
    mapped.driver_pickup_confirmed_at = mapped.driver_pickup_at;
  }

  if (mapped.driver_delivery_confirmed_at && !mapped.driver_delivery_at) {
    mapped.driver_delivery_at = mapped.driver_delivery_confirmed_at;
  } else if (mapped.driver_delivery_at && !mapped.driver_delivery_confirmed_at) {
    mapped.driver_delivery_confirmed_at = mapped.driver_delivery_at;
  }

  if (mapped.client_delivery_confirmed_at && !mapped.client_delivery_at) {
    mapped.client_delivery_at = mapped.client_delivery_confirmed_at;
  } else if (mapped.client_delivery_at && !mapped.client_delivery_confirmed_at) {
    mapped.client_delivery_confirmed_at = mapped.client_delivery_at;
  }

  return mapped;
};

// Used when getJobs() returns driver data joined
export type JobWithDriver = Job & { driver: Partial<Driver> | null };

export const createJob = async (jobData: Partial<Job>): Promise<Job> => {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('jobs')
    .insert([jobData])
    .select()
    .single();

  if (error) throw error;
  return mapJobDbToClient(data as Job);
};

/**
 * Convert a quote into a job.
 * Driver is NOT assigned here — call assignDriverToJob() separately.
 * Quote status is automatically set to 'completed'.
 */
export const createJobFromQuote = async (
  quote: QuoteRequest,
  overrides?: Partial<Job>
): Promise<Job> => {
  if (!supabase) throw new Error('Supabase not configured');
  if (!quote.id) throw new Error('Quote must have an ID to create a job');

  const genOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
  const driverOtp = genOtp();

  const jobPayload: Partial<Job> = {
    quote_id: quote.id,
    source: 'quote',
    sender_name: quote.name,
    sender_phone: quote.phone,
    recipient_name: '',       // Operator fills this in via overrides
    recipient_phone: '',      // Operator fills this in via overrides
    pickup_emirate: quote.emirate,
    pickup_location: quote.pickup_location,
    delivery_emirate: quote.emirate,
    delivery_location: quote.delivery_location,
    item_type: quote.item_type,
    urgency: quote.urgency,
    company_name: quote.company_name ?? null,
    client_name: quote.name,
    client_whatsapp: quote.phone,
    status: 'pending',
    driver_id: null,
    token_client_pickup: crypto.randomUUID(),
    token_driver_pickup: crypto.randomUUID(),
    token_driver_delivery: crypto.randomUUID(),
    token_client_delivery: crypto.randomUUID(),
    otp_sender: genOtp(),
    otp_driver_pickup: driverOtp,
    otp_driver_delivery: driverOtp,
    otp_recipient: genOtp(),
    ...overrides,
  };

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert([jobPayload])
    .select()
    .single();

  if (jobError) throw jobError;

  // Mark source quote as converted
  await supabase
    .from('quote_requests')
    .update({ status: 'completed' })
    .eq('id', quote.id);

  return mapJobDbToClient(job as Job);
};

/**
 * Assign or unassign a driver to an existing job.
 * Pass null to driverId to unassign.
 */
export const assignDriverToJob = async (
  jobId: string,
  driverId: string | null
): Promise<Job> => {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('jobs')
    .update({
      driver_id: driverId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .select()
    .single();

  if (error) throw error;
  return mapJobDbToClient(data as Job);
};

export const getJobs = async (): Promise<JobWithDriver[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('jobs')
    .select('*, driver:drivers(id, full_name, phone, whatsapp, vehicle_type, status, rating)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(job => mapJobDbToClient(job as JobWithDriver));
};

/**
 * Fetch a single job by its public tracking token.
 * Used for the customer-facing live tracking page.
 */
export const getJobByTrackingToken = async (token: string): Promise<JobWithDriver | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('jobs')
    .select('*, driver:drivers(id, full_name, phone, vehicle_type, status)')
    .eq('tracking_token', token)
    .single();

  if (error) return null;
  return mapJobDbToClient(data as JobWithDriver);
};

export const updateJob = async (id: string, updates: Partial<Job>): Promise<Job> => {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('jobs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapJobDbToClient(data as Job);
};

export const cancelJob = async (id: string, reason: string): Promise<Job> => {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('jobs')
    .update({
      status: 'cancelled',
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapJobDbToClient(data as Job);
};

/**
 * Update driver's live GPS position on an active job.
 * Called by the driver app at regular intervals.
 */
export const updateDriverLocation = async (
  jobId: string,
  lat: number,
  lng: number
): Promise<Job> => {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('jobs')
    .update({
      driver_lat: lat,
      driver_lng: lng,
      driver_updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .select()
    .single();

  if (error) throw error;
  return mapJobDbToClient(data as Job);
};

/** Subscribe to all job changes (admin dashboard) */
export const subscribeToJobs = (callback: (payload: any) => void) => {
  if (!supabase) return null;

  return supabase
    .channel('jobs_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, callback)
    .subscribe();
};

/** Subscribe to a single job (customer live tracking page) */
export const subscribeToJob = (jobId: string, callback: (payload: any) => void) => {
  if (!supabase) return null;

  return supabase
    .channel(`job_${jobId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` },
      callback
    )
    .subscribe();
};

// ==========================================
// Job Ratings
// ==========================================

export interface JobRating {
  id?: string;
  job_id: string;
  driver_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  feedback_text?: string;
  rated_by: 'client' | 'operator';
  rated_at?: string;
}

export const submitJobRating = async (data: JobRating): Promise<JobRating> => {
  if (!supabase) throw new Error('Supabase not configured');

  const { data: result, error } = await supabase
    .from('job_ratings')
    .insert([data])
    .select()
    .single();

  if (error) throw error;
  return result as JobRating;
};

export const getJobRatingByJobId = async (jobId: string): Promise<JobRating | null> => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('job_ratings')
    .select('*')
    .eq('job_id', jobId)
    .single();

  if (error) return null;
  return data as JobRating;
};

// ==========================================
// Drivers
// ==========================================

export interface Driver {
  id?: string;
  created_at?: string;

  // Identity
  full_name: string;
  phone: string;
  whatsapp: string;
  email: string;
  emirates_id?: string;

  // Vehicle
  base_location: string;
  vehicle_type: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_plate?: string;

  // Coverage
  inter_emirate?: boolean;
  areas_covered?: string[];
  availability_hours?: string;
  availability?: DriverAvailability;

  // Document status
  eid_front_url?: string;
  eid_back_url?: string;
  eid_verified?: boolean;

  // Operational state
  active?: boolean;
  status?: DriverStatus;

  // Performance
  rating?: number;
  jobs_completed?: number;
  on_time_rate?: number;
  reliability_score?: number;

  // Admin
  onboarding_status?: OnboardingStatus;
  tier?: DriverTier;
  internal_notes?: string;
  last_active_at?: string;

  // Session expiry (read-only from client; set via createDriverSession RPC)
  session_expires_at?: string;

  // pin_hash is NEVER in this interface — it is write-only via set_driver_pin RPC
}

export interface DriverDocument {
  id?: string;
  driver_id: string;
  document_type: 'emirates_id' | 'license' | 'registration' | 'vehicle_photo';
  file_url: string;
  drive_file_id?: string;
  verification_status?: VerificationStatus;
  expiry_date?: string;
  uploaded_at?: string;
}

export const submitDriverApplication = async (data: Driver): Promise<Driver> => {
  const id = crypto.randomUUID();
  const payload: Driver = {
    ...data,
    id,
    status: 'offline',
    active: true,
    onboarding_status: 'pending',
  };

  if (supabase) {
    const { error } = await supabase.from('drivers').insert([payload]);
    if (error) throw error;
  }

  try {
    await sendTelegramNotification(formatDriverNotification(data));
  } catch (err) {
    console.error('[Nokael] Driver notification error:', err);
  }

  return payload;
};

export const uploadDriverDocument = async (data: DriverDocument): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase.from('driver_documents').insert([data]);
  if (error) throw error;
};

export const getDrivers = async (): Promise<Driver[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Driver[];
};

/**
 * Fetch only drivers that are currently available.
 * Optionally filter by emirate (checks areas_covered array).
 */
export const getAvailableDrivers = async (emirate?: string): Promise<Driver[]> => {
  if (!supabase) return [];

  let query = supabase
    .from('drivers')
    .select('*')
    .eq('status', 'available')
    .eq('active', true);

  if (emirate) {
    query = query.contains('areas_covered', [emirate]);
  }

  const { data, error } = await query.order('rating', { ascending: false });
  if (error) throw error;
  return data as Driver[];
};

export const getDriverWithDocuments = async (
  id: string
): Promise<Driver & { documents: DriverDocument[] }> => {
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
    ...(driver as Driver),
    documents: documents as DriverDocument[],
  };
};

export const updateDriverStatus = async (
  id: string,
  updates: Partial<Driver>
): Promise<Driver[]> => {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('drivers')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) throw error;
  return data as Driver[];
};

/**
 * Toggle a driver's real-time availability.
 * Also stamps last_active_at so the admin can see stale drivers.
 */
export const updateDriverAvailability = async (
  id: string,
  status: DriverStatus
): Promise<Driver> => {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('drivers')
    .update({ status, last_active_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Driver;
};

// ==========================================
// Driver PIN Auth (via Supabase RPC)
// All hashing runs server-side via pgcrypto.
// See: supabase/migrations/driver_pin_functions.sql
// ==========================================

/**
 * Set or update a driver's PIN.
 * Hashed with bcrypt on the DB — plain PIN is never stored.
 */
export const setDriverPin = async (driverId: string, pin: string): Promise<void> => {
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase.rpc('set_driver_pin', {
    driver_id: driverId,
    pin,
  });

  if (error) throw error;
};

/**
 * Verify a driver PIN without opening a session.
 * Returns true if PIN matches, false otherwise.
 */
export const verifyDriverPin = async (driverId: string, pin: string): Promise<boolean> => {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase.rpc('verify_driver_pin', {
    driver_id: driverId,
    pin,
  });

  if (error) throw error;
  return data as boolean;
};

/**
 * Verify PIN and open a 7-day session.
 * Updates session_expires_at on the driver row.
 * Store the returned expires_at in your local auth context.
 */
export const createDriverSession = async (
  driverId: string,
  pin: string
): Promise<{ expires_at: string }> => {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase.rpc('create_driver_session', {
    driver_id: driverId,
    pin,
  });

  if (error) throw error;
  return data as { expires_at: string };
};