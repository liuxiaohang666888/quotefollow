import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const admin = createAdminClient();

  let body: {
    name: string;
    company: string;
    email: string;
    website: string;
    traffic: string;
    message: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 });
  }

  const { name, company, email, website, traffic, message } = body;

  if (!name?.trim() || !company?.trim() || !email?.trim() || !website?.trim() || !traffic) {
    return NextResponse.json({ ok: false, error: 'All required fields must be filled' }, { status: 400 });
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'Invalid email format' }, { status: 400 });
  }

  // Basic URL validation
  try {
    new URL(website);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid website URL' }, { status: 400 });
  }

  try {
    // Check if email already applied
    const { data: existing } = await admin
      .from('affiliate_applications')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: false, error: 'This email has already applied' }, { status: 409 });
    }

    // Insert application
    const { error } = await admin
      .from('affiliate_applications')
      .insert({
        name: name.trim(),
        company: company.trim(),
        email: email.toLowerCase().trim(),
        website: website.trim(),
        traffic,
        message: message?.trim() || '',
        status: 'pending',
      });

    if (error) {
      console.error('[affiliate/apply] insert error:', error);
      return NextResponse.json({ ok: false, error: 'Failed to submit application' }, { status: 500 });
    }

    // TODO: Send notification email to team
    // await sendEmail({ ... })

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[affiliate/apply] error:', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}