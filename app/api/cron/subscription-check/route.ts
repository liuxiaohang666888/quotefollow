import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPaypalSubscription } from '@/lib/paypal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 每小时检查一次所有付费用户的订阅状态，自动降级过期账户
export async function POST(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
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
  let errors = 0;

  for (const acc of accounts) {
    if (!acc.paypal_subscription_id) continue;
    checked++;

    try {
      const verify = await verifyPaypalSubscription(acc.paypal_subscription_id);
      if (!verify.ok) {
        console.warn(
          `[cron/subscription-check] subscription INACTIVE for ${acc.email}: ${verify.reason} (sub=${acc.paypal_subscription_id})`
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

  return NextResponse.json({ ok: true, checked, downgraded, errors });
}
