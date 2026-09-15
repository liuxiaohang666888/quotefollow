-- 008_add_affiliate_applications.sql
-- Add affiliate applications table

CREATE TABLE IF NOT EXISTS public.affiliate_applications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  website TEXT NOT NULL,
  traffic TEXT NOT NULL,
  message TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add trigger for updated_at
CREATE TRIGGER trg_affiliate_applications_touch
BEFORE UPDATE ON public.affiliate_applications
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Unique constraint on email (one application per email)
CREATE UNIQUE INDEX IF NOT EXISTS uq_affiliate_applications_email 
ON public.affiliate_applications(email);

-- RLS policies
ALTER TABLE public.affiliate_applications ENABLE ROW LEVEL SECURITY;

-- Only admins can see applications (via service role)
-- Public can insert (apply)
CREATE POLICY "affiliate_applications_insert_public" ON public.affiliate_applications FOR INSERT
  WITH CHECK (true);

-- Add index
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_status ON public.affiliate_applications(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_email ON public.affiliate_applications(email);

-- Add trigger for updated_at
CREATE TRIGGER trg_affiliate_applications_touch
BEFORE UPDATE ON public.affiliate_applications
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();