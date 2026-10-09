import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPaypalSubscription } from '@/lib/paypal';
import { isCronAuthorized } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 每天检查一次所有付费用户的订阅状态，自动降级过期账户
// 注意：Vercel Cron 发的是 GET，外部 cron 服务可能发 POST，两者都支持
async function handler(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // 取所有有 paypal_subscription_id 的账户
  const { data: accounts, error } = await admin
    .from('accounts')
    .select('id, email, paypal_subscription_id')
    .not('paypal_subscription_id', 'is', null);

  if (error) {
    console.error('[cron/subscription-check] query error:', error);
    return NextResponse.json({ ok: false, error: 'db error' }, { status: 500 });
  }

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ ok: true, checked: 0 });
  }

  let checked = 0;
  let downgraded = 0;
  let skippedTransient = 0;
  let errors = 0;

  // 只有"确定性失效"才降级；PayPal API 抖动/超时/5xx 跳过，防止误伤付费用户
  const DEFINITIVE_INACTIVE = ['CANCELLED', 'SUSPENDED', 'EXPIRED'];

  for (const acc of accounts) {
    if (!acc.paypal_subscription_id) continue;
    checked++;

    try {
      const verify = await verifyPaypalSubscription(acc.paypal_subscription_id);
      if (!verify.ok) {
        const definitive =
          (verify.status && DEFINITIVE_INACTIVE.includes(verify.status)) ||
          /not found \(http 404\)/.test(verify.reason);

        if (!definitive) {
          // PayPal 网络抖动 / auth 失败 / 未知状态 —— 不降级，等下次 cron
          console.warn(
            `[cron/subscription-check] TRANSIENT verify failure for ${acc.email}: ${verify.reason} — skipping downgrade`
          );
          skippedTransient++;
          continue;
        }

        console.warn(
          `[cron/subscription-check] subscription DEFINITIVELY INACTIVE for ${acc.email}: ${verify.reason} (sub=${acc.paypal_subscription_id})`
        );
        // 降级：清除订阅 ID，用户变回免费版
        await admin
          .from('accounts')
          .update({ paypal_subscription_id: null })
          .eq('id', acc.id);
        downgraded++;
        console.log(`[cron/subscription-check] DOWNGRADED ${acc.email} back to free plan`);
      }
    } catch (e) {
      errors++;
      console.error('[cron/subscription-check] verify error for', acc.email, e);
    }
  }

  return NextResponse.json({ ok: true, checked, downgraded, skippedTransient, errors });
}

export async function GET(req: Request) {
  return handler(req);
}

export async function POST(req: Request) {
  return handler(req);
}
