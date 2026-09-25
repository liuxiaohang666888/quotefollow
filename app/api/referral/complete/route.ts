import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Complete pending referrals when a referred user becomes a paid subscriber.
// Called from signup flow (with ?sub=) or subscription-check cron.
// Body: { userId } — the user who just paid.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'userId required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Find pending referrals pointing to this user
    const { data: pending, error } = await admin
      .from('referrals')
      .select('id, referrer_id, referred_id, free_months_granted')
      .eq('referred_id', userId)
      .eq('status', 'pending');

    if (error) {
      console.error('[referral/complete] query error:', error.code);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    if (!pending || pending.length === 0) {
      return NextResponse.json({ ok: true, completed: 0 });
    }

    for (const r of pending) {
      // Mark referral completed (+1 month for each side)
      await admin
        .from('referrals')
        .update({ status: 'completed', free_months_granted: 1, completed_at: new Date().toISOString() })
        .eq('id', r.id);
    }

    // Increment free_months_earned for both parties (manual, reliable)
    for (const accountId of [pending[0].referrer_id, userId]) {
      const { data: acc } = await admin
        .from('accounts')
        .select('free_months_earned')
        .eq('id', accountId)
        .maybeSingle();
      if (acc) {
        await admin
          .from('accounts')
          .update({ free_months_earned: (acc.free_months_earned || 0) + 1 })
          .eq('id', accountId);
      }
    }

    console.log('[referral/complete] completed referral for user:', userId);
    return NextResponse.json({ ok: true, completed: pending.length });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
