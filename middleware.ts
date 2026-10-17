import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// CSRF 同源校验：浏览器发起的写请求（POST/PUT/PATCH/DELETE）必须带同源 Origin/Referer。
// 服务器间调用（PayPal Webhook、Vercel Cron、curl 等）不带 Origin/Referer，直接放行，
// 由各路由自身签名校验 / cron-auth 兜底，避免误伤 webhook。
function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const target = origin || referer;
  if (!target) return true; // 非浏览器发起（webhook / cron / 服务端脚本）
  try {
    const host = new URL(target).host;
    // 优先取 Vercel 等平台注入的转发头，其次取 Host
    const reqHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host;
    return host === reqHost;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  // CSRF 防护：对 /api 下的非安全方法请求做同源校验，跨站伪造直接 403
  const method = request.method;
  if (
    request.nextUrl.pathname.startsWith('/api/') &&
    method !== 'GET' &&
    method !== 'HEAD' &&
    method !== 'OPTIONS'
  ) {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ ok: false, error: 'cross-site request blocked' }, { status: 403 });
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const supabase = createServerClient(
    url,
    key,
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
  // 登录页面也不需要 auth

  return supabaseResponse;
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*', '/login', '/signup'],
};
