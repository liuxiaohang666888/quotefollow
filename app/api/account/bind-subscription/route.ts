import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidPaypalSubscriptionId } from '@/lib/paypal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 已登录用户付款后绑定订阅（P0 修复）：
// 场景：老用户试用结束/额度用尽被锁定，在弹窗内直接完成 PayPal 订阅后，
// 不跳 /signup 注册新账号，而是把 data.subscriptionID 写入当前登录账号。
//
// 安全约束：
//   - 必须通过 Supabase auth 校验当前登录用户（cookie session），未登录一律 401
//   - admin client（service_role）绕过 RLS 的 prevent_sensitive_account_update 触发器，
//     但更新条件强制 eq('id', user.id) —— 只允许写入自己的 accounts 行，
//     杜绝越权改他人订阅 ID
//   - subscriptionId 必须通过 PayPal 订阅 ID 格式校验（^I-[A-Z0-9]+$），防注入/防脏数据
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 });
  }

  const subId = typeof body?.subscriptionId === 'string' ? body.subscriptionId.trim() : '';
  if (!isValidPaypalSubscriptionId(subId)) {
    return NextResponse.json(
      { ok: false, error: 'invalid subscription id format' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: account, error } = await admin
    .from('accounts')
    .update({ paypal_subscription_id: subId })
    .eq('id', user.id)
    .select('id, email, business_name, followup_email, slack_webhook, auto_reply_enabled, business_info, payment_link, paypal_subscription_id, referral_code, free_months_earned, created_at, updated_at')
    .maybeSingle();

  if (error) {
    console.error('[bind-subscription] update error:', error.code, error.message);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }

  if (!account) {
    // 当前登录用户没有 accounts 行（注册中断等）→ 交由 /signup 注册流程处理
    return NextResponse.json(
      { ok: false, error: 'account not found — please complete signup first' },
      { status: 404 }
    );
  }

  console.log(`[bind-subscription] bound sub ${subId} to account ${account.email}`);
  return NextResponse.json({ ok: true, account });
}
