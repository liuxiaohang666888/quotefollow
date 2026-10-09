import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 允许用户自行修改的字段（安全字段）
const SAFE_UPDATE_FIELDS = [
  'business_name',
  'followup_email',
  'slack_webhook',
  'auto_reply_enabled',
  'business_info',
];

// GET: 获取当前登录用户的账号信息
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: account, error } = await admin
    .from('accounts')
    .select('id, email, business_name, followup_email, slack_webhook, auto_reply_enabled, business_info, paypal_subscription_id, referral_code, free_months_earned, created_at, updated_at')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('[account] GET error:', error.code, error.message);
    // 如果账号不存在（可能是注册中断），返回空结构让前端处理
    if (error.code === 'PGRST116') {
      return NextResponse.json({ ok: true, account: null });
    }
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, account });
}

// PUT: 修改当前登录用户的账号信息（只能改安全字段）
export async function PUT(req: NextRequest) {
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

  // 只保留安全字段，过滤掉敏感字段（如 paypal_subscription_id, free_months_earned 等）
  const updateData: Record<string, any> = {};
  for (const field of SAFE_UPDATE_FIELDS) {
    if (field in body) {
      updateData[field] = body[field];
    }
  }

  // 如果没有可更新的字段
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ ok: false, error: 'no valid fields to update' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: account, error } = await admin
    .from('accounts')
    .update(updateData)
    .eq('id', user.id)
    .select('id, email, business_name, followup_email, slack_webhook, auto_reply_enabled, business_info, paypal_subscription_id, referral_code, free_months_earned, created_at, updated_at')
    .single();

  if (error) {
    console.error('[account] PUT error:', error.code, error.message);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, account });
}
