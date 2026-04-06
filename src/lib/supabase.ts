import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
}

export const submitQuoteRequest = async (data: QuoteRequest) => {
  const supabase = getSupabase();
  const { data: result, error } = await supabase
    .from('quote_requests')
    .insert([data])
    .select();
  
  if (error) throw error;
  return result;
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
