import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 客户在公开报价页点「接受 / 婉拒」
// 安全：quote id 是 uuid 不可枚举；只能对状态为 following/replied 的报价生效一次。
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  const decision = body?.decision; // 'accept' | 'decline'

  if (decision !== 'accept' && decision !== 'decline') {
    return NextResponse.json({ ok: false, error: 'invalid decision' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: quote, error } = await admin
    .from('quotes')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (error || !quote) {
    return NextResponse.json({ ok: false, error: 'quote not found' }, { status: 404 });
  }

  // 已 won/lost 的报价不允许再改（防重复提交翻状态）
  if (quote.status === 'won' || quote.status === 'lost') {
    return NextResponse.json({ ok: false, error: 'already decided' }, { status: 409 });
  }

  const { data: account } = await admin
    .from('accounts')
    .select('*')
    .eq('id', quote.account_id)
    .maybeSingle();

  const newStatus = decision === 'accept' ? 'won' : 'lost';

  // 更新报价状态 + 停止自动跟进
  await admin
    .from('quotes')
    .update({ status: newStatus, next_followup_at: null })
    .eq('id', quote.id);

  // 记录客户动作到 messages（方向 in）
  await admin.from('messages').insert({
    quote_id: quote.id,
    direction: 'in',
    subject: decision === 'accept' ? 'Customer accepted quote (via link)' : 'Customer declined quote (via link)',
    body:
      decision === 'accept'
        ? 'The customer clicked “Accept” on the public quote page. Great — follow up to confirm scheduling!'
        : 'The customer clicked “Decline” on the public quote page. No further follow-ups will be sent.',
    message_id: '',
    in_reply_to: '',
  });

  // 通知老板（邮件）
  try {
    const { data: user } = await admin.auth.admin.getUserById(quote.account_id);
    const ownerEmail = user.user?.email;
    if (ownerEmail) {
      await sendEmail({
        to: ownerEmail,
        subject: decision === 'accept'
          ? `🎉 ${quote.customer_name || 'A customer'} accepted your quote${quote.amount ? ' — $' + quote.amount : ''}`
          : `${quote.customer_name || 'A customer'} declined your quote`,
        text:
          decision === 'accept'
            ? `Great news! ${quote.customer_name || 'A customer'} accepted the quote${quote.amount ? ' of $' + quote.amount : ''} (${quote.service_type || 'service'}).\n\nReach out to lock in the dates.\n\n— QuoteFollow`
            : `${quote.customer_name || 'A customer'} declined the quote${quote.amount ? ' of $' + quote.amount : ''} (${quote.service_type || 'service'}). No more follow-ups will be sent for this one.`,
      });
    }
  } catch (e) {
    console.error('[public-respond] notify owner failed:', e);
  }

  return NextResponse.json({
    ok: true,
    decision,
    message:
      decision === 'accept'
        ? 'Thank you! We’ll be in touch shortly to confirm the details.'
        : 'Thanks for letting us know. Have a great day!',
  });
}
