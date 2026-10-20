import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 服务端代发"范围变更(change order)"邮件。
// 背景：原先报价详情页在客户端直接 import lib/resend 调 sendEmail——
// 服务端 SDK 被打进浏览器包（RESEND_API_KEY 暴露风险 + 功能实际是坏的）。
// 本路由统一收拢发信逻辑到服务端：先校验登录 + 报价归属 + 变更归属，再代发。
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: { scopeChangeId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 });
  }
  const scopeChangeId = body?.scopeChangeId;
  if (!scopeChangeId) {
    return NextResponse.json({ ok: false, error: 'scopeChangeId required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 报价归属校验：quote 必须属于当前登录用户
  const { data: quote } = await admin
    .from('quotes')
    .select('id, account_id, customer_name, customer_email, amount')
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();
  if (!quote) {
    return NextResponse.json({ ok: false, error: 'Quote not found' }, { status: 404 });
  }

  // 变更归属校验：scope change 必须挂在该报价下
  const { data: sc } = await admin
    .from('scope_changes')
    .select('id, quote_id, description, additional_amount, status')
    .eq('id', scopeChangeId)
    .eq('quote_id', quote.id)
    .maybeSingle();
  if (!sc) {
    return NextResponse.json({ ok: false, error: 'Scope change not found' }, { status: 404 });
  }

  const { data: account } = await admin
    .from('accounts')
    .select('business_name, followup_email')
    .eq('id', user.id)
    .maybeSingle();

  const originalAmount = quote.amount || 0;
  const subject = `Quote Update: ${sc.description} — Additional $${sc.additional_amount}`;
  const text = `Hi ${quote.customer_name || 'there'},

You asked to add "${sc.description}". That comes to an additional $${sc.additional_amount}.

Original: $${originalAmount}
Total now: $${originalAmount + sc.additional_amount}

Let me know if you have any questions.

Best,
${account?.business_name || 'QuoteFollow'}`;

  // 防邮件头 CRLF 注入
  const safeSubject = subject.replace(/[\r\n]/g, '');

  try {
    const sent = await sendEmail({
      to: quote.customer_email,
      subject: safeSubject,
      text,
      replyTo: account?.followup_email || undefined,
      fromName: account?.business_name || undefined,
    });

    // 发送成功后才标记 sent（与旧客户端逻辑语义一致）
    await admin
      .from('scope_changes')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', sc.id);

    // 写入会话时间线（旧客户端逻辑漏了这条，导致 scope 邮件不出现在 Conversation 里）
    await admin.from('messages').insert({
      quote_id: quote.id,
      direction: 'out',
      subject: safeSubject,
      body: text.slice(0, 5000),
      message_id: sent?.id || '',
      in_reply_to: '',
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[quotes/scope-send] send failed:', e?.message || e);
    return NextResponse.json({ ok: false, error: 'Failed to send email. Please try again.' }, { status: 500 });
  }
}
