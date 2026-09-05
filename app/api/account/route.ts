import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// 读取/更新老板账号设置（业务信息、跟进邮箱、Slack、自动回复开关）
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.from('accounts').select('*').eq('id', user.id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, account: data });
}

export async function PUT(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { business_name, followup_email, slack_webhook, business_info, auto_reply_enabled } = body || {};

  const updates: Record<string, unknown> = {};
  if (business_name !== undefined) updates.business_name = business_name;
  if (slack_webhook !== undefined) updates.slack_webhook = slack_webhook;
  if (business_info !== undefined) updates.business_info = business_info;
  if (auto_reply_enabled !== undefined) updates.auto_reply_enabled = !!auto_reply_enabled;

  // 用 admin client：行不存在则自动补建（防注册流程因邮箱确认未建行）
  const admin = createAdminClient();
  const { data: existing } = await admin.from('accounts').select('id').eq('id', user.id).maybeSingle();

  const { data, error } = existing
    ? await admin.from('accounts').update(updates).eq('id', user.id).select().single()
    : await admin
        .from('accounts')
        .insert({
          id: user.id,
          // 补齐必填默认值：email 用于入站邮件匹配账户，followup_email 用于跟进发信
          email: user.email ?? '',
          followup_email: 'follow@voxalo.top',
          ...updates,
        })
        .select()
        .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, account: data });
}
