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

// 兜底：部分客户端/旧表单用 GET 提交，405 会导致退出后卡死
export async function GET(request: Request) {
  return handleLogout(request);
}