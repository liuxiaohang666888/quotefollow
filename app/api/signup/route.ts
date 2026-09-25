import { NextRequest, NextResponse } from 'next/server';
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

    // Confirm email
    await admin.auth.admin.updateUserById(userId, { email_confirm: true });

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
        await fetch(`${new URL(req.url).origin}/api/referral/complete`, {
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
