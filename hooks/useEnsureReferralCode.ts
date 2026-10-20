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
    
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { setLoading(false); return; }
      
      try {
        // H3 修复：删掉 Authorization: Bearer <token> 头——该 API 的鉴权走
        // Supabase cookie 会话（服务端 auth.getUser()），从来不读这个头。
        // 留着只会造成"已校验 token"的错觉，且把 access_token 多暴露一次。
        const res = await fetch('/api/user/referral-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: { id: session.user.id } }),
        });
        
        if (res.ok) {
          const data = await res.json();
          setReferralCode(data.referral_code || null);
        } else {
          const err = await res.json();
          console.error('Referral code API error:', res.status, err);
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