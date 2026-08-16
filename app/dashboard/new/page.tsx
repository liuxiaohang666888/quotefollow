'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewQuotePage() {
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
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
      <h1 style={{ marginTop: 12 }}>Add a quote</h1>
      <p className="page-sub">
        Paste the quote email you sent to a customer. We&apos;ll read it, pull out the
        customer, price and service, and start the Day 1 / 3 / 7 follow-ups automatically.
      </p>

      {error && <div className="error-box">{error}</div>}

      <form
        onSubmit={handleSubmit}
        style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
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
      </form>
    </div>
  );
}
