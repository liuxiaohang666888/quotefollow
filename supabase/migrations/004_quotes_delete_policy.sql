-- QuoteFollow · 004_quotes_delete_policy.sql
-- 修复：quotes 表没有 DELETE policy，RLS 下任何删除都只影响 0 行（PostgREST 静默成功），
-- 用户点删除后报价其实还在。在 Supabase SQL Editor 里整段执行即可。

drop policy if exists "quotes_delete_own" on public.quotes;
create policy "quotes_delete_own" on public.quotes
  for delete using (auth.uid() = account_id);
