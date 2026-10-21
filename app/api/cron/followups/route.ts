import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateFollowupBody } from '@/lib/ai';
import { sendEmail } from '@/lib/resend';
import { FREE_QUOTA, isAdminEmail, isTrialActive, hasActiveFreeMonth } from '@/lib/paywall';
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
  const accountCache = new Map<string, { isPaid: boolean; quoteCount?: number; createdAt?: string | null; trialEndsAt?: string | null }>();

  async function getAccountStatus(accountId: string, accountEmail: string): Promise<{ isPaid: boolean; withinQuota: boolean }> {
    if (!accountCache.has(accountId)) {
      const isAdmin = isAdminEmail(accountEmail);

      // 先查账号的订阅状态
      const { data: acc } = await admin
        .from('accounts')
        .select('paypal_subscription_id, email, created_at, trial_ends_at, free_months_earned, free_month_expires_at')
        .eq('id', accountId)
        .maybeSingle();

      const isPaid = isAdmin || !!(acc?.paypal_subscription_id && isValidPaypalSubscriptionId(acc.paypal_subscription_id)) || hasActiveFreeMonth(acc);

      if (isPaid) {
        accountCache.set(accountId, { isPaid: true, createdAt: (acc as any)?.created_at ?? null, trialEndsAt: (acc as any)?.trial_ends_at ?? null });
      } else {
        // 免费用户：统计 quote 数量
        const { count } = await admin
          .from('quotes')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId);
        accountCache.set(accountId, { isPaid: false, quoteCount: count ?? 0, createdAt: (acc as any)?.created_at ?? null, trialEndsAt: (acc as any)?.trial_ends_at ?? null });
      }
    }

    const cached = accountCache.get(accountId)!;
    if (cached.isPaid) {
      return { isPaid: true, withinQuota: true };
    }

    // 免费用户：只有前 FREE_QUOTA 个 quote（按创建时间）能发跟进
    // 我们用 quoteCount 判断是否超出总量，对于单个 quote 再判断是否在额度内
    // 试用判定统一走 isTrialActive（trial_ends_at 优先，回退 created_at+14 天，见 M12）
    const quoteCount = cached.quoteCount ?? 0;
    return {
      isPaid: false,
      withinQuota: quoteCount <= FREE_QUOTA && isTrialActive({ created_at: cached.createdAt, trial_ends_at: cached.trialEndsAt }),
    };
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
        console.log('[cron/followups] deferring free user over quota:', account.email, 'quote:', quote.id);
        // M3 修复：旧代码在这里把 next_followup_at 置 null——免费用户超额后被"永久冻结"，
        // 即使后来升级付费，这些报价的跟进也永远不会恢复（排期丢了）。
        // 现在改为推到 7 天后的重试窗口：未升级就每周来复查一次（廉价查询），
        // 一旦升级付费（或删掉部分报价回到额度内），下一次窗口自然恢复跟进。
        const retryAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await admin.from('quotes').update({ next_followup_at: retryAt }).eq('id', quote.id);
        skippedFree++;
        continue;
      }

      // 🔒 幂等护栏：先原子抢占（CAS）再发信。cron 若重叠运行（上次没跑完/手动补跑），
      // 只有一个实例能把 next_followup_at 从当前值改走，另一个实例匹配不到行即跳过，
      // 避免同一封跟进邮件被重复发送（重复消耗 AI/邮件额度、骚扰客户）。
      // 抢占窗口 30 分钟：发送失败时窗口过后次日 cron 自然重试。
      const leaseUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { data: claimed } = await admin
        .from('quotes')
        .update({ next_followup_at: leaseUntil })
        .eq('id', quote.id)
        .eq('next_followup_at', quote.next_followup_at)
        .select('id')
        .maybeSingle();
      if (!claimed) {
        console.log('[cron/followups] quote already claimed by another run, skipping:', quote.id);
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
