import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidPaypalSubscriptionId, verifyPaypalSubscription } from '@/lib/paypal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 防重复注册：同一 IP 每 24 小时最多注册 1 次
const ipWindow = 24 * 60 * 60 * 1000;
const ipLog = new Map<string, number>();

// 防同一邮箱重复注册：同一邮箱最多注册 3 次
const emailWindow = 24 * 60 * 60 * 1000;
const emailLog = new Map<string, number[]>();

function isIpRateLimited(ip: string): boolean {
  const last = ipLog.get(ip) || 0;
  if (Date.now() - last < ipWindow) return true;
  ipLog.set(ip, Date.now());
  return false;
}

function isEmailRepeated(email: string): { blocked: boolean; count: number } {
  const now = Date.now();
  const times = (emailLog.get(email) || []).filter((t) => now - t < emailWindow);
  emailLog.set(email, times);
  if (times.length >= 3) return { blocked: true, count: times.length };
  return { blocked: false, count: times.length };
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    if (isIpRateLimited(ip)) {
      return NextResponse.json({ ok: false, error: 'Please wait 24 hours before creating another account from this IP.' }, { status: 429 });
    }

    const body = await req.json();
    const { userId, businessName, email, followupEmail, paypalSubscriptionId } = body;

    if (!userId || !email) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    // 检查同一邮箱是否频繁注册
    const emailCheck = isEmailRepeated(email.toLowerCase());
    if (emailCheck.blocked) {
      return NextResponse.json({ ok: false, error: `This email has been used too many times (${emailCheck.count}). Try a different email.` }, { status: 429 });
    }

    // 验证 PayPal 订阅（如果提供了）
    if (paypalSubscriptionId) {
      if (!isValidPaypalSubscriptionId(paypalSubscriptionId)) {
        return NextResponse.json(
          { ok: false, error: 'Invalid subscription ID format. Must start with I-.' },
          { status: 400 }
        );
      }

      const verify = await verifyPaypalSubscription(paypalSubscriptionId);
      if (!verify.ok) {
        return NextResponse.json({ ok: false, error: `Subscription verification failed: ${verify.reason}` }, { status: 402 });
      }
    }

    const admin = createAdminClient();

    // 确认邮箱
    const { error: confirmError } = await admin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });
    if (confirmError) {
      console.error('[signup/api] email confirm failed:', confirmError);
    }

    // 插入或更新账户
    const { error: insertError } = await admin
      .from('accounts')
      .upsert({
        id: userId,
        business_name: businessName,
        email,
        followup_email: 'follow@voxalo.top',
        paypal_subscription_id: paypalSubscriptionId,
      }, {
        onConflict: 'id',
      });

    if (insertError) {
      console.error('[signup/api] account upsert failed:', insertError.code);
      return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
    }

    console.log('[signup/api] account created/updated:', userId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[signup/api] unexpected error:', e?.code || e);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
