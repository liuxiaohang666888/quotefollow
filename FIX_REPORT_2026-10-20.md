# quotefollow 高危修复报告（2026-10-20）

> 对应审查报告：`CODE_REVIEW_2026-10-20.md`
> 状态：**10 项高危 + 6 项中危全部修复完毕**，`tsc --noEmit` 通过，**未 commit**（等你验证后提交）。
> 回滚点：所有改动未提交，`git checkout .` 一键还原；新增文件手动删除即可（清单见下文）。

---

## 一、需人工操作的事项（按优先级）

### 1. 【必须·安全】轮换已泄露的 INBOUND_SECRET
`INBOUND_SECRET = "qf-wb-vX8..."` 曾明文提交进 git，**必须按已泄露处理**。文件里的明文已移除，但 git 历史里仍在，唯一补救是轮换：
1. 生成新密钥（如 `openssl rand -hex 32`）
2. Vercel → 项目 → Settings → Environment Variables：设 `INBOUND_WEBHOOK_SECRET = 新值`
3. Cloudflare 面板 → Workers → flat-term-8bf2 → Settings → Variables：**先删除旧的普通文本变量 `INBOUND_SECRET`**（它就是被 secret put 报 10053 的那个），再执行 `wrangler secret put INBOUND_SECRET` 填入新值
4. 重新部署 Worker 与 Vercel
> 不轮换的危害：知道旧值的人可以伪造入站邮件，给任意账号建假报价/假回复。

### 2. 【必须】在 Supabase SQL Editor 执行新迁移
`supabase/migrations/016_rls_update_with_check.sql` —— 给 4 张表的 UPDATE 策略补 WITH CHECK，堵住"把报价转移到别人账号下"的越权。

### 3. 【必须】确认 Vercel 环境变量
| 变量 | 说明 |
|---|---|
| `CRON_SECRET` | Vercel Cron 会自动注入；确认存在。**缺失时所有 cron 接口一律 401（fail-closed，本次有意改为拒绝放行）** |
| `NEXT_PUBLIC_PAYPAL_EARLY_BIRD_PLAN_ID` | Early Bird 档 plan ID。**缺失时首页 Early Bird 按钮显示"配置错误"而不是静默按 $49 扣款（本次的预期行为）** |
| `NEXT_PUBLIC_PAYPAL_YEARLY_PLAN_ID` | Yearly 档 plan ID，同上 |
| `INBOUND_WEBHOOK_SECRET` | 见第 1 条，与 Worker 的 INBOUND_SECRET 一致 |
| `NEXT_PUBLIC_PAYPAL_PRO_PLAN_ID` | 可选；缺失时回退硬编码 Pro 生产计划（同计划同价，非错价） |

### 4. 【建议】部署后验证清单
- 入站邮件链路：浏览器访问 `https://<worker域名>/?debug=T7a`，应返回 `debug status=200`（旧值是 401，管道断裂的标志）
- cron 手动触发：`curl -H "Authorization: Bearer $CRON_SECRET" https://www.voxalo.top/api/cron/followups`，无密钥应 401
- 月报数字：下月 1 日或手动触发，确认"Follow-ups Sent / Revenue Won"不再是 0
- 注册流程走一遍：带 `?sub=I-xxx`（付费）和不带（免费）各一次，确认账号正常建档
- 报价详情页：Add scope change → Send to customer；Mark deposit as paid（连点两次，第二次不应重发邮件）

---

## 二、改动文件清单（18 改 + 5 增）

### 高危 1：wrangler.toml 明文密钥
- `cloudflare-worker/wrangler.toml` — 删除明文 `INBOUND_SECRET`，改为注释说明 `wrangler secret put` / 面板配置方式，并标注"已泄露需轮换"。

