import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REASONS = [
  'Too expensive',
  'Missing features I need',
  'Too confusing / hard to use',
  'Found another tool',
  'It didn\u2019t get me results',
  'Other',
];

// Submit feedback (works logged-in or anonymous)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const reason: string = body?.reason || '';
    const details: string = (body?.details || '').slice(0, 2000);
    const kind: string = body?.kind === 'exit' ? 'exit' : 'in_app';

    if (!reason || !REASONS.includes(reason)) {
      return NextResponse.json({ ok: false, error: 'Please pick a reason.' }, { status: 400 });
    }
    if (reason === 'Other' && !details.trim()) {
      return NextResponse.json({ ok: false, error: 'Please tell us a bit more.' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Attach account if logged in (best effort)
    let accountId: string | null = null;
    let email: string | null = null;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        accountId = data.user.id;
        email = data.user.email ?? null;
      }
    } catch {
      // anonymous is fine
    }

    const { error } = await admin.from('feedback').insert({
      account_id: accountId,
      email,
      kind,
      reason,
      details: details.trim() || null,
    });

    if (error) {
      console.error('[feedback] insert failed:', error.code);
      return NextResponse.json({ ok: false, error: 'Could not save feedback.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  }
}

// Owner view: GET /api/feedback?key=<CRON_SECRET>
export async function GET(req: NextRequest) {
  const key = new URL(req.url).searchParams.get('key');
  if (!key || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ ok: false, error: 'db error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, feedback: data });
}
