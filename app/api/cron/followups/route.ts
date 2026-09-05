import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateFollowupBody } from '@/lib/ai';
import { sendEmail } from '@/lib/resend';
import { scheduleForDay } from '@/lib/followup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============ Vercel Cron：每天跑一次，找出该发跟进邮件的报价 ============
// 用 vercel.json 里的 cron 配置触发（默认每天 14:00 UTC）。
// 安全：带 ?cron=secret（CRON_SECRET）；Vercel Cron 默认带 Authorization: Bearer $CRON_SECRET。

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}` && req.nextUrl.searchParams.get('cron') !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // 所有"跟进中"且到了跟进时间的报价
  const nowIso = new Date().toISOString();
  const { data: quotes, error } = await admin
    .from('quotes')
    .select('*')
    .eq('status', 'following')
    .not('next_followup_at', 'is', null)
    .lte('next_followup_at', nowIso)
    .limit(200);

  if (error) {
    console.error('[cron] query error:', error);
    return NextResponse.json({ ok: false, error: 'db error' }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const quote of quotes || []) {
    // 决定发第几封：按 followup_count 0→1, 1→2, 2→3
    const step = (Math.min(quote.followup_count, 2) + 1) as 1 | 2 | 3;

    const { data: account } = await admin.from('accounts').select('*').eq('id', quote.account_id).single();
    if (!account) continue;

    // 客户邮箱为空的报价无法发信：停掉后续跟进并计入 skipped，避免每天空转重试
    if (!quote.customer_email) {
      await admin.from('quotes').update({ next_followup_at: null }).eq('id', quote.id);
      skipped++;
      continue;
    }

    const body = await generateFollowupBody(
      step,
      quote.customer_name,
      quote.service_type,
      quote.amount,
      account.business_name,
      account.business_info || {}
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
        replyTo: account.followup_email,
      });

      // 记录发出去的邮件（Message-ID 用于客户回复时匹配）
      await admin.from('messages').insert({
        quote_id: quote.id,
        direction: 'out',
        subject,
        body,
        message_id: sentRes.data?.id || '',
        in_reply_to: '',
      });

      // 更新报价状态：跟进次数 +1，计算下一次跟进时间
      const newCount = quote.followup_count + 1;
      const nextDate = quote.quote_date ? new Date(quote.quote_date) : new Date();
      const nextFollowup =
        newCount >= 3 ? null : scheduleForDay(nextDate, (newCount + 1) as 1 | 2 | 3).toISOString();

      await admin
        .from('quotes')
        .update({
          followup_count: newCount,
          last_followup_at: new Date().toISOString(),
          next_followup_at: nextFollowup,
        })
        .eq('id', quote.id);

      sent++;
    } catch (e) {
      console.error(`[cron] send failed for quote ${quote.id}:`, e);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, failed, skipped, scanned: quotes?.length || 0 });
}
