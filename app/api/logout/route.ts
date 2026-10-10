import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

async function handleLogout() {
  await (await createClient()).auth.signOut();
  const cookieStore = await cookies();

  await cookieStore.delete('sb-quotefollow-auth-token');
  await cookieStore.delete('sb-quotefollow-refresh-token');

  return NextResponse.redirect(new URL('/login', 'https://www.voxalo.top'));
}

export async function POST() {
  return handleLogout();
}

// 兜底：部分客户端/旧表单用 GET 提交，405 会导致退出后卡死
export async function GET() {
  return handleLogout();
}