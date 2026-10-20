import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// H3 修复：Math.random 不满足密码学随机（可预测种子 → 可枚举/抢注别人的推荐码），
// 改用 crypto.randomBytes；撞唯一索引（23505）时重试，最多 5 次。
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'QF-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(randomBytes(1)[0] % chars.length);
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

    // 鉴权（防越权）：必须登录，且只能为自己的账号生成/读取 referral_code，
    // 禁止凭 body 伪造 userId 给任意账号设 referral_code。
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - not logged in' }, { status: 401 });
    }
    if (userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden - userId does not match logged-in user' }, { status: 403 });
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

    // Generate and save a new referral code（撞唯一索引重试，最多 5 次）
    let newCode = '';
    let saved = false;
    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      newCode = generateReferralCode();
      const { error: updateError } = await supabase
        .from('accounts')
        .update({ referral_code: newCode })
        .eq('id', userId);

      if (!updateError) {
        saved = true;
      } else if ((updateError as { code?: string }).code === '23505') {
        console.warn('referral_code collision, retrying:', newCode);
        continue;
      } else {
        console.error('Failed to set referral_code:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    if (!saved) {
      return NextResponse.json({ error: 'could not generate a unique referral code, please retry' }, { status: 500 });
    }

    console.log('Successfully saved referral code:', newCode);
    return NextResponse.json({ referral_code: newCode });
  } catch (e: any) {
    console.error('Unexpected error in referral-code API:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}