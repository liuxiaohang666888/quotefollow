-- ============================================================
-- 邮件处理追踪表（诊断用）
-- 每次inbound webhook处理都会在这里留下一行处理轨迹
-- 跑一次即可，之后每次邮件处理自动记录
-- ============================================================

create table if not exists public.inbound_debug (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message_id text,
  in_reply_to text,
  sender_email text,
  followup_email text,
  subject text,
  body_len int,
  raw_len int,
  result text,          -- handled_reply / new_quote / duplicate / no_account / error
  detail text           -- 附加信息（错误内容、quote_id等）
);

alter table public.inbound_debug enable row level security;

create policy "service role only" on public.inbound_debug
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
