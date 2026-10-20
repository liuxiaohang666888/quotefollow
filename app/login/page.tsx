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
  // 随机盐：每次渲染生成随机 name，阻止浏览器密码管理器按固定 name 匹配自动填充
  const [fieldSalt] = useState(() => Math.random().toString(36).slice(2, 10));
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
        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              name={`qf-email-${fieldSalt}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              name={`qf-pass-${fieldSalt}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <button className="btn" data-magnetic type="submit" disabled={loading} style={{ width: '100%' }}>
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