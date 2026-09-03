import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidPaypalSubscriptionId, verifyPaypalSubscription } from '@/lib/paypal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 简易内存限流：防止脚本批量注册（Vercel 单实例够用，多实例时每个实例独立限流）
const signupWindow = 60_000; // 60 秒
const signupMax = 5; // 每 IP 每 60 秒最多 5 次
const signupLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (signupLog.get(ip) || []).filter((t) => now - t < signupWindow);
  if (arr.length >= signupMax) {
    signupLog.set(ip, arr);
    return true;
  }
  arr.push(now);
  signupLog.set(ip, arr);
  return false;
}

export async function POST(req: NextRequest) {
  try {
    // 1. 防脚本批量注册（基础限流，服务端无真实 IP 时用 x-forwarded-for）
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json({ ok: false, error: 'too many signup attempts, slow down' }, { status: 429 });
    }

    const body = await req.json();
    const { userId, businessName, email, followupEmail, paypalSubscriptionId } = body;

    if (!userId || !email) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    // 2. 防白嫖：必须有真实 PayPal 订阅 ID（格式 I- 开头）
    if (!isValidPaypalSubscriptionId(paypalSubscriptionId)) {
      return NextResponse.json(
        { ok: false, error: 'Valid PayPal subscription is required. Please subscribe first.' },
        { status: 402 }
      );
    }

    // 3. 服务端真验证（配了 PAYPAL_CLIENT_SECRET 时执行；没配则仅格式校验）
    const verify = await verifyPaypalSubscription(paypalSubscriptionId);
    if (!verify.ok) {
      return NextResponse.json({ ok: false, error: `Subscription verification failed: ${verify.reason}` }, { status: 402 });
    }

    const admin = createAdminClient();

    // 4. 确认邮箱
    const { error: confirmError } = await admin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });
    if (confirmError) {
      console.error('[signup/api] email confirm failed:', confirmError);
      // 不阻断，继续
    }

    // 5. 插入或更新账户
    const { error: insertError } = await admin
      .from('accounts')
      .upsert({
        id: userId,
        business_name: businessName,
        followup_email: (followupEmail || '').toLowerCase().trim(),
        paypal_subscription_id: paypalSubscriptionId,
      }, {
        onConflict: 'id',
      });

    if (insertError) {
      console.error('[signup/api] account upsert failed:', insertError);
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }

    console.log('[signup/api] account created successfully:', userId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[signup/api] unexpected error:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Unknown error' }, { status: 500 });
  }
}