### 高危 2：signup / referral-code 无鉴权
- `app/api/signup/route.ts` — 新增登录态校验：已登录用户 `userId` 必须等于会话用户（否则 403）；无会话场景（邮箱确认流程中）只允许"首次插入"，**账号行已存在且无会话归属证明时拒绝一切写入**（防凭 body 伪造 userId 改他人账号/覆盖 referral_code），按幂等成功返回不破坏前端。
- `app/api/user/referral-code/route.ts` — 新增登录态校验 + userId 归属校验（未登录 401，不匹配 403）。

### 高危 3：cron fail-open
- `lib/cron-auth.ts` — `CRON_SECRET` 未配置时由"放行"改为**一律拒绝**（fail-closed）。
- `app/api/cron/monthly-report/route.ts` — 原来的内联校验 `authHeader !== 'Bearer ' + process.env.CRON_SECRET` 在密钥缺失时会被 `Bearer undefined` 绕过，改为统一走 `isCronAuthorized`。

### 高危 4：入站邮件管道断裂
- `app/api/webhooks/inbound/route.ts` — 鉴权改为双通道：① Worker 转发的 `X-Inbound-Secret` 与 `INBOUND_WEBHOOK_SECRET` 常量时间比较；② Resend 直推的 Svix 签名验签。任一通过放行，都配不上 401（fail-closed）。**结论：保留 Worker（已部署且承担 Cloudflare Email Routing 转发），后端补校验——管道由此打通。**

### 高危 5：PayPal 订阅不验归属
- `lib/paypal.ts` — `verifyPaypalSubscription` 拉取订阅详情后新增 `plan_id` 白名单校验（三档环境变量 + 硬编码 Pro 生产计划）；别家商家的 ACTIVE 订阅直接拒绝，堵死白嫖路径。

### 高危 6：退款/拒付不处理
- `app/api/webhooks/paypal/route.ts` — 新增事件处理：`PAYMENT.SALE.REFUNDED`（退款）、`PAYMENT.SALE.REVERSED`（拒付）、`BILLING.SUBSCRIPTION.EXPIRED/SUSPENDED`（到期/暂停），全部走 `downgradeBySubId` 清空订阅 ID 撤销付费权益。

### 高危 7：三档 plan fallback 同一个
- `components/PayPalSubscribeButton.tsx` — 删除 `PLAN_EARLY_BIRD_ID/PLAN_YEARLY_ID` 的静默 `|| DEFAULT_PLAN_ID`；`planId` prop 语义明确化：`null` = 档位已配置但环境变量缺失 → **渲染显式"配置错误"提示，不给按钮、不给默认计划链接**（防止 $29/$490 用户被按 $49 扣款）；`undefined` = 未指定档位 → 用 Pro 生产计划（同计划同价）。
- `lib/verticals/quotefollow.ts` — Early Bird / Yearly 的 `planId` 缺失时传 `null`；Pro 档保持 `env || undefined`（回退硬编码 Pro 计划）。
- `lib/vertical.ts` — `planId` 类型放宽为 `string | null`。

### 高危 8：客户端打服务端 SDK
- `app/dashboard/quotes/[id]/page.tsx` — 删除 `import { sendEmail } from '@/lib/resend'`；"Send to customer" 改调 `POST /api/quotes/[id]/scope-send`；"Mark deposit as paid" 改调 `POST /api/quotes/[id]/deposit`。
- `app/api/quotes/[id]/scope-send/route.ts`（新增）— 服务端代发 change order 邮件：登录 + 报价归属 + 变更归属三重校验后发送，标记 sent，并**补写 messages 记录**（旧逻辑漏了，scope 邮件不出现在 Conversation 时间线）。
- `app/api/quotes/[id]/deposit/route.ts`（新增）— 服务端标记定金已付 + 发确认邮件；**幂等**（已支付重复点击不重发信）。

### 高危 9：月报查不存在的列
- `app/api/cron/monthly-report/route.ts` — ① `quotes.paid_at` → `updated_at`（quotes 表无 paid_at，成交额恒 0 的根因）；② `messages.account_id/sent_at` → `quotes!inner(account_id)` 嵌入过滤 + `created_at`（跟进数恒 0 的根因）；③ 收件人从 `followup_email`（所有账号默认都是共享收件箱 follow@voxalo.top）改为**账号所有者邮箱**——否则月报会被 Email Routing 转回入站 webhook 解析成"新报价"，制造垃圾数据（反馈回环，顺带修复）。

