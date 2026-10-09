import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateFollowupBody } from '@/lib/ai';
import { sendEmail } from '@/lib/resend';
import { FREE_QUOTA, isAdminEmail } from '@/lib/paywall';
import { isValidPaypalSubscriptionId } from '@/lib/paypal';
import { isCronAuthorized } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 每日定时：检查所有 pending 的 quote，到时间的发跟进邮件
// 付费检查：免费用户只有 FREE_QUOTA 个 quote 能发跟进，超出的暂停
// 注意：Vercel Cron 发的是 GET，外部 cron 服务可能发 POST，两者都支持
async function handler(req: Request) {
  if (!isCronAuthorized(req)) {
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

  // 缓存每个账号的付费状态和 quote 总数，避免重复查询
  const accountCache = new Map<string, { isPaid: boolean; quoteCount?: number }>();

  async function getAccountStatus(accountId: string, accountEmail: string): Promise<{ isPaid: boolean; withinQuota: boolean }> {
    if (!accountCache.has(accountId)) {
      const isAdmin = isAdminEmail(accountEmail);

      // 先查账号的订阅状态
      const { data: acc } = await admin
        .from('accounts')
        .select('paypal_subscription_id, email')
        .eq('id', accountId)
        .maybeSingle();

      const isPaid = isAdmin || !!(acc?.paypal_subscription_id && isValidPaypalSubscriptionId(acc.paypal_subscription_id));

      if (isPaid || isAdmin) {
        accountCache.set(accountId, { isPaid: true });
      } else {
        // 免费用户：统计 quote 数量
        const { count } = await admin
          .from('quotes')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId);
        accountCache.set(accountId, { isPaid: false, quoteCount: count ?? 0 });
      }
    }

    const cached = accountCache.get(accountId)!;
    if (cached.isPaid) {
      return { isPaid: true, withinQuota: true };
    }

    // 免费用户：只有前 FREE_QUOTA 个 quote（按创建时间）能发跟进
    // 我们用 quoteCount 判断是否超出总量，对于单个 quote 再判断是否在额度内
    const quoteCount = cached.quoteCount ?? 0;
    return { isPaid: false, withinQuota: quoteCount <= FREE_QUOTA };
  }

  let sent = 0;
  let skippedFree = 0;

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

      // 🔒 付费检查：免费用户超出额度的 quote 不发跟进
      const { isPaid, withinQuota } = await getAccountStatus(account.id, account.email);
      if (!isPaid && !withinQuota) {
        console.log('[cron/followups] skipping free user over quota:', account.email, 'quote:', quote.id);
        // 把 next_followup_at 设为 null，避免每天都来检查
        await admin.from('quotes').update({ next_followup_at: null }).eq('id', quote.id);
        skippedFree++;
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
          message_id: sentRes?.id || '',
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

  return NextResponse.json({ ok: true, sent, skippedFree });
}

export async function GET(req: Request) {
  return handler(req);
}

export async function POST(req: Request) {
  return handler(req);
}
