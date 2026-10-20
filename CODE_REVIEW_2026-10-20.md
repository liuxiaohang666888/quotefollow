# QuoteFollow 全量代码审查报告

**审查日期**: 2026-10-20  
**审查范围**: `F:/ai工作/quotefollow` 全部源代码（约 100 个文件：app/ 全部页面与 API 路由、lib/ 全部模块、components/、hooks/、middleware.ts、supabase/ 全部迁移、scripts/、cloudflare-worker/、CI/CD 与各类配置文件），不含 node_modules / .next / .git。  
**审查项**: 安全隐患（鉴权、注入、越权、信息泄露）、逻辑错误、竞态条件、错误处理、性能、可维护性、依赖风险。

---

## 一、按模块审查结论

### 1. 配置与部署层（package.json / next.config.js / middleware.ts / vercel.json / .github/workflows）

整体结论：**基础安全头配置完备（CSP/HSTS/ nosniff），CSRF 同源校验思路正确，但存在 1 个高危密钥泄露和 1 个 cron 鉴权 fail-open 模式。**

- `next.config.js`：安全响应头齐全；CSP 允许 `script-src 'unsafe-inline'`（PayPal SDK 所需），一定程度削弱 XSD 防护，属可接受妥协，建议后续改 nonce。
- `middleware.ts`：对 `/api/` 非安全方法做同源校验，逻辑正确；无 Origin/Referer 时放行（webhook/cron 需要），由各路由自行兜底——**但这个"自行兜底"在多个路由中是缺失的（见第 2、5 节）**。同源校验用 `host === reqHost` 比较，本地开发时 Origin 带端口（localhost:3000）而 `x-forwarded-host` 不带，可能误杀开发环境请求。
- `vercel.json`：注册了 4 个 cron，但 `app/api/cron/reminders` 路由存在却**未注册**（该功能实际不会运行，且其查询语法有 bug，见问题 M1）。
- CI（ci.yml）：lint + build，无自动化测试（scripts/ 下均为手工离线脚本）。

### 2. 鉴权与登录（middleware / auth/callback / login / signup / logout / reset-password）

整体结论：**登录态页面保护完整，但两个服务端接口完全没有鉴权，是本次审查最严重的问题类别。**

