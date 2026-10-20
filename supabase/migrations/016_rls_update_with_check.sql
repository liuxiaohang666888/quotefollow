-- QuoteFollow · 016_rls_update_with_check.sql
-- 修复：UPDATE 策略只有 USING 没有 WITH CHECK 时，用户可通过 UPDATE 把行改到
-- 不属于自己的 account（如把 quotes.account_id 改成别人 → 越权转移报价；
-- scope_changes 改成别人的报价下 → 越权挂载）。
-- 在 Supabase SQL Editor 整段执行。

drop policy if exists "quotes_update_own" on public.quotes;
create policy "quotes_update_own" on public.quotes
  for update using (auth.uid() = account_id) with check (auth.uid() = account_id);

drop policy if exists "accounts_update_own" on public.accounts;
create policy "accounts_update_own" on public.accounts
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "scope_changes_update_own" on public.scope_changes;
create policy "scope_changes_update_own" on public.scope_changes
  for update using (exists (select 1 from public.quotes q where q.id = quote_id and q.account_id = auth.uid()))
  with check (exists (select 1 from public.quotes q where q.id = quote_id and q.account_id = auth.uid()));

drop policy if exists "clients_update_own" on public.clients;
create policy "clients_update_own" on public.clients
  for update using (auth.uid() = account_id) with check (auth.uid() = account_id);
