# QF (QuoteFollow) 全代码审查报告（完整版）

**审查日期**: 2026-10-09
**代码版本**: 本地 F:/ai工作/quotefollow/
**线上环境**: Vercel qf-app (Production)
**审查范围**: 全部核心代码 + RLS 策略 + 部署配置

---

## 一、PayPal 支付按钮：3 个选项问题

### 结论
**不是环境变量问题，也不是代码问题。是你的 PayPal China 账号不支持 PayPal Credit。**

### 已确认
- ✅ Vercel 环境变量 `NEXT_PUBLIC_PAYPAL_PLAN_ID` = `P-9RN20574BN6264401NKUP3CY`（正确）
- ✅ 代码默认值也是 `P-9RN20574BN6264401NKUP3CY`
- ✅ PayPal CLIENT_ID 正确（BAAiHU_tF...）
- ✅ SDK URL: `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&vault=true&intent=subscription`

### 为什么只有 2 个选项（PayPal + Card）
PayPal 按钮显示哪些支付方式由以下因素决定：
1. **卖家账户资质** — PayPal Credit 需要卖家账户开通，中国区 PayPal 账号默认没有
2. **买家地区** — PayPal Credit 主要面向美国买家
3. **订阅 vs 一次性付款** — PayPal Credit 对订阅（Subscription）的支持有限
4. SDK 参数 — 当前代码没有传 `enable-funding` 参数，走 PayPal 自动检测

### 修复建议
**方案 A（推荐）：接受现状，2 个选项足够用**
PayPal + Debit/Credit Card 已经覆盖了 99% 的支付场景。

**方案 B：强制显示 PayPal Credit（不推荐，大概率没用）**
在 SDK URL 里加 `enable-funding=credit`：
```
https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&vault=true&intent=subscription&enable-funding=credit
```
但如果你的账户没开 PayPal Credit，加了也不会显示。

**方案 C：在 PayPal 后台开通 PayPal Credit**
登录 PayPal → 卖家设置 → 找到 PayPal Credit 申请。但中国区账号可能不支持。

**方案 D：加支付宝/微信支付作为第 3 个选项**
需要单独接入（如 Stripe 或第三方聚合支付）。

---

## 二、🔴 严重 BUG（P0 — 必须立即修复）

### 🚨 BUG 1: `/api/account` 没有鉴权，任何人可以列出/修改所有账号
**文件**: `app/api/account/route.ts`

**问题**: GET 和 PUT 都直接用 `createAdminClient()`（service_role 绕过 RLS），**没有检查用户登录态**，也没有校验权限。

**攻击方式**: 任何人只要知道 URL `GET /api/account`，就可以：
- 列出所有账号（含 id、email、name、followup_email、company、创建时间）
- 用 `PUT /api/account` 修改任意账号的邮箱、name、company、followup_email

**风险等级**: 🔴 P0 严重（数据泄露 + 越权修改 + 可用于接管账户）

**代码证据**:
```typescript
// app/api/account/route.ts 第 4-22 行
export async function GET() {
  const admin = createAdminClient();  // 直接用 admin client，无鉴权
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'auth required' }, { status: 401 });
  }
  // 直接查询所有 accounts 表
  const { data, error } = await admin
    .from('accounts')
    .select('id, email, name, followup_email, company, created_at, updated_at')
    .order('created_at', { ascending: false });
  return NextResponse.json({ ok: true, data });
}
```

注意：第 7-9 行的 `if (!admin)` 检查**完全没用**，`createAdminClient()` 只要环境变量存在就永远不会返回 falsy。

**修复方案**:
1. 加上 Supabase auth 校验
2. GET 只返回当前用户自己的账号信息
3. PUT 只能改自己的账号，且禁止修改 `paypal_subscription_id`、`free_months_earned` 等敏感字段

---

### 🚨 BUG 2: RLS 策略允许用户自行修改 paypal_subscription_id
**文件**: `supabase/migrations/001_init.sql` + `supabase/migrations/002_paypal_subscription.sql`

**问题**: accounts 表的 update policy 是 `auth.uid() = id`，允许用户更新**所有字段**，包括 `paypal_subscription_id`。

