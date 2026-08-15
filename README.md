# QuoteFollow — Deploy Guide (Step by Step)

AI quote follow-up for solo service businesses. Forward your quotes to your own
inbox; we chase them on day 1/3/7, answer common questions, and ping you on hot leads.

**Stack:** Next.js 14 · Supabase (Postgres + Auth) · OpenAI (or GLM) · Resend · Vercel Cron
**Payments:** PayPal invoices (no Stripe).

---

## 0. What you need before starting (10 minutes, free)

| Item | Where | Cost |
|---|---|---|
| GitHub account | github.com | Free |
| Vercel account | vercel.com (sign in with GitHub) | Free |
| Supabase account | supabase.com | Free |
| Resend account | resend.com | Free (3,000 emails/mo) |
| OpenAI API key (or 智谱 GLM key) | platform.openai.com / bigmodel.cn | ~$0.01/quote |
| Cloudflare account (optional, for custom inbox domain) | cloudflare.com | Free |
| PayPal account (Dad's, receives money) | paypal.com | Free |

> 收款：产品页 "Get Started" 按钮直接指到你的 PayPal 发票链接（在 paypal.com 后台
> "请求付款 / 创建发票" 生成，把链接填进 `NEXT_PUBLIC_PAYPAL_INVOICE_URL`）。

---

## 1. Set up Supabase (database + auth)

1. Go to supabase.com → **New project** → name it `quotefollow` → pick a password
   (store it) → region: **Singapore** or **North America** → create.
2. Wait ~2 min for the project to be ready. Open **SQL Editor**.
3. Paste the entire contents of `supabase/migrations/001_init.sql` → **Run**.
   You should see "Success. No rows returned" ×several.
4. **Settings → API** (left sidebar, bottom). Copy two things:
   - **Project URL** → looks like `https://xxxx.supabase.co`
   - **anon public key** (starts with `eyJ...`)
5. **Settings → API → scroll down to `service_role`** → click **Reveal** → copy the key
   (starts with `eyJ...`). ⚠️ This is the powerful key — it stays on the server only,
   never in the browser.
6. **Authentication → Providers → Email**: make sure *Email* is Enabled (default).
   Optional: set "Confirm email" = off so signups work instantly.

---

## 2. Set up Resend (sending follow-up emails)

1. Go to resend.com → sign in → **Add Domain** (e.g. `yourdomain.com`).
   - If you don't have a domain: buy one (~$10/yr at namesilo.com or your provider).
   - If you don't want to buy one yet: you can use Resend's shared domain
     `onboarding@resend.dev` — but emails will come from that address. Fine for testing.
2. Add the DNS records Resend gives you (SPF + DKIM) at your domain provider.
3. Wait for verification (usually 5–15 min, sometimes 1 h).
4. Go to **API Keys** → **Create API Key** → copy it (starts with `re_`).

> The sender address format for `RESEND_FROM_EMAIL`:
> `Your Business <followup@yourdomain.com>` — must match your verified domain.

---

## 3. Get your AI key

**Option A — OpenAI (simplest, ~$0.01/quote):**
1. platform.openai.com → **API keys** → **Create new secret key** → copy (`sk-...`).
2. Make sure billing is set up (add a few $ — a month of testing costs under $1).

**Option B — 智谱 GLM (free tier, OpenAI-compatible, good for China access):**
1. bigmodel.cn → register → **API 密钥** → create a key.
2. In your env vars set:
   - `OPENAI_API_KEY` = your GLM key
   - `OPENAI_BASE_URL` = `https://open.bigmodel.cn/api/paas/v4`
   - `OPENAI_MODEL` = `glm-4.5-flash` (or whatever your plan offers)

---

## 4. Deploy to Vercel

1. Create a GitHub repo and push this folder:
   ```bash
   git init
   git add .
   git commit -m "QuoteFollow"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/quotefollow.git
   git push -u origin main
   ```
2. vercel.com → **Add New Project** → import the `quotefollow` repo.
3. Framework preset: **Next.js** (auto-detected). Click **Environment Variables** and add:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL (from step 1.4) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key (from step 1.4) |
| `SUPABASE_SERVICE_ROLE_KEY` | your service_role key (from step 1.5) |
| `OPENAI_API_KEY` | from step 3 |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` (or GLM url) |
| `OPENAI_MODEL` | `gpt-4o-mini` (or your GLM model) |
| `RESEND_API_KEY` | from step 2 |
| `RESEND_FROM_EMAIL` | `Your Business <followup@yourdomain.com>` |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` (after first deploy, update this) |
| `NEXT_PUBLIC_PAYPAL_INVOICE_URL` | your PayPal invoice link |
| `INBOUND_WEBHOOK_SECRET` | any long random string, e.g. `qf_` + 24 random chars |
| `CRON_SECRET` | another long random string |

4. Click **Deploy**. First build takes ~2 min.
5. **Project → Settings → Cron Jobs** (in the Settings tab of your project,
   scroll down): you'll see the cron from `vercel.json` — `0 14 * * *` (14:00 UTC =
   10am ET / 10pm Beijing). Verify it says **Active**. Also add the `CRON_SECRET`
   env var there if you want cron auth (Vercel sends it automatically as
   `Authorization: Bearer $CRON_SECRET`).
6. **Project → Settings → Domains**: add `yourdomain.com` and point it at Vercel
   (optional but recommended). Then update `NEXT_PAYPAL_...`/`NEXT_PUBLIC_APP_URL`
   if needed and redeploy.

