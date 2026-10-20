import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 邮件链接统一落地（找回密码，后续也可承接邮箱确认）：
// Supabase 邮件带 ?code= 跳到这里 → 服务端换取会话（cookie 在本 Route Handler 中可写）→ 跳站内目标页
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get('code');

  // 只允许站内路径，防 open redirect（L5 修复）：
  // 旧代码只挡 // 开头，漏了 /\（部分浏览器会把反斜杠规范化成正斜杠 → //evil.com）。
  // 现在用 new URL(next, origin) 解析，只放行"解析后 host 与本站一致、且 pathname 以 / 开头"的目标。
  const next = searchParams.get('next') || '/dashboard';
  let safeNext = '/dashboard';
  try {
    const target = new URL(next, origin);
    if (target.origin === origin && target.pathname.startsWith('/') && !target.pathname.startsWith('//')) {
      safeNext = target.pathname + target.search;
    }
  } catch {
    // 解析失败 → 回落默认页
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // code 缺失或换取失败：回登录页重新操作
  return NextResponse.redirect(`${origin}/login`);
}