### 中危 1：reminders cron
- `app/api/cron/reminders/route.ts` — PostgREST `or` 过滤器里的 `lt.7d` 不是合法值（必然 400，cron 从未成功过），改为 ISO 时间戳。
- `vercel.json` — 注册 `/api/cron/reminders`（每日 15:00 UTC）。

### 中危 2：followups cron 无幂等
- `app/api/cron/followups/route.ts` — 发信前增加原子抢占（CAS）：`update next_followup_at=抢占值 where id=? and next_followup_at=原值`，抢不到行即跳过。cron 重叠运行/手动补跑不会重复发信；发送失败 30 分钟窗口后次日自然重试。

### 中危 3：RLS UPDATE 缺 WITH CHECK
- `supabase/migrations/016_rls_update_with_check.sql`（新增）— quotes / accounts / scope_changes / clients 四张表的 UPDATE 策略补 `WITH CHECK`，堵住"UPDATE 把行改到别人账号下"的越权转移。**需在 Supabase SQL Editor 执行。**

### 中危 4：slack_webhook SSRF
- `lib/slack.ts`（新增）— `isSafeSlackWebhook()`：只允许 `https://hooks.slack.com`（含子域）。
- `app/api/webhooks/inbound/route.ts` — 发送 Slack 通知前校验 URL。
- `app/api/account/route.ts` — 设置页保存 `slack_webhook` 时即校验，非法 URL 返回 400（保存时就拦，不等发送时）。

### 中危 5：CSV 公式注入
- `lib/csv.ts`（新增）— `csvCell()`：双引号转义 + `= + - @`/制表符/回车开头的单元格前置单引号。
- `app/api/export/route.ts` — 三段 CSV 全部换用 `csvCell`；**顺带修了导出坏掉的问题**：旧代码 select 了不存在的列（`quotes.sent_at/paid_at`、`messages.type/status/sent_at`、`scope_changes.amount`——真实列名是 `additional_amount`），PostgREST 直接 400，导出整体不可用。
- `lib/export.ts`（死代码，一并修正）— 同样换 `csvCell` + 去掉不存在的列 + `direction` 用真实值 `'in'/'out'`。

### 中危 6："unpaid" 误命中付款关键词
- `app/api/webhooks/inbound/route.ts` — 关键词判定前先剥离否定语义（`unpaid / not paid / never paid / 未付款 / 不付款…`），再用词边界正则匹配；`stop` 等英文关键词也改为整词匹配（旧 `includes('stop')` 会命中 "stopped" 之类）。

---

## 三、行为变化（测试时别慌）

1. Early Bird / Yearly 环境变量没配时，首页对应按钮显示红色"配置错误"——**这是故意的**，补上环境变量即恢复。
2. `/api/user/referral-code` 未登录调用返回 401（以前是谁能调谁改）。
3. `/api/signup` 无会话 + 账号行已存在时返回 `{ok:true, skipped:true}`（幂等，不再覆盖他人行）。
4. "Mark deposit as paid" 连点第二次不会重发确认邮件。
5. scope change 邮件现在会出现在报价详情页 Conversation 时间线里。
6. 月报收件人变成注册邮箱（不再是 follow@voxalo.top）。
7. cron 接口在 CRON_SECRET 缺失时全部 401——Vercel Cron 会自动带密钥，不受影响；手动调用要带 `Authorization: Bearer <CRON_SECRET>`。

## 四、验证状态

- `node_modules/.bin/tsc --noEmit` ✅ 通过（无错误）
- 客户端组件对 `lib/resend` 的引用数：**0**（仅 9 个服务端 API 路由引用）
- 未执行 `npm run build`（按分工留给你跑）；未 commit、未 push
