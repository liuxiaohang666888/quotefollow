'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getBrandName } from '@/lib/vertical';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 检查是否已登录 → 直接去 dashboard
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
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
    router.push('/dashboard');
    setLoading(false);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p className="sub">Log in to your {getBrandName()} dashboard</p>
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
        <div className="alt-link" style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link href="/forgot-password" style={{ fontSize: '14px', color: 'var(--fg-dim)' }}>Forgot password?</Link>
        </div>
        <div className="alt-link">
          No account? <Link href="/signup">Get started</Link>
        </div>
      </div>
    </div>
  );
}