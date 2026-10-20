'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface SignupFormProps {
  paypalSub: string | null;
  refCode: string | null;
}

export default function SignupForm({ paypalSub, refCode }: SignupFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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
      setError('Account created! Check your email to confirm, then log in.');
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
      setError('Account created, but we could not save your details. Please try again or contact support.');
      setLoading(false);
      return;
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
            We sent you a confirmation email. <strong>Please check your inbox to confirm your account</strong> before logging in.
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
        <p className="sub">Free for 14 days, up to 3 clients — whichever comes first. Upgrade anytime for unlimited.</p>

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
              autoComplete="off"
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
              autoComplete="off"
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
              autoComplete="new-password"
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