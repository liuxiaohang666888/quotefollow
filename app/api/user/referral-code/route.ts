import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'QF-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const { data: { user } } = await request.json();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Check if user already has a referral code
    const { data: existing } = await supabase
      .from('accounts')
      .select('referral_code')
      .eq('id', user.id)
      .single();

    if (existing?.referral_code) {
      return NextResponse.json({ referral_code: existing.referral_code });
    }

    // Generate and save a new referral code
    const newCode = generateReferralCode();
    const { error } = await supabase
      .from('accounts')
      .update({ referral_code: newCode })
      .eq('id', user.id);

    if (error) {
      console.error('Failed to set referral_code:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ referral_code: newCode });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
