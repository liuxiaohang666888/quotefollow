-- ============================================================
-- 邮件解析诊断 SQL（在 Supabase SQL Editor 里跑一次，把结果截图给我）
-- 作用：直接看最新一条客户回复消息的关键字段，一次定位"回复为空"
-- ============================================================

-- 1. 最新3条in方向消息的解析状态
SELECT
  created_at,
  direction,
  subject,
  length(body) AS body长度,
  left(body, 100) AS body开头,
  length(raw_mime) AS raw_mime长度,
  left(raw_mime, 80) AS raw_mime开头
FROM messages
WHERE direction = 'in'
ORDER BY created_at DESC
LIMIT 3;

-- 2. 顺便看最新报价状态
SELECT id, customer_name, status, followup_count, created_at
FROM quotes
ORDER BY created_at DESC
LIMIT 3;
