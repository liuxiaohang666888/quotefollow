'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// useSearchParams 需要 Suspense 边界（Next.js 静态渲染要求）
export default function SignupPage() {
  return (
    <Suspense fallback={<div className="auth-wrap"><div className="auth-card" style={{ textAlign: 'center' }}>Loading…</div></div>}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const searchParams = useSearchParams();

  // PayPal 订阅成功后跳转过来会带 ?sub=I-xxxx，必须透传保存，否则付费客户会被当成免费版
  const rawSub = searchParams.get('sub');
  const paypalSub = rawSub && /^I-[A-Za-z0-9]+$/.test(rawSub) ? rawSub : null;
  const refCode = searchParams.get('ref');

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

    let savedViaApi = false;
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          businessName,
          email,
          followupEmail: 'follow@voxalo.top',
          paypalSubscriptionId: paypalSub,
          referralCode: refCode,
        }),
      });
      const result = await res.json();
      savedViaApi = !!result?.ok;
    } catch {
      savedViaApi = false;
    }

    if (!savedViaApi) {
      const { error: directErr } = await supabase
        .from('accounts')
        .upsert(
          { id: userId, business_name: businessName, email, followup_email: 'follow@voxalo.top', paypal_subscription_id: paypalSub },
          { onConflict: 'id' }
        );
      if (directErr) {
        setError('Account created, but we could not save your details. Please contact support.');
        setLoading(false);
        return;
      }
    }

    // 注册成功，提示用户检查邮箱确认
    setSuccess(true);
    setLoading(false);
  }

  async function handleGitHubSignup() {
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Account created</h1>
          <p className="sub" style={{ marginBottom: '24px' }}>
            Your account is ready. <strong>You can log in now.</strong>
          </p>
          <Link href="/login" className="btn" style={{ textDecoration: 'none' }}>
            Log in to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Create your account</h1>
        <p className="sub">Free for up to 10 quotes. Upgrade anytime for unlimited.</p>

        {error && (
          <div className="error-box">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Your company or trade name"
              required
            />
          </div>

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.com"
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
              minLength={8}
              required
            />
          </div>

          <div className="field" style={{ opacity: 0.6 }}>
            <label>Follow-up inbox</label>
            <input type="text" value="follow@voxalo.top" disabled />
            <p className="hint">Pre-configured — all forwarded/BCC emails go here automatically</p>
          </div>

          <button type="submit" className="btn" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating account...' : 'Create account — free'}
          </button>
        </form>

        <div className="divider" style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '12px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontSize: '13px', color: 'var(--fg-dim)' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ width: '100%', background: '#24292e', color: 'white', border: 'none' }}
          onClick={handleGitHubSignup}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 8, verticalAlign: 'middle' }}>
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
          </svg>
          Continue with GitHub
        </button>

        <p className="alt-link" style={{ marginTop: '16px', textAlign: 'center' }}>
          <Link href="/login">Already have an account? Log in</Link>
        </p>
      </div>
    </div>
  );
}
