-- Create the quote_requests table
CREATE TABLE IF NOT EXISTS public.quote_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    pickup_location TEXT NOT NULL,
    delivery_location TEXT NOT NULL,
    emirate TEXT NOT NULL,
    item_type TEXT CHECK (item_type IN ('document', 'parcel', 'spare_part', 'other')) NOT NULL,
    urgency TEXT CHECK (urgency IN ('immediate', 'today', 'scheduled')) NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    whatsapp_opt_in BOOLEAN DEFAULT true NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'completed')) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows anyone to insert (for the public quote form)
CREATE POLICY "Allow public insert" ON public.quote_requests
    FOR INSERT 
    WITH CHECK (true);

-- Create a policy that allows only authenticated users to view/manage requests
-- Note: You can further restrict this to specific admin roles if needed
CREATE POLICY "Allow authenticated select" ON public.quote_requests
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update" ON public.quote_requests
    FOR UPDATE
    USING (auth.role() = 'authenticated');
