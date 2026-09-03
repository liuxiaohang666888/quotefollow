'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewQuotePage() {
  const [mode, setMode] = useState<'compose' | 'paste'>('compose');
  const router = useRouter();

  // Compose mode
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');

  // Paste mode
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCompose(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!customerEmail) { setError('Customer email is required.'); return; }
    if (!message.trim()) { setError('Write a quote message first.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/quotes/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName,
          customer_email: customerEmail,
          service_type: serviceType,
          amount: amount ? parseFloat(amount) : null,
          message: message,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Something went wrong.');
        setLoading(false);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  async function handlePaste(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!text.trim() && !subject.trim()) {
      setError('Paste the quote email below first.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, text }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Something went wrong.');
        setLoading(false);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div>
      <Link href="/dashboard" style={{ color: '#6b7280', fontSize: 14 }}>
        ← Back to quotes
      </Link>
      <h1 style={{ marginTop: 12 }}>Send a quote</h1>
      <p className="page-sub">
        Write a new quote and send it to your customer — or paste one you already sent.
        Either way, we&apos;ll start the Day 1 / 3 / 7 follow-ups automatically.
      </p>

      {error && <div className="error-box">{error}</div>}

      {/* Mode toggle */}
      <div className="mode-tabs" style={{ display: 'flex', gap: 0, marginTop: 20, marginBottom: 24, background: 'var(--bg-glass)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        <button
          onClick={() => setMode('compose')}
          style={{
            padding: '10px 24px',
            borderRadius: 10,
            border: 'none',
            background: mode === 'compose' ? 'var(--accent)' : 'transparent',
            color: mode === 'compose' ? '#fff' : 'var(--fg-dim)',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          ✏️ Compose new quote
        </button>
        <button
          onClick={() => setMode('paste')}
          style={{
            padding: '10px 24px',
            borderRadius: 10,
            border: 'none',
            background: mode === 'paste' ? 'var(--accent)' : 'transparent',
            color: mode === 'paste' ? '#fff' : 'var(--fg-dim)',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          📋 Paste existing quote
        </button>
      </div>

      {mode === 'compose' ? (
        <form onSubmit={handleCompose} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label>Customer name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. John Smith"
            />
          </div>
          <div className="field">
            <label>Customer email <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="john@example.com"
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field">
              <label>Service type</label>
              <input
                type="text"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                placeholder="e.g. House cleaning"
              />
            </div>
            <div className="field">
              <label>Amount ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 450"
              />
            </div>
          </div>
          <div className="field">
            <label>Quote message <span style={{ color: '#ef4444' }}>*</span></label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontFamily: 'inherit',
                fontSize: 14,
                lineHeight: 1.5,
              }}
              placeholder={
                'Hi John,\n\nHere is the quote for the move on March 12:\n- 2 bedroom apartment\n- $450\n\nLet me know if you have any questions!'
              }
              required
            />
          </div>
          <button className="btn" type="submit" disabled={loading} style={{ width: 'fit-content' }}>
            {loading ? 'Sending…' : '✉ Send quote & start follow-ups'}
          </button>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: -8 }}>
            The quote email will be sent from your business name via our system. The customer can reply directly.
          </p>
        </form>
      ) : (
        <form onSubmit={handlePaste} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label>Subject (optional)</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Re: Quote for spring cleaning"
            />
          </div>
          <div className="field">
            <label>Quote email (paste the whole thing)</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontFamily: 'inherit',
                fontSize: 14,
                lineHeight: 1.5,
              }}
              placeholder={
                'Hi John,\n\nHere is the quote for the move on March 12:\n- 2 bedroom apartment\n- $450\n\nLet me know if you have any questions!'
              }
            />
          </div>
          <button className="btn" type="submit" disabled={loading} style={{ width: 'fit-content' }}>
            {loading ? 'Reading email…' : 'Create quote & start follow-ups'}
          </button>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: -8 }}>
            Already sent this quote? Paste it here and we&apos;ll parse it and start the follow-ups.
          </p>
        </form>
      )}
    </div>
  );
}