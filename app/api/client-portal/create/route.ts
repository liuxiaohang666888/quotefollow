import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { clientId, expiresInDays } = await req.json();
  const admin = createAdminClient();

  // 验证客户属于当前老板
  const { data: client, error: clientError } = await admin
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('account_id', user.id)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ ok: false, error: 'client not found' }, { status: 404 });
  }

  // 生成 token
    const { randomBytes } = await import('crypto');
    const token = randomBytes(24).toString('hex');
  
  // 计算过期时间
  let expiresAt = null;
  if (expiresInDays) {
    expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  }

  const { data: tokenData, error: tokenError } = await admin
    .from('client_access_tokens')
    .insert({
      client_id: clientId,
      token: token,
      expires_at: expiresAt,
    })
    .select('token')
    .single();

  if (tokenError) {
    console.error('[client-portal/create] error:', tokenError);
    return NextResponse.json({ ok: false, error: 'failed to create token' }, { status: 500 });
  }

  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/${tokenData.token}`;

  return NextResponse.json({ ok: true, token: tokenData.token, portalUrl });
}
