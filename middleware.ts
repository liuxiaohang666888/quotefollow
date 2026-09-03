import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://keydirdjkcjudfhqtdud.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_QOmFw19MwpfK1cMmjKfaHQ_2vm71C9q',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 如果用户在 dashboard 但没有有效会话，检查是否有 subscription 记录
  if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    // 检查是否有 cookies 标识已登录但未 session
    // 这只是一个 fallback，主要依赖 Supabase auth
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // signup 页面不需要 auth，任何人可以访问
  // 但我们需要在 signup 内部检查是否已付款（通过 ?sub= 参数）

  return supabaseResponse;
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup'],
};
