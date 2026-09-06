import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST() {
  await (await createClient()).auth.signOut();
  const cookieStore = await cookies();

  await cookieStore.delete('sb-quotefollow-auth-token');
  await cookieStore.delete('sb-quotefollow-refresh-token');

  return NextResponse.json({ ok: true });
}
