import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST() {
  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json({ ok: false, error: 'auth required' }, { status: 401 });
  }

  // 1) 取所有待处理 followup（30分钟内过期）
  const { data: pending, error: pendingErr } = await admin
    .from('followup_tasks')
    .select('*')
    .or('status.eq.pending,expires_at.lte.' + new Date(Date.now() + 30 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true });

  if (pendingErr) {
    return NextResponse.json({ ok: false, error: pendingErr.message }, { status: 500 });
  }

  // 2) 取所有待发送 quote
  const { data: quotes, error: quotesErr } = await admin
    .from('quotes')
    .select('*')
    .eq('status', 'draft');

  if (quotesErr) {
    return NextResponse.json({ ok: false, error: quotesErr.message }, { status: 500 });
  }

  // 3) 批量执行（这里只是计数，真正的发送走 followup_tasks 中的逻辑）
  return NextResponse.json({
    ok: true,
    pendingFollowups: pending?.length ?? 0,
    pendingQuotes: quotes?.length ?? 0,
  });
}
