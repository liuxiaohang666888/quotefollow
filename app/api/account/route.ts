import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json({ ok: false, error: 'auth required' }, { status: 401 });
  }

  const { data, error } = await admin
    .from('accounts')
    .select('id, email, name, followup_email, company, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[account] GET error:', error.code, error.message);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}

export async function PUT(request: Request) {
  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json({ ok: false, error: 'auth required' }, { status: 401 });
  }

  const body = await request.json();
  const { id, name, email, company, followup_email } = body;

  if (!id || !email) {
    return NextResponse.json({ ok: false, error: 'missing id or email' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('accounts')
    .update({ name, email, company, followup_email, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[account] PUT error:', error.code, error.message);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}
