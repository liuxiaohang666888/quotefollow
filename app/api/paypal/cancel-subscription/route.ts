import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelPaypalSubscription } from '@/lib/paypal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 用户从 Settings 页主动取消 PayPal 订阅：
// 1) 从当前用户 accounts 取 paypal_subscription_id
// 2) 调用 PayPal REST API 取消订阅
// 3) 成功后清空订阅 ID（付费检查以 paypal_subscription_id 是否有值为准，置空即回到免费/试用态）
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: account, error } = await admin
    .from('accounts')
    .select('id, paypal_subscription_id, free_months_earned, free_month_expires_at')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('[cancel-subscription] query error:', error.code, error.message);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }

  const subId = account?.paypal_subscription_id;
  if (!subId) {
    return NextResponse.json({ ok: false, error: 'no active subscription' }, { status: 400 });
  }

  const result = await cancelPaypalSubscription(subId);
  if (!result.ok) {
    console.warn(`[cancel-subscription] cancel failed for ${user.id}: ${result.reason}`);
    return NextResponse.json({ ok: false, error: result.reason }, { status: 502 });
  }

  // 取消成功：free_months_earned 真抵扣 —— 有赠送免费月则消费 1 个月并顺延 30 天，
  // 保持解锁且不清空订阅 ID（待 cron subscription-check 在免费月过期后再降级）；
  // 没有赠送免费月则按原逻辑清空订阅 ID 降级回免费/试用态。
  const earned = account?.free_months_earned || 0;
  if (earned > 0) {
    const { error: updateError } = await admin
      .from('accounts')
      .update({
        free_months_earned: earned - 1,
        free_month_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[cancel-subscription] update error:', updateError.code, updateError.message);
      return NextResponse.json({ ok: false, error: 'cancel ok but db update failed' }, { status: 500 });
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return NextResponse.json({
      ok: true,
      message: `Cancelled — you have ${earned - 1} free month(s) remaining, service stays unlocked until ${expiresAt.toISOString().slice(0, 10)}.`,
    });
  }

  // 取消成功：清空订阅 ID（service_role 更新，绕过 RLS 敏感字段触发器）
  const { error: updateError } = await admin
    .from('accounts')
    .update({ paypal_subscription_id: null })
    .eq('id', user.id);

  if (updateError) {
    console.error('[cancel-subscription] update error:', updateError.code, updateError.message);
    return NextResponse.json({ ok: false, error: 'cancel ok but db update failed' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Cancelled — service continues until the end of the current billing period.',
  });
}
