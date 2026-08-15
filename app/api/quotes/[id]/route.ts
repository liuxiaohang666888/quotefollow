import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// 更新报价状态（成交 / 流失 / 重新跟进等），用户从仪表盘操作
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { status, amount, service_type, customer_name } = body || {};

  // 只允许合法的状态迁移
  const allowed = ['following', 'replied', 'won', 'lost'];
  if (status && !allowed.includes(status)) {
    return NextResponse.json({ ok: false, error: 'invalid status' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (status !== undefined) {
    updates.status = status;
    // 成交后停止自动跟进
    if (status === 'won' || status === 'lost') updates.next_followup_at = null;
  }
  if (amount !== undefined) updates.amount = amount;
  if (service_type !== undefined) updates.service_type = service_type;
  if (customer_name !== undefined) updates.customer_name = customer_name;

  const { data, error } = await supabase
    .from('quotes')
    .update(updates)
    .eq('id', params.id)
    .eq('account_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, quote: data });
}

// 删除报价
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', params.id)
    .eq('account_id', user.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