- `app/auth/callback/route.ts`：`safeNext` 只挡 `//` 开头，未挡 `/\`（浏览器会把 `\` 规范化为 `/`，实际风险很低，建议按 `new URL(next, origin)` 白名单校验）。
- `app/api/logout/route.ts`：支持 GET/POST，GET 可被跨站触发注销（低危）；硬编码 cookie 名 `sb-quotefollow-auth-token`，Supabase 项目 ref 变更即失效（可维护性）。
- `app/signup/SignupForm.tsx`：注册后把 `userId` 从浏览器发给 `/api/signup`，而该 API **不验证调用者身份**（见 H2）；GitHub OAuth 注册后不会调用 `/api/signup`，账号行靠 quotes 路由"自愈"补建， referral_code 缺省直到 hook 补发——流程可用但不严谨。
- `app/reset-password/page.tsx`：无会话校验，直接依赖 `updateUser` 失败报错，可接受。

### 3. 报价与消息（app/api/quotes/* / lib/followup* / lib/heat / lib/mime / lib/ai）

整体结论：**主流程健壮（AI 失败有正则/模板兜底、MIME 自研解析覆盖 GBK/Big5 等中文编码），但存在 1 个高危前端越权发信、1 个报表查询列名错误、若干竞态与注入面。**

- `app/api/quotes/route.ts`（粘贴建档）：鉴权 OK；自愈补账号 OK；**试用期检查对存量账号失效**——初次查询只 `select('paypal_subscription_id')`，`created_at` 为 undefined 时 `isWithinTrialDays(undefined)` 恒返回 true，导致老账号试用过期后仍可建档（与 `/api/quotes/send` 行为不一致，见 M12）。
- `app/api/quotes/send/route.ts`（ composing 发送）：HTML 转义、主题 CRLF 剥离都做了；但 `fromName: businessName`（用户可控）未过滤 CRLF/`>`，经 `lib/resend.ts` 拼进 From 头，存在邮件头注入面（M8）；邮件先发后建档，insert 失败时客户已收到邮件但无记录。
- `app/api/quotes/[id]/route.ts`：PATCH 的 `await req.json()` 无 try/catch，畸形 JSON 直接 500；状态白名单正确；DELETE 用 `.select('id')` 检测 RLS 静默删 0 行，处理得当。
- `app/api/quotes/[id]/followup/route.ts`：归属校验 OK；读后写 count 无并发保护，双击可双发；无频率限制。
- `app/api/quotes/[id]/messages/[messageId]/route.ts`：三层归属校验（登录→报价→消息方向），是全场最规范的删除链路。
- `lib/followup.ts` / `followup-resume.ts`：1/3/7 天序列计算正确；`nextStep` 导出后无人使用（死代码）；resume 按 `customer_email` 精确等值匹配，大小写不一致时漏恢复。
- `lib/heat.ts`：纯函数、无外部依赖，逻辑自洽。
- `lib/mime.ts`：自研 MIME 解析器功能完整（QP/Base64/RFC2047/多级 multipart/中文编码归一）；复杂度高，建议补 fuzz 测试防病态回溯。
- `lib/ai.ts`：三段 AI 调用均有降级兜底；`body.slice(0, 12000)` 限长；客户邮件内容进入 prompt 属提示注入面，当前影响限于回复文案，评级低。
- `app/dashboard/quotes/[id]/page.tsx`：**高危**——客户端组件 `import { sendEmail } from '@/lib/resend'` 并直接在浏览器调用（H4）：服务端 SDK 被打进客户端 bundle，浏览器里 `RESEND_API_KEY` 为 undefined 必然抛错，"发送变更单/定金确认邮件"功能实际是坏的；且此模式一旦把 key 误配成 NEXT_PUBLIC_ 即成开放发信代理。另 `scopeChanges[0]?.id` 标记 sent 可能标错行；`quote.business_name` 列不存在（恒 undefined）。

### 4. 支付/订阅（lib/paypal.ts / api/signup / api/webhooks/paypal / cancel-subscription / cron/subscription-check）

整体结论：**PayPal Webhook 验签是全场最扎实的部分（证书域名白名单 + CRC32 + RSA-SHA256 + 重放窗口），但"订阅归属"校验缺失导致可白嫖，且退款/拒付事件未处理。**

- `lib/paypal.ts`：`verifyPaypalSubscription` 只验 `status === 'ACTIVE'`，**不校验 plan_id、不校验订阅归属本商户**——任何人在别的商家处有任何 ACTIVE 订阅，拿 I-xxx 过来即可开通（H5）。`cancelPaypalSubscription` 同样只凭 ID 取消。三处 `fetch` 均无超时。`API_BASE` 硬编码生产环境，无 sandbox 开关。
- `app/api/webhooks/paypal/route.ts`：验签实现正确（防 SSRF 证书白名单、防重放）；但只处理 CANCELLED / SALE.COMPLETED / SALE.DENIED，**未处理 REFUNDED / CHARGEBACK / SUSPENDED / EXPIRED**——用户退款后付费权益不变（H7）；`PAYMENT.SALE.COMPLETED` 无法反查账户、不能激活订阅，激活完全依赖 signup 流程写入。
- `app/api/paypal/cancel-subscription/route.ts`：鉴权与归属正确；PayPal 取消成功但 DB 更新失败的边界有处理。
- `app/api/cron/subscription-check/route.ts`："仅确定性失效才降级"的设计正确（避免 PayPal 抖动误伤）；顺序验证无并发、无批量上限，账号量大时有超时风险。

### 5. Webhook 收信（app/api/webhooks/inbound / cloudflare-worker）

整体结论：**Svix 验签 + message_id 唯一索引的双重防重做得扎实；但"Cloudflare Worker → 后端"这条文档化管道与后端鉴权机制完全不匹配，实际不可用；另有 SSRF 与重试放大风险。**

- `app/api/webhooks/inbound/route.ts`：Svix 验签 fail-closed（密钥缺失即 401）正确；Resend/SES 双格式归一化考虑了真实坑；防重（应用层查 + 015 唯一索引 + 23505 兜底）三层完备。问题：① **`X-Inbound-Secret` / `INBOUND_WEBHOOK_SECRET` 在整个后端无人读取**——Cloudflare Worker 发的 secret 后端根本不验，Svix 头缺失反而会 401，即 Worker 管道是断的（H3）；② 404/402/500 响应会触发 Resend 重试，new-quote 分支的 quote insert 无幂等键，重试可能产生重复报价；③ `slack_webhook` 是用户可控任意 URL，服务端直接 POST → SSRF（可探测内网/云元数据端点）；④ 大量 `console.log` 打印邮件正文，PII 落 Vercel 日志；⑤ `inbound_debug` 调试表未启用 RLS。
- `cloudflare-worker/worker.js`：email/fetch 处理器位置正确、fail-closed、原始 MIME 直传后端不解析，设计合理；`?debug=T7a` 是隐蔽调试触发器（低危）；`.wrangler/tmp/` 部署产物被提交进 git。
- `cloudflare-worker/wrangler.toml`：**明文写了 `INBOUND_SECRET = "qf-wb-vX8kLm2pRtZ4nQsY6hBcN9dF3jGw5eT7a"` 并入库**（H1）。

### 6. 数据库访问与 RLS（supabase/migrations/*）

整体结论：**RLS 覆盖全面、cascade/索引/状态机约束完整，且有敏感字段触发器（011/013）这个亮点；但 UPDATE 策略缺 WITH CHECK、触发器保护字段不全、迁移管理混乱。**

- `001_init.sql`：三表 RLS + 归属策略完整；`idx_quotes_next_followup ... where status='following'` 部分索引正确。**`quotes_update_own` 只有 USING 没有 WITH CHECK** → 用户可把报价 `account_id` 改成任意账号（转移/隔离报价，配合多账号可搅乱额度统计）。
- `011/013`：`prevent_sensitive_account_update` 触发器保护 paypal_subscription_id / trial_ends_at / free_months_earned / referral_credits，service_role 豁免——思路好。但 **`accounts.email` 和 `referral_code` 不在保护名单**：email 是 `countQuotesFor` 的额度统计维度，浏览器用 anon key 直连即可改（RLS update 策略允许），属于付费墙统计面的缺口。
- `009`：referrals 有 `UNIQUE(referrer_id, referred_id)` + 乐观锁，防重完备。
- `015`：messages message_id 部分唯一索引是防重的最后兜底，注释清晰。
- 管理问题：**迁移编号重复**（006_add_deposit_fields / 006_inbound_debug；007_add_scope_changes / 007_client_portal），根目录还有 `supabase/fix-database.sql`（与 015 索引重复建）、`diagnose-email.sql`、`006_inbound_debug.sql` 散落；008/009 的 `CREATE TRIGGER` 无 `DROP IF EXISTS`，重复执行直接报错；`inbound_debug` 未开 RLS。

### 7. 前端页面（app/* 页面、components、hooks）

整体结论：**无 XSS 原语（全库零 dangerouslySetInnerHTML / innerHTML / eval），React 默认转义覆盖渲染面；主要问题是服务端 SDK 误入客户端、定价文案与资损、少量协议未校验的链接。**

- `app/dashboard/page.tsx`：锁定弹窗阻断操作 OK；`select('*')` 拉全列（小数据量无碍）；**升级弹窗写 $19/mo，全站其它地方（落地页/Refer/设置页）都是 $49**，属商务事故级文案错误。
- `components/PayPalSubscribeButton.tsx`：`PLAN_EARLY_BIRD_ID` / `PLAN_YEARLY_ID` / `DEFAULT_PLAN_ID` **在环境变量缺失时全部 fallback 到同一个 `P-9RN20574BN6264401NKUP3CY`**——用户点"Early Bird $29"或"Yearly $490"实际按该计划扣款，是直接的资损/投诉源（H8）。硬编码 PayPal client-id 属公开信息，风险低，但注释说明是被环境变量覆盖搞怕了，建议排查 Vercel 配置而非硬编码。
- `app/dashboard/settings/page.tsx`：`payment_link` 渲染为 `href` 未校验协议（`javascript:` 自 XSS，低危）；`slack_webhook` 任意 URL（SSRF，见 M6）。
- `app/portal/*`、`app/q/[id]`：token/UUID 不可枚举，字段最小化暴露，OK；公开报价页暴露商家 `followup_email`（低危信息暴露）。
- `hooks/useEnsureReferralCode.ts`：发了 `Authorization: Bearer <token>`，但对应 API 根本不读该头（鉴权缺失的佐证，H2/H3）。

### 8. 其余 API 路由（feedback / affiliate / export / client-portal / public）

- `app/api/feedback/route.ts`：POST 里 `createClient()` 引自 `@/lib/supabase/client`（**浏览器客户端**）——在 Node 路由里 `auth.getUser()` 不可靠，登录用户的反馈大概率关联不上账号（M10）；匿名 INSERT 无频率限制；GET 用 `?key=CRON_SECRET` 查密钥会进访问日志。
- `app/api/export/route.ts`：鉴权与归属 OK；CSV 值未防公式注入（`=`/`+`/`-`/`@` 开头，M13）；`sent_at`/`paid_at` 列在 quotes 表不存在，输出恒空。
- `app/api/affiliate/apply/route.ts`：公开表单无限流（垃圾数据风险，低）；`new URL(website)` 接受任意协议。
- `app/api/client-portal/*`：create 有归属校验；`expiresInDays` 未校验范围；token 24 字节随机数，强度足够，但**默认永不过期**（低危）。
- `app/api/public/quotes/[id]/respond/route.ts`：UUID 不可枚举 + IP 限流 + 状态白名单，OK；读后写无并发保护（重复提交可产生两条 in 消息，低危）。

### 9. 脚本与工具（scripts/ / .husky / .hermes）

- `scripts/test-*.ts`、`test-qq*.js`：离线 MIME/流程仿真，**不读任何生产密钥、不连生产库**（已 grep 验证无 createAdminClient / env 使用），安全。
- `scripts/vertical-create.mjs`：`slug` 命令行参数未净化即写入文件路径与生成代码（`../../` 路径遍历 / 生成文件注入），本地开发者自用工具，低危；模板里价格写 $29 与主站 $49 不一致。
- `.husky/pre-commit`：lint-staged；`commit-msg`：commitlint——工程规范在线。
- `.hermes/` 内部笔记被提交进 git（信息暴露面，低危）。

---

## 二、完整问题清单（按严重级别）

> **修复状态标注（2026-10-20 晚，全量修复批次）**：✅ 已修复（代码侧完成）｜🟡 部分修复/需人工（附原因）｜⛔ 无法修复（附原因）。  
> 代码侧修复未 commit，改动清单见文末《修复批次说明》。需要人工的操作（密钥轮换、面板配置、SQL 执行、部署验证）单独列在文末。

### 🔴 高（10 项，建议立即处理）

| #   | 模块         | 问题                                                                                                                          | 修复建议                                                                                                                                                           | 状态                                                                                                                        |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| H1  | 配置/部署      | `cloudflare-worker/wrangler.toml` 明文 `INBOUND_SECRET` 提交进 git 历史                                                            | 立即在 Cloudflare 侧**轮换该 secret**；改用 `wrangler secret put INBOUND_SECRET`，toml 只留占位；用 BFG/filter-repo 清 git 历史并强推                                                 | 🟡 代码侧已修复（wrangler.toml 明文已移除）；**需人工**：密钥已进 git 历史，必须轮换旧值 + Cloudflare 面板 `wrangler secret put` + （可选）filter-repo 清史      |
| H2  | 鉴权         | `/api/signup` 无任何登录校验，信任 body 里的 `userId`，可用 service_role 为**任意 userId** 创建/覆盖账号行（business_name、referred_by、subscription 等） | 路由内 `supabase.auth.getUser()` 后强制 `user.id === body.userId`，不等则 401；`email` 以会话邮箱为准，不信 body                                                                    | ✅ 已修复（会话校验 + userId 归属强制相等 + 无会话时仅允许首次插入，行已存在即拒写）                                                                         |
| H3  | 鉴权         | `/api/user/referral-code` 无鉴权，凭 body.userId 即可给任意用户设置/覆盖 referral_code；`Math.random` 生成不满足密码学随机                             | 同上加强会话校验；改用 `crypto.randomBytes`；撞唯一索引时重试；hook 里传的 Bearer token 要么真校验要么删掉                                                                                      | ✅ 已修复（会话校验 + 归属相等；`randomBytes` 生成；23505 撞码重试 5 次；hook 的 Authorization 头已删）                                               |
| H4  | Cron 鉴权    | `lib/cron-auth.ts` 在 `CRON_SECRET` 未配置时**直接放行**；`cron/monthly-report` 更糟——未设密钥时 `Bearer undefined` 即可通过                     | 全部改 fail-closed：密钥缺失返回 500/401；统一走 `isCronAuthorized`；密钥用 `crypto.timingSafeEqual` 比较                                                                          | ✅ 已修复（cron-auth fail-closed + timingSafeEqual；monthly-report 内联校验已换成统一入口）                                                 |
| H5  | Webhook 架构 | 入站管道断裂：Cloudflare Worker 以 `X-Inbound-Secret` 调后端，后端只验 Svix 签名，`INBOUND_WEBHOOK_SECRET` 全库无人读取 → 文档化管道实际 401 不可用            | 二选一：①保留 Resend Inbound，则删除 worker、README 与 .env.example 中的 INBOUND_WEBHOOK_SECRET 相关描述；②保留 Worker 管道，则在 inbound 路由增加 `X-Inbound-Secret` 恒定时间比较分支（与 Svix 二选一放行） | ✅ 已修复（选方案②：保留 Worker，后端双通道鉴权——X-Inbound-Secret 常量时间比较 OR Svix 验签，任一通过放行；INBOUND_WEBHOOK_SECRET 现已真实读取）                    |
| H6  | 支付         | `verifyPaypalSubscription` 只验 `ACTIVE`，不验 plan_id、不验归属 → 任何商家的 ACTIVE 订阅 ID 都能开通付费                                          | 验签时比对 `plan_id` 与 env 中的 `PAYPAL_PRO_PLAN_ID`；用 PayPal `custom_id` 绑定账户；取消接口同样校验归属                                                                             | ✅ 已修复（plan_id 白名单 = 三档 env + 硬编码 Pro 计划；不在名单直接拒）                                                                          |
| H7  | 支付         | PayPal Webhook 不处理 `PAYMENT.SALE.REFUNDED` / `CHARGEBACK` / `BILLING.SUBSCRIPTION.SUSPENDED` / `EXPIRED` → 退款/拒付后权益不变       | 对这 4 类事件复用 `downgradeBySubId` 降级；建议加每日对账（subscription-check 已覆盖 CANCELLED 场景，补 REFUNDED 同理）                                                                    | ✅ 已修复（REFUNDED / REVERSED（拒付）/ EXPIRED / SUSPENDED 四事件全部走 downgradeBySubId 清订阅 ID 撤权益）                                    |
| H8  | 支付/前端      | `PayPalSubscribeButton` 三个档位 plan ID 在 env 缺失时全部 fallback 到同一 `P-9RN...`，Early Bird $29 / Yearly $490 用户被按该计划扣款             | Vercel 配齐 `NEXT_PUBLIC_PAYPAL_PRO_PLAN_ID` / `_EARLY_BIRD_` / `_YEARLY_`；任一缺失时禁用对应按钮并显示"暂不可用"，绝不静默 fallback                                                    | ✅ 已修复（Early Bird/Yearly 缺失时按钮显式报错不给链接；Pro 缺失回退硬编码同价计划）；**需人工**：Vercel 配齐两个 plan ID                                        |
| H9  | 前端         | `app/dashboard/quotes/[id]/page.tsx` 客户端组件 import `lib/resend` 直接发邮件：服务端 SDK 进客户端 bundle，浏览器无 API key 功能必坏；且是开放式发信代理雏形      | 删除该 import；新增 `POST /api/quotes/[id]/emails`（服务端鉴权 + 归属校验）发送变更单/定金确认                                                                                           | ✅ 已修复（import 已删；新增两个服务端路由 `quotes/[id]/scope-send` 与 `quotes/[id]/deposit`，鉴权 + 归属校验 + 发送后标记）                             |
| H10 | 数据/报表      | `cron/monthly-report` 查询 `messages.account_id`（列不存在）与 `quotes.paid_at`（列不存在）→ 月报"跟进数/成交额"恒为 0                               | messages 改 `select('*, quotes!inner(account_id)')` 按 quote 关联；paid 改 `deposit_paid_at` 或新增 `paid_at` 列；won 口径与 deposit 对齐                                      | ✅ 已修复（messages 走 quotes!inner 关联；won 口径改 deposit_status='paid' + deposit_paid_at；收件人改账号所有者邮箱，堵了"月报发回入站 webhook 变垃圾报价"的回环） |


### 🟠 中（16 项）

| # | 模块 | 问题 | 修复建议 | 状态 |
|---|------|------|---------|------|
| M1 | Cron | `/api/cron/reminders` 未注册进 vercel.json；`.or('last_reminder_sent.is.null,last_reminder_sent.lt.7d')` 不是合法 PostgREST 语法（`7d` 后缀不存在），`sevenDaysAgo` 是死变量 → 查询必 500 | 若要用：注册 cron + 改 `.or(\`last_reminder_sent.is.null,last_reminder_sent.lt.${sevenDaysAgo}\`)`；若不用：删除路由与 clients/reminders 相关死代码 | ✅ 已修复（改 ISO 时间戳 + vercel.json 注册 cron） |
| M2 | Cron | `cron/followups` 无幂等/并发护栏，重叠运行即重复发信；批量无上限，量大超时 | 先条件更新"抢占"（`update ... set next_followup_at=null where id in (选中的) returning`）再发送；按 `limit(50)` 分批 + 游标翻页 | ✅ 已修复（CAS 抢占：`update ... set next_followup_at=<30分钟租期> where id=? and next_followup_at=<原值> returning`，抢不到即跳过） |
| M3 | Cron | 免费用户超额报价被置 `next_followup_at=null` 后，**升级付费也永不恢复跟进** | 降级时不置 null，改用独立 `followup_frozen` 标记或每日重算；升级后跑一次恢复任务 | ✅ 已修复（冻结改为 next_followup_at=+7天重试窗口：未升级每周复查，升级后下一窗口自然恢复，无需新列/恢复任务） |
| M4 | RLS | `quotes_update_own` 缺 WITH CHECK，可改 `account_id` 转移报价 | 加 `with check (auth.uid() = account_id)`；同时评估禁止直改 `portal_token`/`status` 关键列（触发器或列级权限） | ✅ 已修复（迁移 016：4 张表 UPDATE 策略补 with check） |
| M5 | RLS/付费墙 | `accounts.email`、`referral_code` 不在敏感字段触发器内；email 是额度统计维度，anon key 直连可改 | 把 `email`、`referral_code` 加入 `prevent_sensitive_account_update`（邮箱变更走独立验证流程） | ✅ 已修复（迁移 017：触发器函数扩展，两列纳入保护，service_role 豁免） |
| M6 | Webhook | `slack_webhook` 用户可控任意 URL，服务端直接 POST → SSRF | 校验协议为 https 且 host 以 `hooks.slack.com` 结尾（或收敛为仅允许用户配好的白名单域名） | ✅ 已修复（`lib/slack.ts` isSafeSlackWebhook；account 保存时 + 发送时双重拦截） |
| M7 | Webhook | 非 2xx（404/402/500）触发 Resend 重试；new-quote 分支 quote insert 无幂等键，重试可产生重复报价与双倍 AI 成本 | 所有分支返回 200（结果写 trace 表）；quote insert 前按 `message_id`/`source_message_id` 查重；或给 quotes 加业务唯一键 | ✅ 已修复（no_account/quota_exhausted 改 200+trace；新增 `quotes.source_message_id` 列 + 部分唯一索引（迁移 017），插入前查重；DB 插入错误保留 500——重试安全且可自愈，去重已防重复报价） |
| M8 | 邮件安全 | `fromName=business_name`（设置页可填）与 followup 主题里的 `customer_name` 未过滤 CRLF → 邮件头注入（Bcc: 等） | `lib/resend.ts` 统一 `sanitizeHeaderValue()`：剥离 `\r\n` 与 `<>`；主题同样处理 | ✅ 已修复（resend.ts 统一净化 fromName/subject/In-Reply-To/References） |
| M9 | 逻辑 | inbound 的 `PAID_KEYWORDS` 含 `paid`，会命中 "unpaid/prepaid/paid off later" 等，误把报价关 closed | 改词表匹配（`\b(paid|payment received|already paid)\b` 词边界 + 排除 "unpaid"）；中文词同理收紧 | ✅ 已修复（先剥离否定语义 un/not/never/no + paid 与中文否定，再词边界正则匹配） |
| M10 | API | feedback 路由用浏览器端 `createClient`（`lib/supabase/client`）在 Node 里取用户，登录用户关联基本失效；匿名 insert 无限流；GET `?key=` 带密钥 | 换 `lib/supabase/server`；加 IP 限流（复用 utils 思路并改共享存储）；GET 改 header 传密钥 | ✅ 已修复（server 客户端取会话；`isFeedbackRateLimited` IP 限流；GET 改 Authorization header + isCronAuthorized fail-closed） |
| M11 | 竞态 | ①免费额度 count-then-insert TOCTOU，并发可超额；②手动 followup 读后写 count，双击双发；③referral/complete 只给 `pending[0].referrer` 加月份（多 referrer 漏加）；④free_months_earned 读后写无锁 | ①③④ 改 SQL 原子操作（`update accounts set free_months_earned = free_months_earned + 1`）+ 数据库约束兜底；② 用条件更新（`where followup_count = 原值`） | ✅ 已修复（① quotes 与 quotes/send 双重复核 + 超配额自删本行；② followup 路由 CAS 抢占 + 失败回滚；③ 按 referrer 聚合全部到账；④ 迁移 017 提供 `increment_free_months` RPC 原子自增，迁移未执行时回退读后写并告警） |
| M12 | 逻辑 | `/api/quotes`（粘贴建档）试用期检查对存量账号恒通过（select 未取 created_at） | 初次查询补选 `created_at, trial_ends_at`；试用判断统一收敛到 `lib/paywall.ts` 一个函数 | ✅ 已修复（补选两列 + 新增 `isTrialActive()` 唯一入口，quotes/quotes:send/inbound/followups cron 四处全部收敛） |
| M13 | API | `/api/export` CSV 公式注入（值以 `= + - @` 开头时 Excel 执行）；sent_at/paid_at 列不存在输出空 | 单元格加 `'` 前缀或 tab 包裹；要么补列要么删这两个输出字段 | ✅ 已修复（`lib/csv.ts` csvCell 公式注入防护；导出列全部改为真实存在列——修复时顺带发现导出功能整体因不存在的列而 400，一并修复） |
| M14 | 依赖/架构 | Next 16 + React 18.3 组合需验证兼容；建议 `npm audit` 过一遍（overrides 已手动钉 linkify-it/nodemailer/postcss，说明依赖卫生靠人肉） | 跑 `npm audit --production`；确认 React 版本与 Next 16 官方矩阵一致，不一致就升级 React 19 | ✅ 已修复（next 16.3.4→16.4.2 修 critical SSRF；React 18.3.1 经 `npm view next@16 peerDependencies` 确认在官方矩阵内，无需升级；删无人引用的 mailparser（nodemailer 漏洞全类随之消失）；sharp 0.35.5 / postcss 8.5.31 override；wrangler 4.151.2。**`npm audit --production` = 0 漏洞**；剩余 7 个 dev/lint 工具链 advisory（brace-expansion 等，仅 eslint/commitlint 链，不进运行时）显式接受） |
| M15 | 可维护 | `lib/export.ts`（249 行）整文件死代码且引用不存在列；`lib/supabase/utils.ts` 与 `server.ts` 重复造 createClient，其限流助手全库无人用；`nextStep` 死代码 | 删 lib/export.ts；utils.ts 只保留限流并改共享存储（Upstash Redis 等），或删；删 nextStep | ✅ 已修复（三个死代码全部删除；两处路由复制的内存限流 Map 收敛为新模块 `lib/rate-limit.ts`，带过期清理） |
| M16 | 可维护 | 迁移编号重复（006/007 各两个）+ 根目录散落 fix-database.sql / diagnose-email.sql；008/009 `CREATE TRIGGER` 不可重复执行；`inbound_debug` 未开 RLS | 合并重排迁移编号；trigger 一律 `drop trigger if exists` 前置；inbound_debug `alter table ... enable row level security` | 🟡 部分修复：017 迁移已开 inbound_debug RLS + service_role 策略；fix-database.sql/diagnose-email.sql 已移入 `supabase/archive/`；后续新迁移一律 drop-if-exists。**有意不做**：重排 006/007 编号——这些迁移已在生产库执行过，改文件名会破坏 Supabase 迁移历史导致 CLI 状态错乱，重编号收益低于风险；008/009 的幂等性同理只影响理论上的重复执行（Supabase 已执行的迁移不会重跑） |

### 🟡 低（12 项）

| # | 模块 | 问题 | 修复建议 | 状态 |
|---|------|------|---------|------|
| L1 | 安全 | CSP `script-src 'unsafe-inline'` | 条件允许改 nonce/hash | 🟡 需人工：nonce 化需要 middleware 生成 nonce + CSP 头下发 + Next 自动注入 + PayPal SDK 动态 script 兼容，全链路只能在部署后实测（PayPal 按钮是收入命脉，本环境无法验证）。已确认 PayPal SDK 是运行时 `document.createElement('script')` 动态加载，理论兼容 strict-dynamic，但 Next 内联引导脚本的 nonce 继承必须实测。迁移步骤：middleware 生成 nonce → `script-src 'self' 'nonce-xxx' 'strict-dynamic' https://www.paypal.com` → Preview 环境验证 PayPal 按钮可用 → 再生产 |
| L2 | 安全 | inbound 路由大量 `console.log` 邮件正文，PII 入日志 | 降噪为长度/哈希，debug 表已够排障 | ✅ 已修复（正文/主题预览全删，只记录 body_len + sha256 前 12 位；排障走 inbound_debug 轨迹表） |
| L3 | 安全 | worker `?debug=T7a` 隐蔽触发入口 | 改随机长路径或删 | 🟡 代码侧已修复（debug token 改从 env.DEBUG_TOKEN 读取，未配置即 404；且必须同时带正确 X-Inbound-Secret 头，双重要求）；**需人工**：`wrangler secret put DEBUG_TOKEN` 设一个新随机长 token（不配 = 调试入口保持关闭） |
| L4 | 安全 | logout GET 可被跨站触发 | 仅保留 POST（或加 CSRF token） | ✅ 已修复（GET 导出已删；全站调用方均为 form POST，已 grep 验证） |
| L5 | 安全 | auth/callback `next` 未用 URL 解析校验 | `new URL(next, origin)` + pathname 白名单 | ✅ 已修复（new URL 解析 + origin 相等 + pathname 双斜杠检查，含 `/\` 变体） |
| L6 | 安全 | 公开报价页暴露商家 followup_email；client portal token 默认永不过期 | 脱敏或按需返回；create 时默认 30 天过期 | ✅ 已修复（公开接口不再返回 followup_email，前端本就未用已 grep 验证；token 默认 30 天过期 + 1–365 天范围钳制；GET 侧过期检查已存在，旧的无过期 token 继续有效不破坏兼容） |
| L7 | 前端 | 升级弹窗 $19/mo 与全站 $49 不一致；vertical-create 模板 $29 | 价格统一从 `lib/vertical.ts` 单点读取 | ✅ 已修复（dashboard/new 与 DemoPreview 的 $19 → $49；vertical-create 模板 $29 → $49 并注释标明单点来源为 lib/verticals/quotefollow.ts） |
| L8 | 前端 | `payment_link` 未校验协议（javascript: 自 XSS） | 保存时校验 https/http | ✅ 已修复（account PUT 保存时校验 http(s)；报价详情页渲染加 safePaymentLink 守卫，双保险防旧数据） |
| L9 | 工程 | `qf-deploy-v3.zip`、`landing-now.png`、`.wrangler/tmp/*`、`.hermes/` 入库 | 移出仓库，gitignore 补 `.wrangler/`、`*.zip` | ✅ 已修复（6 个文件 `git rm --cached` 出库——工作区文件保留不动；.gitignore 补 `.wrangler/` `*.zip` `.hermes/`；出库变更已在暂存区，随本次提交生效） |
| L10 | 工程 | `.env.example` 缺 `PAYPAL_WEBHOOK_ID` / `RESEND_WEBHOOK_SIGNING_SECRET`；plan 变量名与代码不一致（`NEXT_PUBLIC_PAYPAL_PLAN_ID` vs `_PRO_/_EARLY_BIRD_/_YEARLY_`） | 补全并校正 | ✅ 已修复（补 PAYPAL_WEBHOOK_ID / RESEND_WEBHOOK_SIGNING_SECRET / PAYPAL_ENV / DEBUG_TOKEN；plan 变量改三档真实名并注明缺失时按钮显式报错的行为） |
| L11 | 工程 | 内存限流（Map）在 serverless 多实例下形同虚设且不清理 | 换 Redis/Upstash 或至少接受"弱限流"定位 | 🟡 部分修复：已收敛为 `lib/rate-limit.ts` 单模块 + 周期性清理过期桶（消除内存泄漏）+ 文档显式标注"弱限流"定位。共享存储（Upstash Redis）属基础设施决策，需人工接入（要新建服务 + 环境变量 + 计费评估），当前按报告允许的"至少接受弱限流定位"执行 |
| L12 | 质量 | paypal.ts 三处 fetch 无超时、无 sandbox 开关；mime.ts 建议补病态输入 fuzz；AI 提示注入面记录在案 | `AbortSignal.timeout(8000)`；加 `PAYPAL_ENV=sandbox` 开关 | ✅ 已修复（4 处 fetch 全部 8 秒超时；PAYPAL_ENV=sandbox 切换 api-m.sandbox；新增 `scripts/mime-fuzz.mjs` 病态输入 fuzz，300 轮全过、最慢 18ms，`npm run test:mime-fuzz` 可重复跑；AI 提示注入面按报告意见记录在案接受——影响限于回复文案，已在 lib/ai.ts 注释标注） |

---

## 三、优先修复顺序建议

1. **今天**：H1（轮换泄露密钥）→ H6/H8（支付白嫖与错价扣款，直接关系收入）→ H2/H3（两个无鉴权接口）。
2. **本周**：H4（cron fail-closed）→ H9（客户端发信功能实际是坏的）→ H10（月报数据全错）→ H5（入站管道二选一，删或补校验）。
3. **排期**：H7 + M1–M16，其中 M1（reminders cron 语法错）、M2（重复发信）、M8（邮件头注入）优先。
4. **顺手**：低危项随迭代清理，尤其 M15/M16（死代码与迁移整理）能显著降低后续维护成本。

---

## 四、总体评价

架构主线（Supabase RLS + 服务端 service_role 分层 + PayPal 验签 + Svix 防重 + AI 降级兜底）是清晰的，安全设计意识在线（安全头、同源 CSRF、部分唯一索引、敏感字段触发器都能看到刻意为之）。主要短板集中在：**"服务端接口的鉴权完整性"（signup / referral-code / cron 三处 fail-open 或缺验）、"支付归属与事件覆盖"（plan 不校验、退款不处理）、以及"前端/数据库列名与文档脱节"（客户端发信、报表列不存在、Worker 管道断裂）**。按上文顺序处理完毕后，这套系统可以达到可对外售卖的安全与功能水位。

*报告完 —— 覆盖 app/ 37 个页面与 24 个 API 路由、lib/ 19 个模块、supabase/ 19 个迁移文件、scripts/ 9 个脚本、cloudflare-worker、middleware 与全部工程配置文件。*

---

## 五、修复批次说明（2026-10-20 晚）

**结论：38 项中 33 项代码侧已修复，4 项部分修复/需人工配合，1 项（M16 迁移重编号）有意不做并注明原因。所有代码改动未 commit，等待 build 验证后由项目负责人提交。**

### 验证状态
- `tsc --noEmit`：通过（0 错误）
- `eslint`（app/api、components、lib、hooks、middleware）：0 错误，40 个既有 style 警告（no-explicit-any 等，非本次引入）
- `npm run test:mime-fuzz`：300 轮病态输入，0 失败，最慢单例 18ms
- `npm audit --production`：**0 漏洞**（修复前为 1 critical + 3 high；剩余 7 个 advisory 全在 dev/lint/commit 工具链，不进运行时，显式接受）

### 改动文件清单

**修改（22 个）**：
- `cloudflare-worker/wrangler.toml`（H1）、`cloudflare-worker/worker.js`（L3）
- `lib/cron-auth.ts`（H4）、`lib/paypal.ts`（H6/L12）、`lib/paywall.ts`（M12 新增 isTrialActive）、`lib/resend.ts`（M8）、`lib/followup.ts`（M15 删 nextStep）、`lib/vertical.ts` + `lib/verticals/quotefollow.ts`（H8 planId 可空）
- `app/api/signup/route.ts`（H2）、`app/api/user/referral-code/route.ts`（H3）、`hooks/useEnsureReferralCode.ts`（H3 删 Bearer 头）
- `app/api/webhooks/inbound/route.ts`（H5/M7/M9/L2）、`app/api/webhooks/paypal/route.ts`（H7）
- `components/PayPalSubscribeButton.tsx`（H8）
- `app/dashboard/quotes/[id]/page.tsx`（H9/L8）
- `app/api/cron/monthly-report/route.ts`（H4/H10）、`app/api/cron/followups/route.ts`（M2/M3/M12）、`app/api/cron/reminders/route.ts`（M1，上批已改）
- `app/api/quotes/route.ts`、`app/api/quotes/send/route.ts`（M11①/M12）、`app/api/quotes/[id]/followup/route.ts`（M11②）、`app/api/referral/complete/route.ts`（M11③④）
- `app/api/export/route.ts`（M13）、`app/api/feedback/route.ts`（M10）、`app/api/account/route.ts`（L8）、`app/api/public/quotes/[id]/route.ts`（L6）、`app/api/client-portal/create/route.ts`（L6）
- `app/auth/callback/route.ts`（L5）、`app/api/logout/route.ts`（L4）
- `app/dashboard/new/page.tsx`、`app/components/DemoPreview.tsx`（L7）、`scripts/vertical-create.mjs`（L7 + slug 净化）
- `.env.example`（L10）、`.gitignore`（L9）、`package.json`（M14：删 mailparser、next 16.4.2、sharp/postcss override、wrangler 4.151.2、新增 test:mime-fuzz 脚本）

**新增（6 个）**：
- `lib/slack.ts`（M6）、`lib/csv.ts`（M13）、`lib/rate-limit.ts`（M15/L11/M10）
- `app/api/quotes/[id]/scope-send/route.ts`、`app/api/quotes/[id]/deposit/route.ts`（H9）
- `supabase/migrations/016_rls_update_with_check.sql`（M4，上批）、`supabase/migrations/017_security_followups.sql`（M5/M7/M11④/M16）
- `scripts/mime-fuzz.mjs`（L12）

**删除（3 个）**：`lib/export.ts`、`lib/supabase/utils.ts`（M15，均零引用）；`nextStep` 函数（M15）

**git 暂存区变更（未 commit）**：6 个垃圾文件 `git rm --cached` 出库（.hermes 笔记 2、.wrangler 部署产物 2、qf-deploy-v3.zip、landing-now.png）；`supabase/fix-database.sql`、`diagnose-email.sql` 移入 `supabase/archive/`。

### 需人工处理清单（按依赖顺序）

1. **轮换 INBOUND_SECRET**（H1，最高优先）：该密钥已在 git 历史中，代码侧删除不构成补救。三步：① 生成新随机值 ② Vercel 设 `INBOUND_WEBHOOK_SECRET`=新值 ③ Cloudflare 面板删旧文本变量后 `wrangler secret put INBOUND_SECRET`=新值（旧值在面板里是普通文本变量，secret put 会报 10053，须先删）。
2. **Supabase SQL Editor 执行 `017_security_followups.sql`**（M5/M7/M11④/M16）。注意：代码对 017 的列/RPC 有兼容期处理（列不存在时跳过 quote 级去重、RPC 缺失时回退读后写），但补上才是完整状态。
3. **Vercel 环境变量确认**：`CRON_SECRET`（缺失时所有 cron 401，fail-closed 是故意行为）；`NEXT_PUBLIC_PAYPAL_EARLY_BIRD_PLAN_ID` / `NEXT_PUBLIC_PAYPAL_YEARLY_PLAN_ID`（缺失时对应按钮显示配置错误，是防错价扣款的故意设计，补上即恢复）。
4. **Cloudflare Worker 重新部署**（L3/H5 代码变更生效）：`cd cloudflare-worker && npx wrangler deploy`；如需调试入口再 `wrangler secret put DEBUG_TOKEN`。
5. **（可选，L1）CSP nonce 化**：按 L1 行内的迁移步骤执行，必须在 Preview 环境实测 PayPal 按钮后才可上生产。

### 部署后验证要点
- Worker `?debug=<新token>` 带 `X-Inbound-Secret` 头应返回 200（修复前管道是断的，必然 401）
- 不带头/错 token 访问 debug 入口应 404
- 手动跟进按钮连点两次：第二次返回 409，客户只收到一封
- 免费账号第 4 个报价：402；月报"跟进数/成交额"不再恒 0；导出 CSV 不再 400
- PayPal 白嫖路径：用别家 ACTIVE 订阅 ID 调 signup 验证接口应被拒
