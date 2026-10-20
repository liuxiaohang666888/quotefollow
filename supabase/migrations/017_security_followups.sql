-- QuoteFollow · 017_security_followups.sql
-- 日期：2026-10-20（全量代码审查后续修复批次）
-- 在 Supabase SQL Editor 整段执行（幂等，可重复跑）。
--
-- 本文件对应审查报告条目：
--   M5  —— accounts.email / referral_code 纳入敏感字段触发器保护
--           （email 是 countQuotesFor 的额度统计维度；referral_code 决定推荐分成归属。
--             anon key 直连 + RLS update 策略即可改这两列，属于付费墙/分成统计面的缺口）
--   M7  —— quotes.source_message_id 列 + 部分唯一索引（入站 webhook 重试的 quote 级幂等）
--   M11④ —— increment_free_months(account_id, months) 原子自增 RPC
--           （替代 read-modify-write，并发完成推荐时不再丢更新）
--   M16 —— inbound_debug 开启 RLS（该表建表时漏开，service_role 之外零策略=禁一切，
--           但显式开启并加策略让状态确定，避免未来 Supabase 默认值变化带来惊喜）

-- ========== M5：敏感字段触发器扩展（email / referral_code） ==========
-- 在 011 的保护名单（paypal_subscription_id / free_months_earned / referral_credits）基础上，
-- 追加 email 与 referral_code。邮箱变更走独立验证流程（未来做）， referral_code 只能由
-- 服务端生成，不允许浏览器端直改。
create or replace function public.prevent_sensitive_account_update()
returns trigger
language plpgsql
as $$
begin
  -- service_role 豁免（服务端/cron 正常更新订阅状态、推荐码初始化等）
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.paypal_subscription_id is distinct from old.paypal_subscription_id
     or new.free_months_earned is distinct from old.free_months_earned
     or new.referral_credits is distinct from old.referral_credits
     or new.email is distinct from old.email
     or new.referral_code is distinct from old.referral_code then
    raise exception 'cannot modify sensitive fields';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_sensitive_account_update on public.accounts;
create trigger trg_prevent_sensitive_account_update
  before update on public.accounts
  for each row execute function public.prevent_sensitive_account_update();

-- ========== M7：入站邮件 quote 级幂等 ==========
-- 入站 webhook 被 Resend 重试时，message_id 去重只覆盖 messages 表；
-- "报价已建但响应丢失"的重试会建出重复报价。加来源消息 ID 列 + 唯一索引补齐。
alter table public.quotes
  add column if not exists source_message_id text default null;

-- 部分唯一索引：空值不参与唯一约束（手动建档/发送入口该列为 null）
create unique index if not exists quotes_source_message_id_key
  on public.quotes (source_message_id)
  where source_message_id is not null and source_message_id <> '';

-- ========== M11④：免费月份原子自增 ==========
-- 旧代码 read-modify-write：两个推荐并发完成时，后写的基于旧值计算，丢一个月的奖励。
-- security definer：service_role 调用本就没障碍，普通角色不应直接改 accounts，
-- 这里显式 definer 保持与其它服务端函数一致的语义。
create or replace function public.increment_free_months(account_id uuid, months integer)
returns integer
language plpgsql
security definer
as $$
declare
  new_value integer;
begin
  if months is null or months <= 0 then
    raise exception 'months must be a positive integer';
  end if;
  update public.accounts
    set free_months_earned = coalesce(free_months_earned, 0) + months
    where id = account_id
    returning free_months_earned into new_value;
  if new_value is null then
    raise exception 'account not found: %', account_id;
  end if;
  return new_value;
end;
$$;

-- ========== M16：inbound_debug 开启 RLS ==========
alter table public.inbound_debug enable row level security;

-- 仅 service_role 可读写（轨迹表是排障用的，浏览器端永远不该碰）
drop policy if exists inbound_debug_service_all on public.inbound_debug;
create policy inbound_debug_service_all
  on public.inbound_debug
  for all
  to service_role
  using (true)
  with check (true);
