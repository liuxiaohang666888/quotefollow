'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import PayPalSubscribeButton from '@/components/PayPalSubscribeButton';

function SignupContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [followupEmail, setFollowupEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [paid, setPaid] = useState(false);
  const [subId, setSubId] = useState('');
  const [loadingCheck, setLoadingCheck] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sub = params.get('sub');
    if (sub) {
      setPaid(true);
      setSubId(sub);
    }
    setLoadingCheck(false);
  }, []);

  function handlePaymentConfirmed() {
    const fakeSubId = 'manual-' + Date.now();
    setPaid(true);
    setSubId(fakeSubId);
  }

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

    // 1. 先创建用户认证
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

    // 2. 调用服务端API创建账户（使用admin client绕过RLS）
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        businessName,
        email,
        followupEmail,
        paypalSubscriptionId: subId || null,
      }),
    });

    const result = await res.json();
    if (!result.ok) {
      console.error('[signup] account creation failed:', result.error);
      setError('Account created, but we could not save your details. Please contact support.');
      setLoading(false);
      return;
    }

    // 3. 跳转到dashboard
    router.push('/dashboard');
    router.refresh();
  }

  if (loadingCheck) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="spinner" />
          <p style={{ textAlign: 'center', color: 'var(--fg-dim)', marginTop: 16 }}>Checking payment status...</p>
        </div>
      </div>
    );
  }

  // 如果没有付款，显示PayPal支付按钮
  if (!paid) {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>订阅以开始</h1>
          <p className="sub" style={{ marginBottom: '24px' }}>
            每月$29，通过PayPal订阅后即可解锁全部功能
          </p>
          
          <PayPalSubscribeButton />
          
          <div style={{ marginTop: '24px', fontSize: '14px', color: 'var(--fg-dim)' }}>
            <p>已经付钱了吗？</p>
            <button 
              onClick={() => {
                const fakeSub = 'manual-' + Date.now();
                window.location.href = `/signup?sub=${fakeSub}`;
              }}
              style={{ 
                background: 'transparent', 
                border: '1px solid var(--border)', 
                color: 'var(--fg-dim)', 
                padding: '8px 16px', 
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                marginTop: '8px'
              }}
            >
              我已完成付款，直接进入
            </button>
          </div>
          
          <p className="alt-link" style={{ marginTop: '24px' }}>
            <Link href="/login">已有账号？登录</Link>
          </p>
        </div>
      </div>
    );
  }

  // 已付款，显示注册表单
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>订阅以开始</h1>
        <p className="sub">每月$29，通过PayPal订阅后即可解锁全部功能</p>

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

          <div className="field">
            <label>Follow-up Email (BCC)</label>
            <input
              type="email"
              value={followupEmail}
              onChange={(e) => setFollowupEmail(e.target.value)}
              placeholder="quotes@yourdomain.com"
              required
            />
            <p className="hint">Forward all quote emails to this address</p>
          </div>

          <button type="submit" className="btn" style={{ width: '100%' }}>
            Continue to Dashboard →
          </button>
        </form>

        <p className="alt-link">
          <Link href="/login">已有账号？登录</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="spinner" />
        </div>
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}
