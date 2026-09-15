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
    // Read userId from body (what the hook sends)
    const body = await request.json();
    const userId = body?.user?.id ?? null;

    if (!userId) {
      console.error('No userId found in body');
      return NextResponse.json({ error: 'Unauthorized - no user id' }, { status: 401 });
    }

    console.log('Generating referral code for user:', userId);

    const supabase = createAdminClient();

    // Check if user already has a referral code
    const { data: existing, error: fetchError } = await supabase
      .from('accounts')
      .select('referral_code')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching existing referral code:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (existing?.referral_code) {
      console.log('User already has referral code:', existing.referral_code);
      return NextResponse.json({ referral_code: existing.referral_code });
    }

    // Generate and save a new referral code
    const newCode = generateReferralCode();
    console.log('Generated new code:', newCode);

    const { error: updateError } = await supabase
      .from('accounts')
      .update({ referral_code: newCode })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to set referral_code:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log('Successfully saved referral code:', newCode);
    return NextResponse.json({ referral_code: newCode });
  } catch (e: any) {
    console.error('Unexpected error in referral-code API:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}