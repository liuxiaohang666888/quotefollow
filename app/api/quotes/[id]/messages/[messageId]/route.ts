import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// Next.js 15+/16：动态路由的 params 是 Promise，必须 await。
async function getIds(params: Promise<{ id: string; messageId: string }>): Promise<{ id: string; messageId: string }> {
  const { id, messageId } = await params;
  return { id, messageId };
}

// 删除会话消息：messages 表 RLS 无 delete 策略，客户端直删会被拒且无归属校验。
// 此接口统一走服务端：先校验登录 + 报价归属 + 消息归属，再用 service_role 执行删除。
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { id, messageId } = await getIds(params);

  // 1. 登录校验
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  // 2. 报价归属校验：quote 必须属于当前用户
  const { data: quote } = await supabase
    .from('quotes')
    .select('id')
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();
  if (!quote) {
    return NextResponse.json({ ok: false, error: 'Quote not found' }, { status: 404 });
  }

  // 3. 消息归属校验：消息必须属于该 quote，且只允许删除自己发出的(out)消息，
  //    客户回复(in)不可删除
  const { data: msg } = await supabase
    .from('messages')
    .select('id, direction')
    .eq('id', messageId)
    .eq('quote_id', id)
    .maybeSingle();
  if (!msg) {
    return NextResponse.json({ ok: false, error: 'Message not found' }, { status: 404 });
  }
  if (msg.direction !== 'out') {
    return NextResponse.json(
      { ok: false, error: 'Only messages you sent can be deleted' },
      { status: 403 }
    );
  }

  // 4. service_role 执行删除（绕过 RLS；归属已在上层校验）
  const admin = createAdminClient();
  const { data: deleted, error } = await admin
    .from('messages')
    .delete()
    .eq('id', messageId)
    .select('id');

  if (error || !deleted || deleted.length === 0) {
    return NextResponse.json({ ok: false, error: error?.message || 'Delete failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
