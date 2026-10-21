# AI_LOG.md · QuoteFollow 改动留痕

> 每次 AI 改动追加一条，避免"散了的都不知道在哪里"。格式：日期 | 需求 | 改动文件 | 迁移 | 验证 | commit。

---

## 2026-10-21 | Refer 付费后补判定 + free_months_earned 真抵扣 + waitlist 站主通知

**需求**：
1. Refer 邀请只在"注册即带订阅"时完成（signup 自调 referral/complete），先注册后付费永远 pending → 在绑定订阅成功、webhook ACTIVATED 两个节点补判定，幂等。
2. free_months_earned 只加不抵、永不兑现 → 新增 free_month_expires_at，所有付费墙判定改为"无订阅 ID 且免费月已过期才算免费"；主动取消订阅时消费 1 个免费月并顺延 30 天（保留订阅 ID 解锁）；cron subscription-check 确定性失效时若免费月生效中则延迟降级。
3. affiliate waitlist 填表后站主无通知（L73-74 TODO）→ 复用 Resend sendEmail 给 OWNER_EMAIL 发通知，无 env/失败静默跳过，不影响申请成功响应。

**改动文件**：
- `lib/referral-complete.ts`（新增）：共享 Refer 完成判定，`completePendingReferrals(admin, userId, {skipVerify})`，幂等（pending 乐观锁更新 + increment_free_months RPC，RPC 不可用回退读后写）。
- `app/api/account/bind-subscription/route.ts`：写入订阅成功后调用 completePendingReferrals（skipVerify）。
- `app/api/webhooks/paypal/route.ts`：ACTIVATED 分支账号存在时调用 completePendingReferrals（skipVerify，异常不阻塞事件处理）。
- `lib/paywall.ts`：新增 `hasActiveFreeMonth(account)` / `isUnlocked(account)`；复用 isValidPaypalSubscriptionId。
- `app/api/quotes/route.ts`：select 加 free_months_earned/free_month_expires_at；isPaid 判定改为 isUnlocked。
- `app/api/quotes/send/route.ts`：isPaid 判定改为 isUnlocked（两处配额复核）。
- `app/api/cron/followups/route.ts`：isPaid 含 hasActiveFreeMonth。
- `app/api/webhooks/inbound/route.ts`：accountIsPaid = 订阅有效 || hasActiveFreeMonth。
- `app/api/paypal/cancel-subscription/route.ts`：取消成功时 free_months_earned>0 → 减 1、free_month_expires_at=now+30 天、保留订阅 ID；否则原逻辑清空。
- `app/api/cron/subscription-check/route.ts`：确定性失效且免费月生效中 → deferredFreeMonth++、暂不清订阅 ID；返回加 deferredFreeMonth。
- `app/dashboard/page.tsx`：select 加免费月字段；isFree = 无订阅 ID 且免费月未生效。
- `app/dashboard/refer/page.tsx`：select 加 free_month_expires_at；统计卡展示可兑现口径（Active until / Expired / 待激活 / 提示语）。
- `app/api/affiliate/apply/route.ts`：插入成功后发站主通知邮件（OWNER_EMAIL），失败静默。
- `README.md` / `.env.example`：标注 OWNER_EMAIL 配置。

**迁移**：
- `supabase/migrations/018_free_month_expiry.sql`（新增，幂等）：accounts 加 `free_month_expires_at timestamptz`（add column if not exists）。
- ⚠️ 需在生产库执行：`supabase/migrations/018_free_month_expiry.sql`。

**验证**：npm run build 通过。

**commit**：（构建通过后填写）
