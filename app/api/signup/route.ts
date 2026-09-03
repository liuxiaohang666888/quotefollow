import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, businessName, email, followupEmail, paypalSubscriptionId } = body;

    if (!userId || !email) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. 确认邮箱
    const { error: confirmError } = await admin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });
    if (confirmError) {
      console.error('[signup/api] email confirm failed:', confirmError);
      // 不阻断，继续
    }

    // 2. 插入或更新账户
    const { error: insertError } = await admin
      .from('accounts')
      .upsert({
        id: userId,
        business_name: businessName,
        followup_email: (followupEmail || '').toLowerCase().trim(),
        paypal_subscription_id: paypalSubscriptionId || null,
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
