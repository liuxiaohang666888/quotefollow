'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import PayPalSubscribeButton from '@/components/PayPalSubscribeButton';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [followupEmail, setFollowupEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const [paid, setPaid] = useState(false);
  const [subId, setSubId] = useState('');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sub = params.get('sub');
      if (sub) {
        setPaid(true);
        setSubId(sub);
      }
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

    const { error: accError } = await supabase.from('accounts').insert({
      id: userId,
      business_name: businessName,
      followup_email: followupEmail.toLowerCase().trim(),
      paypal_subscription_id: subId || null,
    });
    if (accError) {
      console.error('[signup] account insert failed:', accError);
      setError('Account created, but we could not save your details. Please contact support.');
      setLoading(false);
      return;
    }

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
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
            color: '#34d399',
            borderRadius: 12,
            padding: '14px 18px',
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>✓</span>
            <span>Payment received! Create your account below to access your dashboard.</span>
          </div>
        )}
        
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          {paid ? 'Complete your setup' : 'Subscribe to get started'}
        </h1>
        <p style={{ color: 'var(--fg-dim)', fontSize: 14, marginBottom: 28 }}>
          {paid
            ? "You're one step away from your dashboard."
            : 'Pay $29/month to unlock QuoteFollow. You will be redirected to the payment page.'}
        </p>
        
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171',
            borderRadius: 10,
            padding: '12px 16px',
            fontSize: 14,
            marginBottom: 20,
          }}>{error}</div>
        )}
        
        {/* 未付款时显示 PayPal 按钮 */}
        {!paid && (
          <div style={{ marginBottom: 24 }}>
            <PayPalSubscribeButton label="Subscribe — $29/month" />
            <p style={{ fontSize: 13, color: 'var(--fg-dim)', marginTop: 12, textAlign: 'center' }}>
              No credit card required · Cancel anytime
            </p>
          </div>
        )}
        
        {/* 已付款时显示表单 */}
        {paid && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--fg)' }}>
                Business name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Sparkle Clean Co."
                required
                className="field-input"
              />
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--fg)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourbusiness.com"
                required
                className="field-input"
              />
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--fg)' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                autoComplete="new-password"
                className="field-input"
              />
            </div>
            
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--fg)' }}>
                Follow-up inbox (optional)
              </label>
              <input
                type="email"
                value={followupEmail}
                onChange={(e) => setFollowupEmail(e.target.value)}
                placeholder="follow@yourbusiness.com"
                className="field-input"
              />
              <div style={{ fontSize: 12, color: 'var(--fg-dim)', marginTop: 6 }}>
                The address you&apos;ll BCC on every quote. Leave blank to set up later.
              </div>
            </div>
            
            <button
              className="btn"
              type="submit"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {loading ? 'Creating account…' : 'Go to Dashboard →'}
            </button>
          </form>
        )}
        
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--fg-dim)' }}>
          <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Already have an account? Log in
          </Link>
        </div>
        
        {paid && (
          <div style={{
            marginTop: 24,
            padding: '16px',
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 12,
            fontSize: 13,
            color: 'var(--fg-dim)',
            lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>📧 What&apos;s next?</div>
            <ol style={{ paddingLeft: 18, margin: 0 }}>
              <li>Check your email for login credentials</li>
              <li>Go to <Link href="/dashboard" style={{ color: 'var(--accent)' }}>your Dashboard</Link></li>
              <li>BCC <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>follow@yourbusiness.com</code> on your next quote email</li>
              <li>Done! QuoteFollow handles the rest.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
