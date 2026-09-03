'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isAdminEmail } from '@/lib/paywall';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function hasAccess(supabase: any): Promise<boolean> {
    const { data: authData } = await supabase.auth.getUser();
    if (isAdminEmail(authData.user?.email)) return true;
    const { data: account } = await supabase
      .from('accounts')
      .select('paypal_subscription_id')
      .single();
    return !!account?.paypal_subscription_id && /^I-[A-Z0-9]+$/i.test(account.paypal_subscription_id);
  }

  // 检查是否已登录且已付费
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // 已登录，检查是否付费
        const ok = await hasAccess(supabase);
        if (ok) {
          // 已付费，跳转到dashboard
          router.push('/dashboard');
        } else {
          // 未付费，清除session并跳转signup
          await supabase.auth.signOut();
          router.push('/signup');
        }
      }
    };
    checkAuth();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    
    // 登录成功后检查是否付费
    const ok = await hasAccess(supabase);
    if (ok) {
      router.push('/dashboard');
    } else {
      // 未付费，跳转到signup
      await supabase.auth.signOut();
      router.push('/signup');
    }
    setLoading(false);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p className="sub">Log in to your QuoteFollow dashboard</p>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <div className="alt-link">
          No account? <Link href="/signup">Get started</Link>
        </div>
      </div>
    </div>
  );
}
