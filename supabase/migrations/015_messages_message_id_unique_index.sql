-- 015_messages_message_id_unique_index.sql
-- 为 messages.message_id 添加部分唯一索引，作为防重复回调的真正兜底。
-- WHERE message_id != '' 确保空值行不受唯一性约束（历史数据兼容）。
-- 应用层 isDuplicateMessage 保留作为快速路径，数据库索引作为并发竞态的最后保障。

CREATE UNIQUE INDEX IF NOT EXISTS messages_message_id_key_idx
  ON messages (message_id)
  WHERE message_id != '';
