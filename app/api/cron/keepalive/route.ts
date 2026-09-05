import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 每 6 小时跑一次，防止 Supabase 免费版因 7 天无活动自动暂停项目。
// Vercel Cron 会自动带 Authorization: Bearer $CRON_SECRET。
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  // fail-closed：CRON_SECRET 未配置时直接拒绝（接口只做 count 查询，拒绝不影响数据）
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from('accounts')
    .select('id', { count: 'exact', head: true });

  return NextResponse.json({ ok: true, alive: true, accounts: count ?? 0 });
}