import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 邮件链接统一落地（找回密码，后续也可承接邮箱确认）：
// Supabase 邮件带 ?code= 跳到这里 → 服务端换取会话（cookie 在本 Route Handler 中可写）→ 跳站内目标页
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/dashboard';

  // 只允许站内路径，防 open redirect
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // code 缺失或换取失败：回登录页重新操作
  return NextResponse.redirect(`${origin}/login`);
}
