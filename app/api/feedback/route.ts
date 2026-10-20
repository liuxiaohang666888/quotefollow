import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { isFeedbackRateLimited } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REASONS = [
  'Too expensive',
  'Missing features I need',
  'Too confusing / hard to use',
  'Found another tool',
  'It didn\u2019t get me results',
  'Other',
];

// Submit feedback (works logged-in or anonymous)
export async function POST(req: NextRequest) {
  try {
    // M10 修复：① 防垃圾数据——匿名 insert 加 IP 限流（共享限流模块）；
    // ② 取登录态必须用服务端 supabase 客户端——旧代码用浏览器端 createClient
    //    （lib/supabase/client），Node 环境里读不到 cookie，登录用户的反馈永远关联不上账号。
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    if (isFeedbackRateLimited(ip)) {
      return NextResponse.json({ ok: false, error: 'Too many submissions. Please try again later.' }, { status: 429 });
    }

    const body = await req.json();
    const reason: string = body?.reason || '';
    const details: string = (body?.details || '').slice(0, 2000);
    const kind: string = body?.kind === 'exit' ? 'exit' : 'in_app';

    if (!reason || !REASONS.includes(reason)) {
      return NextResponse.json({ ok: false, error: 'Please pick a reason.' }, { status: 400 });
    }
    if (reason === 'Other' && !details.trim()) {
      return NextResponse.json({ ok: false, error: 'Please tell us a bit more.' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Attach account if logged in (best effort)
    let accountId: string | null = null;
    let email: string | null = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        accountId = data.user.id;
        email = data.user.email ?? null;
      }
    } catch {
      // anonymous is fine
    }

    const { error } = await admin.from('feedback').insert({
      account_id: accountId,
      email,
      kind,
      reason,
      details: details.trim() || null,
    });

    if (error) {
      console.error('[feedback] insert failed:', error.code);
      return NextResponse.json({ ok: false, error: 'Could not save feedback.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  }
}

// Owner view: GET /api/feedback
// M10 修复：密钥从 URL query（?key=）改为 Authorization Header——query 会进
// Vercel 访问日志/浏览器历史/Referer，等于把 CRON_SECRET 写进日志。
// 统一走 isCronAuthorized（fail-closed + 常量时间比较）。
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ ok: false, error: 'db error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, feedback: data });
}
