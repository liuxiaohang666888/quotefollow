-- 018_free_month_expiry.sql
-- free_months_earned 真抵扣：accounts 表新增免费月到期时间列。
-- 幂等：add column if not exists，可重复执行。
-- ⚠️ 需在生产库手动执行（supabase db push 或 SQL Editor）：
--   在 supabase/migrations 目录外运行时，直接用 SQL Editor 执行本文件内容即可。
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS free_month_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.accounts.free_month_expires_at IS
  '赠送免费月到期时间。非空且晚于当前时间时，即使用户无有效订阅也保持解锁（free_months_earned 真抵扣）；到期后按免费用户降级。';
