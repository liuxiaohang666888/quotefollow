import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 每 6 小时跑一次，防止 Supabase 免费版因 7 天无活动自动暂停项目。
// Vercel Cron 会自动带 Authorization: Bearer $CRON_SECRET。
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from('accounts')
    .select('id', { count: 'exact', head: true });

  return NextResponse.json({ ok: true, alive: true, accounts: count ?? 0 });
}