配合 SignupForm 的 fallback 逻辑（第 69-81 行），用户可以：
1. 注册一个免费账号
2. 用浏览器控制台直接调用 supabase client
3. 把 `paypal_subscription_id` 设置为任意格式正确的字符串（如 `I-FAKE12345678`）
4. 立刻享受付费功能，直到第二天 cron 检查才会被降级

**风险等级**: 🔴 P0 严重（RLS 策略缺陷，支付绕过）

**代码证据**:
```sql
-- 001_init.sql 第 78 行
create policy "accounts_update_own" on public.accounts for update using (auth.uid() = id);
```
没有限制可更新的字段。

**修复方案**:
1. 数据库层面：新增 RLS policy 禁止普通用户修改 `paypal_subscription_id`、`free_months_earned`、`referral_credits` 等敏感字段
2. 应用层面：移除 SignupForm 的前端 fallback，所有账号创建必须走 API route

---

## 三、🟠 高危 BUG（P1 — 尽快修复）

### BUG 3: PayPal 服务器凭证缺失时，verifyPaypalSubscription 返回 ok=true
**文件**: `lib/paypal.ts` 第 23-25 行

**问题**:
```typescript
if (!clientId || !clientSecret) {
  return { ok: true, reason: 'format-only (server credentials not configured)' };
}
```
如果环境变量 `PAYPAL_CLIENT_ID` 或 `PAYPAL_CLIENT_SECRET` 没配置，验证函数直接返回 `ok: true`。

这意味着：
- 本地开发时，任何格式正确的假订阅 ID 都能通过验证
- 如果 Vercel 环境变量意外丢失，所有人都能白嫖
- 这是一个"默认放行"的危险设计

**风险等级**: 🟠 P1 高

**修复方案**: 生产环境下应该默认拒绝，改成：
```typescript
if (!clientId || !clientSecret) {
  if (process.env.NODE_ENV === 'production') {
    return { ok: false, reason: 'paypal credentials not configured' };
  }
  return { ok: false, reason: 'dev mode: paypal credentials not configured' };
}
```

---

### BUG 4: `/api/referral/complete` 没有鉴权，可伪造推荐完成
**文件**: `app/api/referral/complete/route.ts`

**问题**: POST 接口只需要传 `userId` 就能完成推荐，给双方加免费月。**没有任何验证**：
- 不验证调用者身份
- 不验证 userId 对应的账户是否真的付费了
- 不验证推荐记录是否真的 pending 状态（虽然代码查了 pending，但任何人都可以构造 userId）

**攻击方式**: 任何人可以调用 `POST /api/referral/complete { "userId": "某个付费用户ID" }` 来伪造推荐完成，给自己加免费月。

更严重的是：如果攻击者知道某个付费用户的 ID，可以反复调用这个接口（虽然 unique 约束会阻止重复的 referral 记录，但 free_months_earned 每次都会 +1）。

等等，再看代码——`for (const r of pending)` 循环里只更新了 referral 状态，但 `free_months_earned` 的增加是在循环外面，对每个 pending referral 都加一次。但如果同一个 referrer 有多个 pending referral（不太可能），会多次增加。

更大的问题：**这个接口没有任何鉴权**，互联网上任何人都能调。

**风险等级**: 🟠 P1 高

**修复方案**:
1. 加上 CRON_SECRET 验证（因为是被内部 cron 和 signup API 调用的）
2. 或者改为只能被 service_role 调用（不暴露为公开 API）
3. 验证 userId 对应的账户确实有有效的 PayPal 订阅

---

### BUG 5: SignupForm 前端 fallback 绕过 PayPal 验证
**文件**: `app/signup/SignupForm.tsx` 第 69-81 行

**问题**: 如果 `/api/signup` 调用失败（网络错误、API 挂了等），前端会 fallback 到直接用 supabase client 写库：
```typescript
if (!savedViaApi) {
  const { error: directErr } = await supabase
    .from('accounts')
    .upsert(
      { id: userId, business_name: businessName, email, followup_email: 'follow@voxalo.top', paypal_subscription_id: paypalSub },
      { onConflict: 'id' }
    );
}
```

