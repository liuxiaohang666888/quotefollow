import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateFollowupBody } from '@/lib/ai';
import { sendEmail } from '@/lib/resend';
import { scheduleForDay } from '@/lib/followup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============ Vercel Cron：每天跑一次，找出该发跟进邮件的报价 ============
// 用 vercel.json 里的 cron 配置触发（默认每天 14:00 UTC）。
// 安全：Vercel Cron 自动带 Authorization: Bearer $CRON_SECRET；也支持 ?cron=secret 手动触发。
// 注意：同一仓库部署了 6 个 Vercel 项目（共享同一数据库），cron 会在 6 个项目上同时触发本接口，
// 因此每条报价发信前必须先通过"原子领取锁"抢占（见下方 claimed 更新），防止发 6 封重复邮件。

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  // fail-closed：CRON_SECRET 未配置时直接拒绝，避免接口对公网全开放
  if (!expected) {
    console.error('[cron] CRON_SECRET is not configured — rejecting (fail-closed)');
    return NextResponse.json({ ok: false, error: 'cron not configured' }, { status: 401 });
  }
  if (auth !== `Bearer ${expected}` && req.nextUrl.searchParams.get('cron') !== expected) {
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

    // ============ 原子领取锁 ============
    // 只有能把 next_followup_at 从旧值改成本实例锁值的实例，才有权发这封邮件。
    // 6 个项目的 cron 同时触发时，Postgres 行级锁保证 UPDATE ... WHERE next_followup_at = 旧值
    // 只会有一个实例命中，其余实例拿到空结果直接跳过 → 同一报价不会发 6 封重复邮件。
    // 锁值 = now + 10 分钟：发信成功后会被下方覆盖为真正的下次跟进时间；
    // 若发信失败，锁值保留（10 分钟后即成过去时间，明天 cron 照常命中重试）。
    const lockUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data: claimed } = await admin
      .from('quotes')
      .update({ next_followup_at: lockUntil })
      .eq('id', quote.id)
      .eq('next_followup_at', quote.next_followup_at)
      .select('id');

    if (!claimed || claimed.length === 0) {
      // 其他实例已抢先领取本条报价
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
