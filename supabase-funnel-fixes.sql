-- Apply before deploying the accompanying server and frontend changes.
-- Existing installations may already have this column.
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS notes text;
COMMENT ON COLUMN public.quote_requests.notes IS
  'Customer instructions, including scheduled pickup and delivery deadline in UTC.';
