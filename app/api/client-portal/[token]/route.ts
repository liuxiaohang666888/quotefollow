import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  const { token } = params;
  
  if (!token) {
    return NextResponse.json({ ok: false, error: 'missing token' }, { status: 400 });
  }

  const admin = createAdminClient();
  
  // 1. 查找 token
  const { data: tokenData, error: tokenError } = await admin
    .from('client_access_tokens')
    .select('id, client_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle();

  if (tokenError || !tokenData) {
    return NextResponse.json({ ok: false, error: 'invalid token' }, { status: 404 });
  }

  // 2. 检查过期
  if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: 'token expired' }, { status: 410 });
  }

  // 3. 记录首次使用
  if (!tokenData.used_at) {
    await admin
      .from('client_access_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenData.id);
  }

  // 4. 查询客户数据（排除敏感信息）
  const { data: client, error: clientError } = await admin
    .from('clients')
    .select(`
      id,
      name,
      email,
      phone,
      notes,
      project_status,
      invoice_amount,
      invoice_due_date,
      invoice_paid,
      invoice_paid_at,
      last_reminder_sent,
      reminder_count,
      created_at
    `)
    .eq('id', tokenData.client_id)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ ok: false, error: 'client not found' }, { status: 404 });
  }

  // 5. 返回脱敏数据（不含 account_id、老板信息）
  return NextResponse.json({
    ok: true,
    data: {
      clientId: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      notes: client.notes,
      projectStatus: client.project_status,
      invoice: {
        amount: client.invoice_amount?.toString() || null,
        dueDate: client.invoice_due_date,
        paid: client.invoice_paid,
        paidAt: client.invoice_paid_at,
      },
      reminders: {
        lastSent: client.last_reminder_sent,
        count: client.reminder_count,
      },
      createdAt: client.created_at,
    },
  });
}
