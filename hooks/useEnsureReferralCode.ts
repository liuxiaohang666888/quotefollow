'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Auto-generates a referral code for the current user if they don't have one.
 * Returns the code (null if user not logged in).
 */
export function useEnsureReferralCode(): { referral_code: string | null; loading: boolean } {
  const [referral_code, setReferralCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      try {
        const res = await fetch('/api/user/referral-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: { id: user.id } }),
        });
        if (res.ok) {
          const data = await res.json();
          setReferralCode(data.referral_code || null);
        }
      } catch (e) {
        console.error('Referral code ensure error:', e);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  return { referral_code, loading };
}
