-- 009_add_referral_system.sql
-- Add referral system tables

-- Add referral fields to accounts
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.accounts(id),
ADD COLUMN IF NOT EXISTS free_months_earned INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_credits NUMERIC NOT NULL DEFAULT 0;

-- Create referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  free_months_granted INT NOT NULL DEFAULT 0,
  subscription_id TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE (referrer_id, referred_id)
);

-- Add trigger for updated_at
CREATE TRIGGER trg_referrals_touch
BEFORE UPDATE ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS policies
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_select_own" ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "referrals_insert_own" ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- Add index
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

-- Add trigger for updated_at
CREATE TRIGGER trg_referrals_touch
BEFORE UPDATE ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Add free_months_earned to accounts (already added above)
-- Add index for referral code lookups
CREATE INDEX IF NOT EXISTS idx_accounts_referral_code ON public.accounts(referral_code);