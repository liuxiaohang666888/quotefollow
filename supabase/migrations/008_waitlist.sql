-- Waitlist for un-validated product tests (invoice-helper / booking-payment)
-- Run in Supabase SQL Editor.

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  product text not null check (product in ('invoice-helper', 'booking-payment')),
  source text,
  created_at timestamptz not null default now()
);

create index if not exists waitlist_product_idx on public.waitlist (product);
create unique index if not exists waitlist_email_product_uniq on public.waitlist (lower(email), product);

alter table public.waitlist enable row level security;

-- Anonymous visitors may only INSERT; nothing is readable from the client.
create policy "anon can join waitlist"
  on public.waitlist for insert
  to anon
  with check (true);
