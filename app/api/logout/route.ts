import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();
  const url = req.nextUrl.clone();
  url.pathname = '/';
  return NextResponse.redirect(url);
}