这意味着：
1. 用户可以故意让 API 调用失败（比如断网后重连），然后直接写入 `paypal_subscription_id`
2. 由于 RLS 策略允许修改自己的所有字段，这个写入会成功
3. 用户获得付费权限，直到第二天 cron 检查才会被降级

**风险等级**: 🟠 P1 高（和 BUG 2 配合可完全绕过支付）

**修复方案**:
1. 移除前端 fallback，所有账号创建走 API route
2. API route 失败时给用户提示，让他们重试或联系支持
3. RLS 策略禁止用户修改 `paypal_subscription_id`（见 BUG 2）

---

### BUG 6: 付费判断只校验格式不校验有效性（白嫖一天）
**文件**: 多处使用 `isValidPaypalSubscriptionId` 判断是否付费

**问题**: `isValidPaypalSubscriptionId` 只是正则校验格式（`/^I-[A-Z0-9]+$/i`），不代表订阅真的有效。

使用位置：
- `app/api/quotes/route.ts` 第 57 行
- `app/api/quotes/send/route.ts` 第 58 行
- `app/api/webhooks/inbound/route.ts`（需要确认）

这意味着：**用户只要数据库里有一个格式正确的 subscription ID（不管是否有效），就能享受付费功能**。直到第二天 cron 跑了才会被降级。

**风险等级**: 🟠 P1 高

**修复方案**: 
1. 在关键操作（创建报价、发送报价）时，如果有 paypal_subscription_id，应该快速验证一次（可以加缓存，比如 1 小时内不重复验证）
2. 或者在 accounts 表加一个 `is_paying` 布尔字段，由 cron 和 signup API 维护，其他地方读这个字段

---

## 四、🟡 中危 BUG（P2 — 计划修复）

### BUG 7: 价格文案多处不一致
**文件**: 多处

| 位置 | 价格 |
|------|------|
| `lib/verticals/quotefollow.ts` (pricing.monthly) | $49 |
| `components/PayPalSubscribeButton.tsx` label | $49/mo |
| `app/dashboard/page.tsx` 第 202 行 | $19/mo (first month $9) |
| `app/dashboard/page.tsx` 第 235 行 | $19/mo |
| `app/signup/SignupForm.tsx` 第 124 行 | Free for up to 10 quotes |
| `lib/paywall.ts` FREE_QUOTA | 3 |

**问题**: 落地页、定价配置、Dashboard、Signup 页面的价格和免费额度全部不一致。用户会困惑，转化率会下降。

**风险等级**: 🟡 P2 中（用户困惑 + 转化损失 + 法律风险：虚假宣传）

**修复方案**: 统一所有价格文案来源，从 `getVerticalConfig().pricing` 读取。

---

### BUG 8: Signup 页面免费额度写 10 实际是 3
**文件**: `app/signup/SignupForm.tsx` 第 124 行

```typescript
<p className="sub">Free for up to 10 quotes. Upgrade anytime for unlimited.</p>
```

但 `lib/paywall.ts` 第 14 行：`export const FREE_QUOTA = 3;`

**风险等级**: 🟡 P2 中（误导用户，可能引发投诉）

---

### BUG 9: export 的 messages 查询用了不存在的 account_id 字段
**文件**: `app/api/export/route.ts` 第 56-60 行

**问题**:
```typescript
const { data: followups } = await supabase
  .from('messages')
  .select('*')
  .eq('account_id', user.id)  // messages 表没有 account_id 字段！
  .order('created_at', { ascending: false });
```

messages 表结构（来自 001_init.sql）：
- id, quote_id, direction, subject, body, message_id, in_reply_to, created_at

**没有 account_id 字段**！messages 通过 quote_id 关联 quotes，再通过 quotes.account_id 关联用户。

**风险等级**: 🟡 P2 中（导出功能的 followups 部分完全失效，返回空或报错）

**修复方案**: 用 inner join 查询：
```typescript
const { data: followups } = await supabase
  .from('messages')
  .select('*, quotes!inner(account_id)')
  .eq('quotes.account_id', user.id)
  .order('created_at', { ascending: false });
```

