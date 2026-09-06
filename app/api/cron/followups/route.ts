import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateFollowupBody } from '@/lib/ai';
import { sendEmail } from '@/lib/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 每日定时：检查所有 pending 的 quote，到时间的发跟进邮件
export async function POST(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // 取所有 status=following 且 next_followup_at <= now 的 quote
  const now = new Date().toISOString();
  const { data: quotes, error } = await admin
    .from('quotes')
    .select('*')
    .eq('status', 'following')
    .lte('next_followup_at', now)
    .order('next_followup_at', { ascending: true });

  if (error) {
    console.error('[cron/followups] query error:', error);
    return NextResponse.json({ ok: false, error: 'db error' }, { status: 500 });
  }

  if (!quotes || quotes.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  for (const quote of quotes) {
    try {
      const step = (quote.followup_count ?? 0) + 1;
      if (step > 3) {
        // 超过 3 封跟进，清除时间
        await admin.from('quotes').update({ next_followup_at: null }).eq('id', quote.id);
        continue;
      }

      const { data: account } = await admin
        .from('accounts')
        .select('*')
        .eq('id', quote.account_id)
        .single();

      if (!account) {
        console.warn('[cron/followups] account not found for quote:', quote.id);
        continue;
      }

      const body = await generateFollowupBody(
        step as 1 | 2 | 3,
        quote.customer_name || '',
        quote.service_type || '',
        quote.amount,
        account.business_name || 'Your business',
        account.business_info || {}
      );

      const subject = step === 1
        ? `Checking in on your quote${quote.customer_name ? ', ' + quote.customer_name : ''}`
        : step === 2
          ? `Following up${quote.customer_name ? ', ' + quote.customer_name : ''}`
          : `One last note${quote.customer_name ? ', ' + quote.customer_name : ''}`;

      try {
        const sentRes = await sendEmail({
          to: quote.customer_email,
          subject,
          text: body,
          replyTo: account.followup_email || undefined,
        });

        await admin.from('messages').insert({
          quote_id: quote.id,
          direction: 'out',
          subject,
          body: body.slice(0, 5000),
          message_id: sentRes.data?.id || '',
          in_reply_to: '',
        });

        const newCount = quote.followup_count + 1;
        const quoteDate = quote.quote_date ? new Date(quote.quote_date) : new Date();
        const nextDate = newCount >= 3 ? null : new Date(
          Date.UTC(
            quoteDate.getUTCFullYear(),
            quoteDate.getUTCMonth(),
            quoteDate.getUTCDate() + (newCount === 1 ? 3 : newCount === 2 ? 4 : 0),
            9, 0, 0
          )
        ).toISOString();

        await admin.from('quotes').update({
          followup_count: newCount,
          last_followup_at: new Date().toISOString(),
          next_followup_at: nextDate || null,
        }).eq('id', quote.id);

        sent++;
        console.log('[cron/followups] sent followup #' + newCount + ' to', quote.customer_email, 'quote:', quote.id);
      } catch (e) {
        console.error('[cron/followups] send failed for quote', quote.id, e);
      }
    } catch (e) {
      console.error('[cron/followups] error processing quote', quote.id, e);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