> After deploy, sign up at `https://your-app.vercel.app/signup` to test auth.

---

## 5. Connect your follow-up inbox (inbound email)

Two options. Pick ONE.

### Option A — Cloudflare Email Routing (free, recommended)

1. Make sure your domain's DNS is on Cloudflare (add site → change nameservers at
   your registrar — takes 10 min to a few hours).
2. Cloudflare Dashboard → **Email** → **Email Routing** → enable.
3. **Destination addresses** → add your real inbox (e.g. `you@gmail.com`) — required
   for verification. Verify the email.
4. **Routing rules** → create a rule:
   - Action: **Send to a Worker**
   - Custom address: `follow@yourdomain.com`
   - Destination: your worker (create one: Workers & Pages → Create → Worker →
     paste `cloudflare-worker/worker.js` → **Edit** the two top constants:
     `BACKEND_URL` = `https://your-app.vercel.app/api/webhooks/inbound`,
     `INBOUND_SECRET` = the same secret you set in Vercel → Deploy → give it a name).
5. Done. Test: send an email to `follow@yourdomain.com` from any address and watch
   the webhook fire (see `https://your-app.vercel.app/api/webhooks/inbound` 401 =
   wrong secret; a `{ok:true}` in the response = works — you can test with curl:
   ```bash
   curl -X POST https://your-app.vercel.app/api/webhooks/inbound \
     -H "Content-Type: application/json" \
     -H "X-Inbound-Secret: YOUR_SECRET" \
     -d '{"From":"cust@example.com","To":"follow@yourdomain.com","Subject":"Quote for house cleaning","text":"Hi, I am quoting $150 for a deep clean of your 2-bedroom house on Friday. Thanks!"}'
   ```

### Option B — Resend Inbound (paid, $20/mo for a domain inbox)

1. Resend → **Inbound** → Add a domain → follow their DNS steps.
2. Create a routing rule → POST to `https://your-app.vercel.app/api/webhooks/inbound`
   with header `X-Inbound-Secret` = your secret.
3. Test the same way as above.

> **Skip this step for now if you just want to see the app work.** Quotes can also
> be added by the webhook test curl above — no real inbox needed to demo.

---

## 6. Verify the whole flow (test run)

1. Sign up at `https://your-app.vercel.app/signup` → dashboard opens.
2. Settings → fill in business name, follow-up inbox (`follow@yourdomain.com`),
   and 2–3 facts for the AI (availability, deposit, turnaround). Save.
3. Send the test curl from step 5 (or email your inbox). A quote card appears in
   the dashboard.
4. Wait for the cron at 14:00 UTC — or trigger it manually:
   ```bash
   curl -X GET "https://your-app.vercel.app/api/cron/followups?cron=YOUR_CRON_SECRET"
   ```
   → response shows `{"ok":true,"sent":1,...}` and the follow-up email lands in
   `cust@example.com` (check Resend dashboard → Logs for delivery status).
5. Reply to that follow-up email → the customer reply is matched, auto-reply fires
   (or a hot-lead alert is sent to you), and the quote status flips to *replied*.

---

## 7. Go live

1. Landing page "Get Started" buttons already point to your PayPal invoice link
   (`NEXT_PUBLIC_PAYPAL_INVOICE_URL`). Create the invoice in PayPal:
   - paypal.com → **Request** (请求付款) → **Create invoice** → fill: business name,
     amount **$29 (monthly)** or **$199 (yearly)**, description of what's included,
     link = send yourself, then copy the invoice link from the "send" screen.
   - Update the env var and redeploy. (Or use two buttons → see README notes.)
2. Post the landing page to r/Entrepreneur, r/sweatystartup, r/smallbusiness,
   Facebook local groups, Nextdoor — your buyer is a cleaner/mover/lawn guy who
   "hates chasing quotes".
3. First 10 founding members at $199/yr = $1,990 upfront cash. That's the goal.

---

## FAQ

**Q: Does the customer need an account?** No. They just reply to your email thread.

**Q: Can I review what the AI sends?** In this MVP, follow-ups send automatically
on schedule (they're generic + your business facts). Auto-replies to customers can
be turned off in Settings. To make every message require approval first, check the
"draft mode" TODO in the code — it's a small change (set `should_send=false`
default in `app/api/webhooks/inbound/route.ts`).

**Q: Price too low / too high?** The plan: $29/mo vs Jobber's $39+; $199/yr is a
founding-customer cash grab. Adjust `app/page.tsx` if you want different numbers.

**Q: How do I see revenue?** PayPal dashboard. Vercel/Resend dashboards show
signups and emails. Supabase dashboard shows quote counts.

**Q: Cron didn't run?** Vercel Hobby runs cron daily. If the log shows 401, the
`CRON_SECRET` env var doesn't match what the cron sends — set it in Vercel
**Settings → Cron Jobs** → environment.

---

## Pricing recap (from the strategy doc)

- **QuoteFollow**: $99 setup + $29/mo · founding: **$199/yr** (prepay, cash now)
- (Later) **RealtorLead** $49/mo — same engine, realtor templates
- (Later) **ExamPrep** $25–40 Gumroad — license test banks, script-level

## Money rule

Zero capital. Free tiers only. PayPal invoices for money (Dad's account).
OpenAI costs < $0.02 per quote processed. Don't buy ads; post where your buyer hangs out.
