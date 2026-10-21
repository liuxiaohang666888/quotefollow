import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseQuoteEmail } from '@/lib/ai';
import { scheduleForDay } from '@/lib/followup';
import { resumePausedFollowupsForCustomer } from '@/lib/followup-resume';
import { isAdminEmail, FREE_QUOTA, countQuotesFor, isTrialActive, hasActiveFreeMonth } from '@/lib/paywall';
import { isValidPaypalSubscriptionId } from '@/lib/paypal';
import { isQuoteCreateRateLimited } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 手动创建报价：老板在后台粘贴报价邮件内容 → AI 解析 → 建档 → 安排跟进
// 这是"邮件转发"之外的另一个入口，不依赖域名/邮件路由，今天即可用。
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  // 防刷：限频（共享限流模块，见 lib/rate-limit.ts）
  if (isQuoteCreateRateLimited(user.id)) {
    return NextResponse.json({ ok: false, error: 'rate limited: too many quotes in a minute' }, { status: 429 });
  }

  const admin = createAdminClient();

  // 自愈：账号行缺失（注册中断导致"半截账号"）时自动补建，避免下方 insert 报 FK 23503
  // 注意：必须连 created_at / trial_ends_at 一起取——旧代码只取 paypal_subscription_id，
  // 导致试用期检查对存量账号恒真（undefined → 恒"试用期内"），试用过期后仍可建档（M12）。
  let acc = (await admin.from('accounts').select('paypal_subscription_id, created_at, trial_ends_at, free_months_earned, free_month_expires_at').eq('id', user.id).maybeSingle()).data;
  if (!acc) {
    const { data: created, error: accErr } = await admin
      .from('accounts')
      .upsert({ id: user.id, email: user.email ?? '', followup_email: 'follow@voxalo.top' }, { onConflict: 'id' })
      .select('paypal_subscription_id, created_at, trial_ends_at, free_months_earned, free_month_expires_at')
      .single();
    if (accErr) console.error('[quotes] account self-heal failed:', accErr);
    acc = created ?? acc;
  }

  // 防白嫖：免费账号（无有效订阅）限制报价总数，管理员豁免
  const isAdmin = isAdminEmail(user.email);
  const isPaid = !!acc?.paypal_subscription_id && isValidPaypalSubscriptionId(acc.paypal_subscription_id);
  const isUnlocked = isPaid || hasActiveFreeMonth(acc);
  if (!isAdmin && !isUnlocked) {
    const used = await countQuotesFor(admin, user.id, user.email);
    if (used >= FREE_QUOTA || !isTrialActive(acc)) {
      const reason = used >= FREE_QUOTA
        ? `Free plan allows ${FREE_QUOTA} quotes. Subscribe to add more.`
        : 'Your free trial (14 days or 3 clients, whichever comes first) has ended. Subscribe to continue using QuoteFollow.';
      return NextResponse.json({ ok: false, error: reason }, { status: 402 });
    }
  }


  let body: { subject?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 });
  }

  const subject = (body.subject || '').toString();
  const text = (body.text || '')
    .toString()
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text && !subject) {
    return NextResponse.json({ ok: false, error: 'please paste the quote email' }, { status: 400 });
  }

  const parsed = await parseQuoteEmail(subject, text);
  const quoteDate = parsed.quote_date ? new Date(parsed.quote_date) : new Date();

  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({
      account_id: user.id,
      customer_email: parsed.customer_email,
      customer_name: parsed.customer_name,
      amount: parsed.amount,
      service_type: parsed.service_type,
      quote_date: quoteDate.toISOString().slice(0, 10),
      source_subject: subject,
      source_body: text.slice(0, 5000),
      next_followup_at: scheduleForDay(quoteDate, 1).toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[quotes/create] error:', error.code);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }

  // 配额 TOCTOU 自纠（M11①）：count-then-insert 之间有并发窗口，两个请求可能同时通过检查。
  // 插入后复查一次：超配额就删掉自己刚建的这一行并拒绝——最终状态不会超过免费额度，
  // 每个请求只删自己的行，不会误删别人的报价。
  if (!isAdmin && !isPaid) {
    const recount = await countQuotesFor(admin, user.id, user.email);
    if (recount > FREE_QUOTA) {
      await admin.from('quotes').delete().eq('id', quote.id);
      return NextResponse.json(
        { ok: false, error: `Free plan allows ${FREE_QUOTA} quotes. Subscribe to add more.` },
        { status: 402 }
      );
    }
  }

  // 新报价创建 = 同客户有新商机：恢复该客户此前 paused 的报价，继续自动跟进
  const resumed = await resumePausedFollowupsForCustomer(
    admin,
    user.id,
    parsed.customer_email || '',
    quote.id
  );
  console.log('[quotes/create] resumed paused followups for customer:', resumed);

  return NextResponse.json({ ok: true, quote_id: quote.id });
}
