import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/resend';
import { scheduleForDay } from '@/lib/followup';
import { isAdminEmail } from '@/lib/paywall';
import { isValidPaypalSubscriptionId } from '@/lib/paypal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 简易内存限流
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

// 发送报价邮件给客户 + 自动建档 + 安排跟进
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  if (isRateLimited(user.id)) {
    return NextResponse.json({ ok: false, error: 'rate limited: too many quotes in a minute' }, { status: 429 });
  }

  // 付费检查
  const admin = createAdminClient();
  const { data: acc } = await admin.from('accounts').select('*').eq('id', user.id).maybeSingle();
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

  let body: {
    customer_name: string;
    customer_email: string;
    service_type: string;
    amount: number | null;
    message: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 });
  }

  const customerName = (body.customer_name || '').trim();
  const customerEmail = (body.customer_email || '').trim().toLowerCase();
  const serviceType = (body.service_type || '').trim();
  const amount = typeof body.amount === 'number' && body.amount > 0 ? body.amount : null;
  const message = (body.message || '').trim();

  if (!customerEmail) {
    return NextResponse.json({ ok: false, error: 'Customer email is required' }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ ok: false, error: 'Quote message is required' }, { status: 400 });
  }

  const businessName = acc?.business_name || 'Your business';
  const subject = `Quote: ${serviceType || 'our service'}${customerName ? ` for ${customerName}` : ''}`;

  const quoteDate = new Date();

  try {
    // 1. 发送报价邮件给客户
    const sentRes = await sendEmail({
      to: customerEmail,
      subject,
      text: message,
      replyTo: 'follow@voxalo.top',
      fromName: businessName,
    });

    // 2. 创建报价记录
    const { data: quote, error: qErr } = await supabase
      .from('quotes')
      .insert({
        account_id: user.id,
        customer_email: customerEmail,
        customer_name: customerName,
        amount,
        service_type: serviceType,
        quote_date: quoteDate.toISOString().slice(0, 10),
        source_subject: subject,
        source_body: message.slice(0, 5000),
        next_followup_at: scheduleForDay(quoteDate, 1).toISOString(),
      })
      .select()
      .single();

    if (qErr) {
      // 邮件已发但数据库写失败 → 记录错误但不回滚邮件
      console.error('[quotes/send] insert error:', qErr);
      return NextResponse.json({ ok: false, error: 'Quote sent but failed to save. Please contact support.' }, { status: 500 });
    }

    // 3. 记录发送的邮件
    await admin.from('messages').insert({
      quote_id: quote.id,
      direction: 'out',
      subject,
      body: message.slice(0, 5000),
      message_id: sentRes.data?.id || '',
      in_reply_to: '',
    });

    return NextResponse.json({ ok: true, quote_id: quote.id });
  } catch (e) {
    console.error('[quotes/send] send failed:', e);
    return NextResponse.json({ ok: false, error: 'Failed to send quote email. Please try again.' }, { status: 500 });
  }
}