import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SignupForm from './SignupForm';

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ sub?: string; ref?: string }> }) {
  const resolvedSearchParams = await searchParams;
    const rawSub = resolvedSearchParams.sub ?? undefined;
    const paypalSub = rawSub && /^I-[A-Za-z0-9]+$/.test(rawSub) ? rawSub : null;
    const refCode = resolvedSearchParams.ref ?? null;

    return (
      <Suspense fallback={<div className="auth-wrap"><div className="auth-card" style={{ textAlign: 'center' }}>Loading…</div></div>}>
        <SignupForm paypalSub={paypalSub} refCode={refCode} />
      </Suspense>
    );
}
