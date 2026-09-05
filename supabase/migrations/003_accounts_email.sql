-- QuoteFollow · 003_accounts_email.sql
-- 在 Supabase SQL Editor 里整段执行即可（幂等，可重复跑）。
-- 作用：accounts 增加 email 列（老板注册邮箱）。
-- 用途：入站邮件按发件人（From）精确匹配账户。
--       所有垂直共享同一个入站邮箱 follow@voxalo.top，
--       多账户场景下按 To 匹配无法区分，必须按 From 匹配。

alter table public.accounts
  add column if not exists email text not null default '';

-- 给已有账户回填注册邮箱（幂等）
update public.accounts a
set email = u.email
from auth.users u
where a.id = u.id
  and (a.email is null or a.email = '');
