import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

async function handleLogout(request: Request) {
  const cookieStore = await cookies();
  try {
    await (await createClient()).auth.signOut();
  } catch {
    // signOut 网络异常不阻塞退出，本地 cookie 仍强制清理
  }

  await cookieStore.delete('sb-quotefollow-auth-token');
  await cookieStore.delete('sb-quotefollow-refresh-token');

  // 同源跳转：本地 / 预览 / 生产环境都回到当前站的 /login，不再硬编码生产域名
  const response = NextResponse.redirect(new URL('/login', request.url), { status: 302 });
  // 兜底：在响应上直接过期 auth cookie，防止残留 session 导致秒登回
  response.cookies.set('sb-quotefollow-auth-token', '', { maxAge: 0, path: '/' });
  response.cookies.set('sb-quotefollow-refresh-token', '', { maxAge: 0, path: '/' });
  return response;
}

export async function POST(request: Request) {
  return handleLogout(request);
}

// L4 修复：删除 GET 导出——GET 可被跨站 <img>/<link> 静默触发（登录态用户访问恶意页面即被注销，
// 也可作为注销 CSRF 的放大器）。全站调用方均为 <form method="post">（dashboard/layout、dashboard/page），
// 无 GET 调用方。如未来确需 GET 兜底，应加 CSRF token 而非裸放行。