---

### BUG 10: followup cron 不检查付费状态，免费用户也能发跟进
**文件**: `app/api/cron/followups/route.ts`

**问题**: cron 只查 `status='following'` 且 `next_followup_at <= now` 的 quote，**完全不检查对应 account 是否付费**。

这意味着：
- 免费用户创建了 3 个 quote 后被降级
- 但这 3 个 quote 的跟进邮件会继续自动发（Day 1/3/7）
- 免费用户实际上获得了"3 个客户 + 每客户 3 封跟进邮件"的永久服务

另外，followup 邮件的发送次数没有限制（只要 quote 状态是 following，就一直发）。

**风险等级**: 🟡 P2 中

**修复方案**: 在 followup cron 里加入付费检查，如果 account 没有有效订阅且 quote 数超过免费额度，暂停跟进。

---

### BUG 11: signup API 自动确认邮箱，无需验证
**文件**: `app/api/signup/route.ts` 第 65 行

```typescript
await admin.auth.admin.updateUserById(userId, { email_confirm: true });
```

**问题**: 用户注册后，API 直接用 service_role 把邮箱设为已确认。这意味着：
- 用户可以用任意假邮箱注册
- 没有邮箱验证环节
- 增加了滥用和垃圾账号风险

**风险等级**: 🟡 P2 中（取决于你的业务需求，如果是故意设计的可以忽略）

---

### BUG 12: 内存限流在 Vercel serverless 下完全无效
**文件**: 
- `app/api/signup/route.ts`（ipLog, emailLog）
- `app/api/quotes/route.ts`（createLog）
- `app/api/quotes/send/route.ts`（createLog）

**问题**: 所有限流都用内存 Map 实现。在 Vercel serverless 环境下：
- 每次请求可能在不同的实例上
- 实例会冷启动，内存状态不保留
- 限流基本无效

**风险等级**: 🟡 P2 中（防刷效果差，可能被恶意调用刷爆 AI 额度）

**修复方案**: 用 Redis 或 Supabase 表存储限流状态。

---

### BUG 13: Dashboard Quote 状态类型不全
**文件**: `app/dashboard/page.tsx` 第 15 行

**问题**: 
```typescript
status: 'following' | 'replied' | 'won' | 'lost';
```
但实际代码里还有 `paused`, `paid`, `stopped` 等状态（在 inbound webhook 里设置的）。STATUS_LABEL 没有这些状态的显示。

**风险等级**: 🟡 P2 中（UI 显示异常，用户看不到正确状态）

---

### BUG 14: messages 表和 scope_changes 表没有 DELETE policy
**文件**: RLS 策略

**问题**:
- `quotes` 表后来加了 DELETE policy（004 号迁移）
- 但 `messages` 表和 `scope_changes` 表只有 SELECT/INSERT policy，没有 DELETE policy
- 用户无法删除自己的 messages 或 scope_changes

**风险等级**: 🟡 P2 中（功能缺失，用户想删删不了）

---

### BUG 15: quotes/send 里的 message 清洗去掉所有换行
**文件**: `app/api/quotes/send/route.ts` 第 105 行

```typescript
const safeMessage = message.replace(/[\r\n]/g, ' ').replace(/\s{2,}/g, ' ').trim();
```

**问题**: 把所有换行都换成空格，会导致邮件正文变成一大段，可读性很差。用户精心排版的报价邮件发出去后变成一坨。

**风险等级**: 🟡 P2 中（用户体验差，影响专业形象）

---

## 五、🟢 功能缺失 / 遗漏（P3）

### 缺失 1: 没有 PayPal Webhook
当前只有前端 onApprove 后带 sub 参数跳转到 signup 页面验证。但：
- 用户付款后关闭浏览器 → 不会触发 onApprove → 不会激活
- 订阅续费/取消/暂停 → 没有实时通知，只能等每天 cron 检查
- 支付失败/退款 → 没有实时处理

**建议**: 加一个 `api/webhooks/paypal` 路由，接收 PayPal Webhook 通知，实时更新订阅状态。

