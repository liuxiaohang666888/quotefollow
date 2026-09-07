-- ============================================================
-- QuoteFollow 数据库修复 SQL（在 Supabase SQL Editor 里跑一次）
-- 作用：①防止同一封邮件重复入库 ②加速 cron 查询
-- 跑完后不需要重启任何服务，立即生效
-- ============================================================

-- 1. message_id 唯一索引（防止并发时同一封邮件插入两条记录）
--    注意：先清掉已有的重复数据，否则索引建不起来
--    保留每组重复中最早的一条，删掉后面的
DELETE FROM messages a
USING messages b
WHERE a.message_id <> ''
  AND a.message_id = b.message_id
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_message_id_unique
  ON messages (message_id)
  WHERE message_id <> '';

-- 2. cron 扫描索引：每天定时任务按 status + next_followup_at 查询，加索引后快很多
CREATE INDEX IF NOT EXISTS idx_quotes_followup_scan
  ON quotes (status, next_followup_at)
  WHERE status = 'following' AND next_followup_at IS NOT NULL;

-- 3. 按客户邮箱查找报价（客户回复邮件时用）
CREATE INDEX IF NOT EXISTS idx_quotes_customer_email
  ON quotes (customer_email);

-- 4. messages 按报价查会话记录
CREATE INDEX IF NOT EXISTS idx_messages_quote_id
  ON messages (quote_id);

-- 完成。可以重复执行，IF NOT EXISTS 保证不会报错。
