'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const router = useRouter();
  const searchParams = useSearchParams();

  // PayPal 订阅成功后跳转过来会带 ?sub=I-xxxx，必须透传保存，否则付费客户会被当成免费版
  const rawSub = searchParams.get('sub');
  const paypalSub = rawSub && /^I-[A-Za-z0-9]+$/.test(rawSub) ? rawSub : null;

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
          paypalSubscriptionId: null,
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
          { id: userId, business_name: businessName, email, followup_email: 'follow@voxalo.top' },
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

        <p className="alt-link" style={{ marginTop: '16px', textAlign: 'center' }}>
          <Link href="/login">Already have an account? Log in</Link>
        </p>
      </div>
    </div>
  );
}