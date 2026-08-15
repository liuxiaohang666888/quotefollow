-- QuoteFollow · 001_init.sql
-- 在 Supabase SQL Editor 里整段执行即可。

-- ============ 扩展 ============
create extension if not exists "uuid-ossp";

-- ============ accounts：老板账号（主键 = auth.users.id） ============
create table if not exists public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default '',
  -- 专属跟进邮箱（如 follow@yourdomain.com），客户报价转发/BCC 到这里
  followup_email text not null default '',
  -- 热单/转人工提醒：Slack Webhook 可选
  slack_webhook text not null default '',
  -- AI 自动回复用到的业务知识（档期/定金/工期等），由用户在设置页填写
  business_info jsonb not null default '{}'::jsonb,
  -- 是否开启 AI 自动回复
  auto_reply_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ quotes：报价单 ============
create table if not exists public.quotes (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references public.accounts(id) on delete cascade,

  customer_email text not null,
  customer_name text not null default '',
  amount numeric default null,
  service_type text not null default '',
  quote_date date not null default current_date,

  -- 状态机：following=跟进中  replied=已回复/已成交(需老板标记)  won=成交  lost=流失
  status text not null default 'following'
    check (status in ('following','replied','won','lost')),

  -- 跟进引擎
  followup_count int not null default 0,
  last_followup_at timestamptz default null,
  next_followup_at timestamptz default null,

  -- 原始邮件
  source_subject text not null default '',
  source_body text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quotes_account on public.quotes(account_id);
create index if not exists idx_quotes_next_followup on public.quotes(next_followup_at) where status = 'following';

-- ============ messages：邮件往来记录 ============
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  direction text not null check (direction in ('in','out')),
  subject text not null default '',
  body text not null default '',
  -- 邮件 Message-ID / In-Reply-To，用于把客户回复匹配到报价单
  message_id text not null default '',
  in_reply_to text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_quote on public.messages(quote_id);
create index if not exists idx_messages_in_reply on public.messages(in_reply_to);

-- ============ RLS 安全策略 ============
alter table public.accounts enable row level security;
alter table public.quotes enable row level security;
alter table public.messages enable row level security;

-- accounts：老板只能看/改自己的
create policy "accounts_select_own" on public.accounts for select using (auth.uid() = id);
create policy "accounts_insert_own" on public.accounts for insert with check (auth.uid() = id);
create policy "accounts_update_own" on public.accounts for update using (auth.uid() = id);

-- quotes：老板只能看自己的
create policy "quotes_select_own" on public.quotes for select using (auth.uid() = account_id);
create policy "quotes_insert_own" on public.quotes for insert with check (auth.uid() = account_id);
create policy "quotes_update_own" on public.quotes for update using (auth.uid() = account_id);

-- messages：通过 quote 归属老板
create policy "messages_select_own" on public.messages for select
  using (exists (select 1 from public.quotes q where q.id = quote_id and q.account_id = auth.uid()));
create policy "messages_insert_own" on public.messages for insert
  with check (exists (select 1 from public.quotes q where q.id = quote_id and q.account_id = auth.uid()));

-- 服务端（cron/webhook）用 service_role 绕过 RLS，不受影响。

-- ============ 触发器：自动更新 updated_at ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_accounts_touch before update on public.accounts
  for each row execute function public.touch_updated_at();
create trigger trg_quotes_touch before update on public.quotes
  for each row execute function public.touch_updated_at();
