-- QuoteFollow · 006_inbound_debug.sql
-- 入站邮件调试追踪表。
-- route.ts 的 traceWrite() 会把每个分支的结果写到这里，
-- 方便不用看 Vercel 日志就能知道后端到底收到了哪封邮件、走了哪个分支。

create table if not exists public.inbound_debug (
  id bigint primary key generated always as identity,
  message_id text not null default '',
  in_reply_to text not null default '',
  sender_email text not null default '',
  followup_email text not null default '',
  subject text not null default '',
  body_len int not null default 0,
  raw_len int not null default 0,
  result text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);
