import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidPaypalSubscriptionId, verifyPaypalSubscription } from '@/lib/paypal';
import { isCronAuthorized } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Complete pending referrals when a referred user becomes a paid subscriber.
// —— 内部接口，只能被服务端调用（signup API / subscription-check cron）
// —— 鉴权：复用 isCronAuthorized（与 cron 接口一致，CRON_SECRET 未设时放行）
//
// Body: { userId } — the user who just paid.
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'userId required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // ✅ 先验证这个用户确实有有效的 PayPal 订阅
    const { data: acc } = await admin
      .from('accounts')
      .select('id, email, paypal_subscription_id')
      .eq('id', userId)
      .maybeSingle();

    if (!acc || !acc.paypal_subscription_id || !isValidPaypalSubscriptionId(acc.paypal_subscription_id)) {
      return NextResponse.json({ ok: false, error: 'user is not a paid subscriber' }, { status: 402 });
    }

    // 二次确认：调 PayPal API 验证订阅确实是 ACTIVE
    const verify = await verifyPaypalSubscription(acc.paypal_subscription_id);
    if (!verify.ok) {
      return NextResponse.json({ ok: false, error: `subscription not active: ${verify.reason}` }, { status: 402 });
    }

    // Find pending referrals pointing to this user
    const { data: pending, error } = await admin
      .from('referrals')
      .select('id, referrer_id, referred_id, free_months_granted, status')
      .eq('referred_id', userId)
      .eq('status', 'pending');

    if (error) {
      console.error('[referral/complete] query error:', error.code);
      return NextResponse.json({ ok: false, error: 'db error' }, { status: 500 });
    }
    if (!pending || pending.length === 0) {
      return NextResponse.json({ ok: true, completed: 0 });
    }

    let completed = 0;
    for (const r of pending) {
      // Mark referral completed (+1 month for each side)
      const { error: updateErr } = await admin
        .from('referrals')
        .update({ 
          status: 'completed', 
          free_months_granted: 1, 
          completed_at: new Date().toISOString(),
          subscription_id: acc.paypal_subscription_id,
        })
        .eq('id', r.id)
        .eq('status', 'pending'); // 乐观锁：确保还是 pending 状态

      if (!updateErr) {
        completed++;
      }
    }

    if (completed > 0) {
      // Increment free_months_earned for both parties
      for (const accountId of [pending[0].referrer_id, userId]) {
        const { data: accData } = await admin
          .from('accounts')
          .select('free_months_earned')
          .eq('id', accountId)
          .maybeSingle();
        if (accData) {
          await admin
            .from('accounts')
            .update({ free_months_earned: (accData.free_months_earned || 0) + 1 })
            .eq('id', accountId);
        }
      }
    }

    console.log('[referral/complete] completed', completed, 'referral(s) for user:', userId);
    return NextResponse.json({ ok: true, completed });
  } catch (e: any) {
    console.error('[referral/complete] unexpected error:', e?.message || e);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
