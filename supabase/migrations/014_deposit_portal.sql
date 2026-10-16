-- 014_deposit_portal.sql
-- 收定金闭环：用户收款链接 + 报价定金门户 token
-- 在 Supabase SQL Editor 里执行

-- ============ accounts：收款链接 ============
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS payment_link text DEFAULT '';

COMMENT ON COLUMN public.accounts.payment_link IS 'User payment link (PayPal.me or any payment URL) used to collect deposits from customers';

-- ============ quotes：定金门户 token ============
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS portal_token text DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_portal_token ON public.quotes(portal_token) WHERE portal_token IS NOT NULL;

COMMENT ON COLUMN public.quotes.portal_token IS 'Magic token that lets the customer open the deposit payment page without login';
