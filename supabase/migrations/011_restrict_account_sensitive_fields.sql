-- 封堵 RLS 漏洞：禁止普通用户修改敏感字段（paypal_subscription_id / free_months_earned / referral_credits）
create or replace function public.prevent_sensitive_account_update()
returns trigger
language plpgsql
as $$
begin
  -- service_role 豁免（服务端/cron 正常更新订阅状态）
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.paypal_subscription_id is distinct from old.paypal_subscription_id
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
