'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Auto-generates a referral code for the current user if they don't have one.
 * Call this once on Dashboard mount.
 */
export function useEnsureReferralCode() {
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      try {
        const res = await fetch('/api/user/referral-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: { id: user.id } }),
        });
        if (!res.ok) console.error('Failed to ensure referral code:', res.status);
      } catch (e) {
        console.error('Referral code ensure error:', e);
      }
    });
  }, []);
}
