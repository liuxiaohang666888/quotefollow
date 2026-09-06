-- QuoteFollow · 005_add_raw_mime.sql
-- 新增列：保存原始 MIME 邮件原文（base64 编码），用于解析失败时查看原始邮件。

alter table public.quotes
  add column if not exists source_raw_mime text not null default '';

alter table public.messages
  add column if not exists raw_mime text not null default '';

create index if not exists idx_messages_quote_direction on public.messages(quote_id, direction);
