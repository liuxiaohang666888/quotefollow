import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 标记定金已支付 + 服务端发送确认邮件。
// 背景：原先报价详情页在客户端直接 import lib/resend 发确认邮件
// （服务端 SDK 进浏览器包 + 无归属校验），统一收拢到服务端。
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const { id } = await params;

  const admin = createAdminClient();

  // 报价归属校验
  const { data: quote } = await admin
    .from('quotes')
    .select('id, account_id, customer_name, customer_email, deposit_amount, deposit_status, require_deposit')
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();
  if (!quote) {
    return NextResponse.json({ ok: false, error: 'Quote not found' }, { status: 404 });
  }
  if (!quote.require_deposit) {
    return NextResponse.json({ ok: false, error: 'This quote does not require a deposit' }, { status: 400 });
  }

  // 幂等：已支付过不重复发信（旧客户端每次点击都会重发一封确认邮件）
  if (quote.deposit_status === 'paid') {
    return NextResponse.json({ ok: true, alreadyPaid: true });
  }

  await admin
    .from('quotes')
    .update({ deposit_status: 'paid', deposit_paid_at: new Date().toISOString() })
    .eq('id', quote.id);

  const { data: account } = await admin
    .from('accounts')
    .select('business_name, followup_email')
    .eq('id', user.id)
    .maybeSingle();

  const subject = 'Deposit Received — Your booking is locked in!';
  const text = `Hi ${quote.customer_name},

Great news! We've received your deposit of $${quote.deposit_amount}. Your booking is officially on the schedule.

Looking forward to working with you!

Best,
${account?.business_name || 'QuoteFollow'}`;

  try {
    await sendEmail({
      to: quote.customer_email,
      subject,
      text,
      replyTo: account?.followup_email || undefined,
      fromName: account?.business_name || undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // 库状态已更新，仅邮件失败：不返回 500，避免前端误判为"标记失败"而重复点击
    console.error('[quotes/deposit] confirmation email failed:', e?.message || e);
    return NextResponse.json({ ok: true, emailFailed: true });
  }
}
