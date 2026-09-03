import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseQuoteEmail } from '@/lib/ai';
import { scheduleForDay } from '@/lib/followup';
import { isAdminEmail } from '@/lib/paywall';
import { isValidPaypalSubscriptionId } from '@/lib/paypal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 简易内存限流：每个用户每 60 秒最多创建 10 条报价（防脚本刷爆 AI 成本）
const windowMs = 60_000;
const maxPerWindow = 10;
const createLog = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (createLog.get(userId) || []).filter((t) => now - t < windowMs);
  if (arr.length >= maxPerWindow) {
    createLog.set(userId, arr);
    return true;
  }
  arr.push(now);
  createLog.set(userId, arr);
  return false;
}

// 手动创建报价：老板在后台粘贴报价邮件内容 → AI 解析 → 建档 → 安排跟进
// 这是"邮件转发"之外的另一个入口，不依赖域名/邮件路由，今天即可用。
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  // 防刷：限频
  if (isRateLimited(user.id)) {
    return NextResponse.json({ ok: false, error: 'rate limited: too many quotes in a minute' }, { status: 429 });
  }

  // 防白嫖：免费账号（无有效订阅）限制报价总数，管理员豁免
  const admin = createAdminClient();
  const { data: acc } = await admin.from('accounts').select('paypal_subscription_id').eq('id', user.id).maybeSingle();
  const isAdmin = isAdminEmail(user.email);
  const isPaid = !!acc?.paypal_subscription_id && isValidPaypalSubscriptionId(acc.paypal_subscription_id);
  if (!isAdmin && !isPaid) {
    const FREE_QUOTA = 10;
    const { count } = await admin
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', user.id);
    if ((count ?? 0) >= FREE_QUOTA) {
      return NextResponse.json(
        { ok: false, error: `Free plan allows ${FREE_QUOTA} quotes. Subscribe to add more.` },
        { status: 402 }
      );
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
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, quote_id: quote.id });
}
