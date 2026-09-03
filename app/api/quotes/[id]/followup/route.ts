import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateFollowupBody } from '@/lib/ai';
import { sendEmail } from '@/lib/resend';
import { scheduleForDay } from '@/lib/followup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 立即跟进：老板点按钮，立刻给该客户发下一封跟进邮件（不等自动排期）。
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  // 读报价（RLS 保证只能操作自己的）
  const { data: quote } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', params.id)
    .eq('account_id', user.id)
    .single();
  if (!quote) return NextResponse.json({ ok: false, error: 'quote not found' }, { status: 404 });

  // 已成交/流失的不再跟进
  if (quote.status === 'won' || quote.status === 'lost') {
    return NextResponse.json({ ok: false, error: 'quote is already won/lost' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: account } = await admin
    .from('accounts')
    .select('*')
    .eq('id', quote.account_id)
    .single();

  const step = (Math.min(quote.followup_count, 2) + 1) as 1 | 2 | 3;
  const body = await generateFollowupBody(
    step,
    quote.customer_name,
    quote.service_type,
    quote.amount,
    account?.business_name || '',
    account?.business_info || {}
  );

  const subject =
    step === 1
      ? `Checking in on your quote${quote.customer_name ? ', ' + quote.customer_name : ''}`
      : step === 2
        ? `Following up${quote.customer_name ? ', ' + quote.customer_name : ''}`
        : `One last note${quote.customer_name ? ', ' + quote.customer_name : ''}`;

  try {
    const sentRes = await sendEmail({
      to: quote.customer_email,
      subject,
      text: body,
      replyTo: account?.followup_email || undefined,
    });

    // 记录发出的邮件（Message-ID 用于客户回复匹配）
    await admin.from('messages').insert({
      quote_id: quote.id,
      direction: 'out',
      subject,
      body,
      message_id: sentRes.data?.id || '',
      in_reply_to: '',
    });

    // 更新跟进计数 + 下一次时间
    const newCount = quote.followup_count + 1;
    const quoteDate = quote.quote_date ? new Date(quote.quote_date) : new Date();
    const nextDate = newCount >= 3 ? null : scheduleForDay(quoteDate, (newCount + 1) as 1 | 2 | 3).toISOString();

    await admin
      .from('quotes')
      .update({
        followup_count: newCount,
        last_followup_at: new Date().toISOString(),
        next_followup_at: nextDate,
      })
      .eq('id', quote.id);

    return NextResponse.json({ ok: true, followup_count: newCount });
  } catch (e) {
    console.error('[followup-now] send failed:', e);
    return NextResponse.json({ ok: false, error: 'failed to send follow-up' }, { status: 500 });
  }
}
