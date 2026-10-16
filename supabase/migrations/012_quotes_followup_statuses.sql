-- 跟进状态机扩展（整改清单第13项）
-- 状态语义：
--   following = 跟进中（cron 只扫该状态）
--   replied  = 已回复/已成交（需老板标记）
--   won / lost = 成交 / 流失
--   paused   = 客户普通回复，跟进暂停（新报价/发票发出时恢复 following）
--   closed   = 明确拒绝 / 已付款 / 要求不再联系，永久关闭跟进
--   paid / stopped = 旧逻辑遗留值，兼容历史数据保留在约束中（新代码不再写入）
alter table public.quotes
  drop constraint if exists quotes_status_check;

alter table public.quotes
  add constraint quotes_status_check
  check (status in ('following','replied','won','lost','paused','closed','paid','stopped'));
