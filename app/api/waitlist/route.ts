import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const PRODUCTS = new Set(['invoice-helper', 'booking-payment']);

export async function POST(req: Request) {
  try {
    const { email, product, source } = await req.json();

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ ok: false, error: 'invalid email' }, { status: 400 });
    }
    if (!product || !PRODUCTS.has(product)) {
      return NextResponse.json({ ok: false, error: 'invalid product' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from('waitlist').insert({
      email: email.trim().toLowerCase(),
      product,
      source: typeof source === 'string' ? source.slice(0, 200) : null,
    });

    // Unique-index violation = already on the list. That's still a success for the user.
    if (error && (error as { code?: string }).code !== '23505') {
      console.error('[waitlist] insert failed:', error);
      return NextResponse.json({ ok: false, error: 'failed to save' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'bad request' }, { status: 400 });
  }
}
