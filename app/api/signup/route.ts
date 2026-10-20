import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidPaypalSubscriptionId, verifyPaypalSubscription } from '@/lib/paypal';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ipWindow = 24 * 60 * 60 * 1000;
const ipLog = new Map<string, number>();
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
    const { userId, businessName, email, followupEmail, paypalSubscriptionId, referralCode } = body;

    if (!userId || !email) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    // 鉴权（防越权）：已登录用户只能为自己的 userId 建档，
    // 禁止凭 body 伪造他人 userId 建账号/改 referral_code。
    // 未登录场景（邮箱确认流程中 supabase.auth.signUp 尚未产生会话）走到下方
    // "仅首次插入" 分支处理，同样禁止改写已存在的账号行。
    const supabase = await createClient();
    const { data: { user: sessionUser } } = await supabase.auth.getUser();
    if (sessionUser && userId !== sessionUser.id) {
      return NextResponse.json({ ok: false, error: 'userId does not match the logged-in user' }, { status: 403 });
    }

    const emailCheck = isEmailRepeated(email.toLowerCase());
    if (emailCheck.blocked) {
      return NextResponse.json({ ok: false, error: `This email has been used too many times (${emailCheck.count}). Try a different email.` }, { status: 429 });
    }

    if (paypalSubscriptionId) {
      if (!isValidPaypalSubscriptionId(paypalSubscriptionId)) {
        return NextResponse.json({ ok: false, error: 'Invalid subscription ID format. Must start with I-.' }, { status: 400 });
      }
      const verify = await verifyPaypalSubscription(paypalSubscriptionId);
      if (!verify.ok) {
        return NextResponse.json({ ok: false, error: `Subscription verification failed: ${verify.reason}` }, { status: 402 });
      }
    }

    const admin = createAdminClient();

    // Do NOT force email_confirm: standard Supabase email confirmation flow applies

    // Generate referral code for new user
    const newReferralCode = 'QF-' + randomUUID().slice(0, 8).toUpperCase();

    // Upsert account with referral code
    const upsertData: any = {
      id: userId,
      business_name: businessName,
      email,
      followup_email: 'follow@voxalo.top',
      paypal_subscription_id: paypalSubscriptionId,
      referral_code: newReferralCode,
    };
    // 试用期显式跟踪：仅新账号写入 trial_ends_at（14 天后到期），已存在账号不覆盖
    const { data: existingAccount } = await admin
      .from('accounts')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    // 防越权兜底：账号行已存在、但当前没有"登录态归属该 userId"的证明时，拒绝一切写入。
    // 已登录用户已在上面校验 userId === session.user.id；这里封堵"无会话 + 行已存在"的
    // 伪造写入路径（敌手可凭 body 任意 userId 覆盖他人账号字段/ referral_code）。
    // 按幂等成功返回，不破坏注册流程前端提示。
    if (existingAccount && !(sessionUser && sessionUser.id === userId)) {
      console.warn('[signup/api] account row exists without matching session — write skipped:', userId);
      return NextResponse.json({ ok: true, referralCode: null, skipped: true });
    }

    if (!existingAccount) {
      upsertData.trial_ends_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    }
    if (referralCode) {
      upsertData.referred_by = referralCode; // This will be set after we look it up
    }

    const { error: insertError } = await admin
      .from('accounts')
      .upsert(upsertData, { onConflict: 'id' });

    if (insertError) {
      console.error('[signup/api] account upsert failed:', insertError.code);
      return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
    }

    // If referral code provided, look up referrer and create referral record
    if (referralCode) {
      const { data: referrer } = await admin
        .from('accounts')
        .select('id')
        .eq('referral_code', referralCode)
        .single();

      if (referrer && referrer.id !== userId) {
        // Create pending referral
        await admin.from('referrals').insert({
          referrer_id: referrer.id,
          referred_id: userId,
          status: 'pending',
          free_months_granted: 0,
        });

        // Update referred_by field
        await admin
          .from('accounts')
          .update({ referred_by: referrer.id })
          .eq('id', userId);

        console.log('[signup/api] referral recorded:', referrer.id, '->', userId);
      }
    }

    console.log('[signup/api] account created/updated:', userId);

    // If this signup came with a paid subscription (?sub=), complete any pending referral
    if (paypalSubscriptionId) {
      try {
        const cronSecret = process.env.CRON_SECRET;
        await fetch(`${new URL(req.url).origin}/api/referral/complete${cronSecret ? `?secret=${encodeURIComponent(cronSecret)}` : ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
      } catch (e) {
        console.error('[signup/api] referral complete call failed');
      }
    }
    return NextResponse.json({ ok: true, referralCode: newReferralCode });
  } catch (e: any) {
    console.error('[signup/api] unexpected error:', e?.code || e);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
