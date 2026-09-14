-- 006_add_deposit_fields.sql
-- Add deposit and scope change fields to quotes table

ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS require_deposit boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deposit_amount numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deposit_status text DEFAULT 'unpaid' CHECK (deposit_status IN ('unpaid', 'paid', 'refunded')),
ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS original_amount numeric DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.quotes.require_deposit IS 'Whether a deposit is required to lock the booking';
COMMENT ON COLUMN public.quotes.deposit_amount IS 'The deposit amount required';
COMMENT ON COLUMN public.quotes.deposit_status IS 'Status of deposit payment: unpaid, paid, refunded';
COMMENT ON COLUMN public.quotes.deposit_paid_at IS 'Timestamp when deposit was paid';
COMMENT ON COLUMN public.quotes.original_amount IS 'Original amount before scope changes';

-- Add index for deposit status queries
CREATE INDEX IF NOT EXISTS idx_quotes_deposit_status ON public.quotes(deposit_status) WHERE deposit_status = 'unpaid';

