import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// 注册成功后自动把邮箱标为已确认（service_role 后端确认），
// 跳过 Supabase 默认的邮件验证，保证"付款→注册→进后台"全自动不卡壳。
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Missing userId' }, { status: 400 });
    }
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
    if (error) {
      console.error('[signup/confirm]', error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Unknown error' }, { status: 500 });
  }
}
