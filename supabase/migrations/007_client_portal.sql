-- QuoteFollow · 007_client_portal.sql
-- H5 客户门户：自由职业者给客户看的进度/发票面板
-- 在 Supabase SQL Editor 里执行

-- ============ clients：客户档案 ============
create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  
  -- 客户信息
  name text not null,
  email text not null,
  phone text default '',
  notes text default '',
  
  -- 项目状态
  project_status text not null default 'in_progress'
    check (project_status in ('pending', 'in_progress', 'review', 'completed', 'on_hold')),
  
  -- 发票（金额/到期日/是否已付）
  invoice_amount numeric default null,
  invoice_due_date date default null,
  invoice_paid boolean default false,
  invoice_paid_at timestamptz default null,
  
  -- 自动催款
  last_reminder_sent timestamptz default null,
  reminder_count int not null default 0,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clients_account on public.clients(account_id);
create index if not exists idx_clients_status on public.clients(account_id, project_status);

-- ============ client_access_tokens：魔法链接（无密码访问） ============
create table if not exists public.client_access_tokens (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  expires_at timestamptz default null,  -- null = 永不过期
  used_at timestamptz default null,     -- 首次访问记录时间
  created_at timestamptz not null default now()
);

create index if not exists idx_client_tokens_client on public.client_access_tokens(client_id);
create index if not exists idx_client_tokens_token on public.client_access_tokens(token);

-- ============ RLS 安全策略 ============
alter table public.clients enable row level security;
alter table public.client_access_tokens enable row level security;

-- 老板能看到自己的客户
create policy "clients_select_own" on public.clients 
  for select using (auth.uid() = account_id);

create policy "clients_insert_own" on public.clients 
  for insert with check (auth.uid() = account_id);

create policy "clients_update_own" on public.clients 
  for update using (auth.uid() = account_id);

-- 只有 token 验证端点能查 access_tokens（不暴露给前端）
create policy "tokens_select_admin_only" on public.client_access_tokens
  for select using (false);  -- 禁用所有直接查询
