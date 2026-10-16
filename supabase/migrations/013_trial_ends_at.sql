-- QuoteFollow · 013_trial_ends_at.sql
-- 作用：accounts 表增加显式试用期到期字段 trial_ends_at（注册写入 14 天后）；
--       回填存量账户（created_at + 14 天，与旧推算逻辑一致）；
--       将该字段纳入敏感字段保护（普通用户不可修改）。
-- 在 Supabase SQL Editor 里整段执行即可（幂等，可重复跑）。

alter table public.accounts
  add column if not exists trial_ends_at timestamptz default null;

-- 回填：老用户按 created_at + 14 天推算，避免试用期被意外延长
update public.accounts
  set trial_ends_at = created_at + interval '14 days'
  where trial_ends_at is null
    and created_at is not null;

-- 敏感字段保护：加入 trial_ends_at（普通用户不可自行修改试用期）
create or replace function public.prevent_sensitive_account_update()
returns trigger
language plpgsql
as $$
begin
  -- service_role 豁免（服务端/cron 正常更新订阅与试用状态）
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.paypal_subscription_id is distinct from old.paypal_subscription_id
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.free_months_earned is distinct from old.free_months_earned
     or new.referral_credits is distinct from old.referral_credits then
    raise exception 'cannot modify sensitive fields';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_sensitive_account_update on public.accounts;
create trigger trg_prevent_sensitive_account_update
  before update on public.accounts
  for each row execute function public.prevent_sensitive_account_update();