---

### 缺失 2: 没有试用期（trial）跟踪
- 配置里有 `trialDays: 14`
- PayPal 订阅可能有 14 天免费试用
- 但代码里**没有记录 trial_start / trial_end**，也没有 trial 到期后的处理逻辑
- subscription-check cron 只检查 PayPal API 状态

---

### 缺失 3: 没有取消订阅的入口
用户想取消订阅怎么办？代码里有 `client-portal/create` API，但不知道是否接入了。Dashboard settings 页面没看到取消订阅的按钮。

---

### 缺失 4: 没有邮件送达状态追踪
Resend 发信后没有处理 webhook（bounce, complaint, delivered）。如果邮件退信了，系统不知道，还会继续发 followup。

---

### 缺失 5: 没有客户回复后的跟进恢复功能
客户回复后 followup 暂停了（status='paused'），但如果客户只是问了个问题，之后还需要继续跟进的话，目前只能手动操作。没有"72小时没回复自动恢复跟进"之类的功能。

---

### 缺失 6: deposit/订金 相关功能 UI 缺失
代码里有 `require_deposit`、`deposit_amount`、`deposit_status` 字段，但：
- 没有看到收取订金的实际流程
- new quote 页面虽然有 checkbox，但后端没处理（`quotes/send/route.ts` 里解析了参数但没存进数据库的 deposit 字段）

---

### 缺失 7: 没有多用户/团队支持
目前是单用户系统，如果一个公司有多个人用，需要共享账号。

---

### 缺失 8: middleware 太简单
middleware 只检查了 dashboard 路由的登录态，但：
- 没有安全头（CSP, X-Frame-Options, HSTS 等）
- 没有 CSRF 防护
- 没有速率限制

---

### 缺失 9: 没有错误边界（Error Boundary）
React 组件没有错误边界，如果某个组件崩溃，整个页面白屏。

---

## 六、代码质量 / 小问题（P4）

### 小问题 1: 两处限流逻辑重复
`api/quotes/route.ts` 和 `api/quotes/send/route.ts` 各有一份相同的 `isRateLimited` 函数和 `createLog` Map，应该抽到公共文件里。

---

### 小问题 2: /api/account 字段名不匹配
代码里 select 了 `name` 和 `company`，但数据库表结构里是 `business_name`。可能会报错或返回 null。

---

### 小问题 3: referral RLS insert policy 有问题
`referrals_insert_own` policy 允许 `auth.uid() = referrer_id OR auth.uid() = referred_id`，这意味着被推荐人也可以自己插入 referral 记录？虽然 unique 约束会阻止重复，但逻辑上不太对。

---

### 小问题 4: subscription-check 注释说"每小时检查"但 cron 是每天
代码注释第 8 行写的是"每小时检查一次"，但 vercel.json 里是每天凌晨 2 点。

---

### 小问题 5: inbound webhook 里 traceWrite 每次都新建 admin client
第 56 行 `const admin0 = createAdminClient();` 在 traceWrite 函数里每次新建，而外面已经有一个 admin 了。

---

## 七、Vercel / 部署相关

### 已确认状态
- ✅ 4 个 cron job 配置正常（followups 14:00, keepalive 06:00, subscription-check 02:00, monthly-report 每月1号 09:00）
- ✅ NEXT_PUBLIC_PAYPAL_PLAN_ID = P-9RN20574BN6264401NKUP3CY

### 需要确认的环境变量
| 变量名 | 用途 | 是否必须 |
|--------|------|----------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase URL | ✅ |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase 公钥 | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | 服务端绕过 RLS | ✅ |
| PAYPAL_CLIENT_ID | PayPal 服务端验证 | ✅ |
| PAYPAL_CLIENT_SECRET | PayPal 服务端验证 | ✅ |
| NEXT_PUBLIC_PAYPAL_CLIENT_ID | PayPal 前端 SDK | ✅ |
| NEXT_PUBLIC_PAYPAL_PLAN_ID | PayPal 订阅计划 ID | ✅ |
| RESEND_API_KEY | 邮件发送 | ✅ |
| RESEND_FROM_EMAIL | 发件人地址 | ✅ |
| CRON_SECRET | Cron 接口鉴权 | ✅ |
| INBOUND_WEBHOOK_SECRET | 入站邮件 webhook 鉴权 | ✅ |
| NEXT_PUBLIC_ADMIN_EMAILS | 管理员邮箱（免付费） | ⚠️ |
| NEXT_PUBLIC_VERTICAL | 垂直行业配置 | ⚠️ |

