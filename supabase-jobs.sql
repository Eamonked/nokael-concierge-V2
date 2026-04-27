-- ==========================================
-- JOBS TABLE & CHAIN OF CUSTODY SYSTEM
-- ==========================================

-- 1. Create Enums
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
        CREATE TYPE job_status AS ENUM ('pending', 'client_pickup', 'driver_pickup', 'driver_delivery', 'completed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_type_enum') THEN
        CREATE TYPE item_type_enum AS ENUM ('document', 'parcel', 'spare_part', 'other');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'urgency_enum') THEN
        CREATE TYPE urgency_enum AS ENUM ('immediate', 'today', 'scheduled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'confirm_method') THEN
        CREATE TYPE confirm_method AS ENUM ('link', 'otp', 'qr');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_source') THEN
        CREATE TYPE job_source AS ENUM ('form', 'manual');
    END IF;
END $$;

-- 2. Create Jobs Table
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_ref SERIAL,
    status job_status NOT NULL DEFAULT 'pending',
    
    -- Relationships
    quote_id UUID REFERENCES public.quote_requests(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    
    sender_name TEXT NOT NULL,
    sender_phone TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    driver_name TEXT, -- Denormalized for quick manifest display
    driver_phone TEXT, -- Denormalized for quick manifest display
    
    pickup_emirate TEXT NOT NULL,
    pickup_location TEXT NOT NULL,
    delivery_emirate TEXT NOT NULL,
    delivery_location TEXT NOT NULL,
    item_type item_type_enum NOT NULL,
    urgency urgency_enum NOT NULL,
    notes TEXT,
    
    -- Confirmation Tokens (UUIDs)
    token_client_pickup UUID NOT NULL DEFAULT gen_random_uuid(),
    token_driver_pickup UUID NOT NULL DEFAULT gen_random_uuid(),
    token_driver_delivery UUID NOT NULL DEFAULT gen_random_uuid(),
    token_client_delivery UUID NOT NULL DEFAULT gen_random_uuid(),
    
    -- OTPs (6-digit)
    otp_sender CHAR(6),
    otp_driver CHAR(6),
    otp_recipient CHAR(6),
    
    -- Status Flags
    otp_sender_used BOOLEAN DEFAULT FALSE,
    otp_driver_used BOOLEAN DEFAULT FALSE,
    otp_recipient_used BOOLEAN DEFAULT FALSE,
    otp_attempts INTEGER DEFAULT 0,
    
    -- Confirmation Audit Data
    client_pickup_confirmed_at TIMESTAMPTZ,
    client_pickup_method confirm_method,
    client_pickup_lat FLOAT,
    client_pickup_lng FLOAT,
    
    driver_pickup_confirmed_at TIMESTAMPTZ,
    driver_pickup_method confirm_method,
    driver_pickup_lat FLOAT,
    driver_pickup_lng FLOAT,
    
    driver_delivery_confirmed_at TIMESTAMPTZ,
    driver_delivery_method confirm_method,
    driver_delivery_lat FLOAT,
    driver_delivery_lng FLOAT,
    
    client_delivery_confirmed_at TIMESTAMPTZ,
    client_delivery_method confirm_method,
    client_delivery_lat FLOAT,
    client_delivery_lng FLOAT,
    
    -- WhatsApp Status
    whatsapp_sender_sent BOOLEAN DEFAULT FALSE,
    whatsapp_driver_sent BOOLEAN DEFAULT FALSE,
    whatsapp_recipient_sent BOOLEAN DEFAULT FALSE,
    
    source job_source DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Authenticated Operators
DROP POLICY IF EXISTS "Full access for authenticated operators" ON public.jobs;
CREATE POLICY "Full access for authenticated operators" 
    ON public.jobs
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. RLS Policy: Public Token Access (Read-only specific fields)
-- We'll use a VIEW or RPC as requested for strictness, but for the table itself, 
-- we provide limited read access via tokens if direct table access is used.
-- However, per spec: "never expose raw table access" for unauthenticated.
-- So we won't add a public select policy.

-- 6. RPC: Get Job by Token
-- This function allows the confirmation page to fetch job details without having full table access.
CREATE OR REPLACE FUNCTION public.get_job_by_token(token_val UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    job_record RECORD;
BEGIN
    SELECT * INTO job_record 
    FROM public.jobs 
    WHERE token_client_pickup = token_val 
       OR token_driver_pickup = token_val 
       OR token_driver_delivery = token_val 
       OR token_client_delivery = token_val;
       
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Return only safe fields
    RETURN jsonb_build_object(
        'job_ref', job_record.job_ref,
        'status', job_record.status,
        'pickup_location', job_record.pickup_location,
        'pickup_emirate', job_record.pickup_emirate,
        'delivery_location', job_record.delivery_location,
        'delivery_emirate', job_record.delivery_emirate,
        'item_type', job_record.item_type,
        'sender_name', job_record.sender_name,
        'recipient_name', job_record.recipient_name,
        'driver_name', job_record.driver_name,
        'client_pickup_confirmed_at', job_record.client_pickup_confirmed_at,
        'driver_pickup_confirmed_at', job_record.driver_pickup_confirmed_at,
        'driver_delivery_confirmed_at', job_record.driver_delivery_confirmed_at,
        'client_delivery_confirmed_at', job_record.client_delivery_confirmed_at
    );
END;
$$;

-- 8. RPC: Confirm Job Step
-- Unified confirmation logic with token and status guardrails.
CREATE OR REPLACE FUNCTION public.confirm_job_step(
    token_val UUID,
    step_action TEXT,
    method TEXT,
    otp TEXT DEFAULT NULL,
    lat_val FLOAT DEFAULT NULL,
    lng_val FLOAT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    job_record RECORD;
    target_status job_status;
    prereq_status job_status;
    token_column TEXT;
    field_prefix TEXT;
    otp_expected TEXT;
BEGIN
    -- 1. Identify step parameters
    IF step_action = 'client-pickup' THEN
        target_status := 'client_pickup';
        prereq_status := 'pending';
        token_column := 'token_client_pickup';
        otp_expected := 'otp_sender';
    ELSIF step_action = 'driver-pickup' THEN
        target_status := 'driver_pickup';
        prereq_status := 'client_pickup';
        token_column := 'token_driver_pickup';
        otp_expected := 'otp_sender'; -- Driver enters sender's OTP
    ELSIF step_action = 'driver-delivery' THEN
        target_status := 'driver_delivery';
        prereq_status := 'driver_pickup';
        token_column := 'token_driver_delivery';
        otp_expected := 'otp_recipient'; -- Driver enters recipient's OTP
    ELSIF step_action = 'client-delivery' THEN
        target_status := 'completed';
        prereq_status := 'driver_delivery';
        token_column := 'token_client_delivery';
        otp_expected := 'otp_recipient';
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Invalid action');
    END IF;

    -- 2. Fetch Job by Token (Security: check the specific token column for the specific action)
    EXECUTE format('SELECT * FROM public.jobs WHERE %I = $1', token_column)
    INTO job_record
    USING token_val;

    IF job_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid or expired link');
    END IF;

    -- 3. Check Prerequisite
    IF job_record.status != prereq_status THEN
        RETURN jsonb_build_object('success', false, 'message', 'Step out of sequence', 'code', '409');
    END IF;

    -- 4. OTP Verification (if method is 'otp')
    IF method = 'otp' THEN
        IF otp IS NULL OR length(otp) != 6 THEN
            RETURN jsonb_build_object('success', false, 'message', 'Valid OTP required');
        END IF;
        
        -- Check attempts
        IF job_record.otp_attempts >= 5 THEN
            RETURN jsonb_build_object('success', false, 'message', 'OTP Locked. Contact support.');
        END IF;

        -- Verify
        IF otp != (CASE 
            WHEN otp_expected = 'otp_sender' THEN job_record.otp_sender 
            WHEN otp_expected = 'otp_recipient' THEN job_record.otp_recipient 
            ELSE NULL END) THEN
            
            UPDATE public.jobs SET otp_attempts = otp_attempts + 1 WHERE id = job_record.id;
            RETURN jsonb_build_object('success', false, 'message', 'Incorrect OTP');
        END IF;
    END IF;

    -- 5. Perform Update
    field_prefix := replace(step_action, '-', '_');
    
    EXECUTE format(
        'UPDATE public.jobs SET 
            status = $1, 
            %I = now(), 
            %I = $2::confirm_method, 
            %I = $3, 
            %I = $4,
            updated_at = now()
         WHERE id = $5',
        field_prefix || '_confirmed_at',
        field_prefix || '_method',
        field_prefix || '_lat',
        field_prefix || '_lng'
    )
    USING target_status, method, lat_val, lng_val, job_record.id;

    RETURN jsonb_build_object('success', true, 'message', 'Step confirmed');
END;
$$;
