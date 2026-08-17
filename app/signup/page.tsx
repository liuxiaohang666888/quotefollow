'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [followupEmail, setFollowupEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  // PayPal 付款成功后会带 ?sub=<subscriptionID> 跳过来，识别到就显示"已收款"横幅 + 换标题
  const [paid, setPaid] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sub = new URLSearchParams(window.location.search).get('sub');
      if (sub) setPaid(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      setLoading(false);
      return;
    }

    const supabase = createClient();

    // 1) 创建 auth 用户
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }
    const userId = data.user?.id;
    if (!userId) {
      setError('Signup failed. Please check your email and try again.');
      setLoading(false);
      return;
    }

    // 2) 创建 accounts 记录（RLS insert 策略允许本用户插入自己的行）
    const { error: accError } = await supabase.from('accounts').insert({
      id: userId,
      business_name: businessName,
      followup_email: followupEmail.toLowerCase().trim(),
    });
    if (accError) {
      console.error('[signup] account insert failed:', accError);
      setError('Account created, but we could not save your details. Please contact support.');
      setLoading(false);
      return;
    }

    // 3) 自动确认邮箱（service_role 后端确认，跳过邮件验证，保证全自动）
    fetch('/api/signup/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).catch((e) => console.warn('[signup] auto-confirm failed:', e));

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        {paid && (
          <div style={{
            background: '#d1fae5', border: '1px solid #10b981', color: '#065f46',
            borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600,
            marginBottom: 20,
          }}>
            ✓ Payment received — create your account below to open your dashboard.
          </div>
        )}
        <h1>{paid ? 'Create your account' : 'Start your 14-day free trial'}</h1>
        <p className="sub">
          {paid
            ? "You're 30 seconds away from your dashboard."
            : 'Set up in 10 minutes — no credit card required'}
        </p>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Business name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Sparkle Clean Co."
              required
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourbusiness.com"
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label>Your follow-up inbox (optional — set up later)</label>
            <input
              type="email"
              value={followupEmail}
              onChange={(e) => setFollowupEmail(e.target.value)}
              placeholder="follow@yourbusiness.com"
            />
            <div className="hint">
              The address you&apos;ll BCC on every quote. Leave blank to set up in settings.
            </div>
          </div>
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <div className="alt-link">
          Already have an account? <Link href="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