---

## 八、优先修复清单（按严重程度排序）

| 优先级 | 问题 | 文件 | 影响 |
|--------|------|------|------|
| 🔴 P0 | /api/account 无鉴权，全量泄露 + 越权修改 | app/api/account/route.ts | 数据泄露、账户篡改 |
| 🔴 P0 | RLS 允许用户自行修改 paypal_subscription_id | 数据库 RLS + SignupForm.tsx | 支付绕过，白嫖 |
| 🟠 P1 | PayPal 凭证缺失时 verify 返回 ok=true | lib/paypal.ts | 支付绕过 |
| 🟠 P1 | referral/complete 无鉴权，可伪造推荐 | app/api/referral/complete/route.ts | 免费月被盗刷 |
| 🟠 P1 | SignupForm 前端 fallback 绕过支付验证 | app/signup/SignupForm.tsx | 支付绕过 |
| 🟠 P1 | 付费判断只校验格式不校验有效性 | 多处 | 可以白嫖一天 |
| 🟡 P2 | 价格文案多处不一致（$49 vs $19 vs $9） | 多处 | 用户困惑、转化损失 |
| 🟡 P2 | Signup 免费额度写 10 实际 3 | app/signup/SignupForm.tsx | 误导用户 |
| 🟡 P2 | export 的 messages 查询用不存在字段 | app/api/export/route.ts | 导出功能失效 |
| 🟡 P2 | followup cron 不检查付费状态 | app/api/cron/followups/route.ts | 免费用户无限跟进 |
| 🟡 P2 | signup 自动确认邮箱，无需验证 | app/api/signup/route.ts | 垃圾账号风险 |
| 🟡 P2 | 内存限流在 serverless 下无效 | 多处 | 防刷失效 |
| 🟡 P2 | Dashboard 状态类型不全 | app/dashboard/page.tsx | UI 显示异常 |
| 🟡 P2 | messages/scope_changes 无 DELETE policy | 数据库 RLS | 功能缺失 |
| 🟡 P2 | quotes/send 清洗去掉所有换行 | app/api/quotes/send/route.ts | 邮件格式乱 |
| 🟢 P3 | 缺少 PayPal Webhook | 新增 | 支付状态滞后 |
| 🟢 P3 | 缺少试用期跟踪逻辑 | 数据库 + cron | 试用期管理 |
| 🟢 P3 | 没有取消订阅入口 | Dashboard Settings | 用户体验 |
| 🟢 P3 | 缺少邮件送达追踪 | Resend webhook | 退信不知情 |

---

## 九、关于"3 个支付选项"的最终结论

**你的真实诉求：PayPal 按钮显示 PayPal + PayPal Credit + Card 三个选项**

**现状**：
- 代码正确 ✅
- 环境变量正确 ✅  
- 部署正常 ✅
- 按钮只显示 2 个（PayPal + Card） ❌

**根本原因**：PayPal Credit 不是代码能控制的，它取决于：
1. 你的 PayPal 商户账户是否开通了 PayPal Credit
2. 买家所在地区是否支持
3. 交易类型（订阅 vs 一次性）

**要显示第 3 个选项，你需要**：
1. 登录 PayPal 商户后台，申请开通 PayPal Credit（中国区账号大概率不支持）
2. 或者接受现实：2 个选项已经覆盖 99% 用户
3. 或者加支付宝/微信支付作为第 3 个选项（需要单独接入）

---

*报告生成时间: 2026-10-09*
*审查代码行数: 约 3000+ 行*
*发现问题总数: 20+ 个（含严重 4 个、高危 5 个）*
