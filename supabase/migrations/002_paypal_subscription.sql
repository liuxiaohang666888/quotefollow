-- QuoteFollow · 002_paypal_subscription.sql
-- 在 Supabase SQL Editor 里整段执行即可（幂等，可重复跑）。
-- 作用：accounts 表增加 paypal_subscription_id 列（付费检查用）。

alter table public.accounts
  add column if not exists paypal_subscription_id text default null;
