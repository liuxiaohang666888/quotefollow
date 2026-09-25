'use client';

import { useState } from 'react';
import Link from 'next/link';

const REASONS = [
  'Too expensive',
  'Missing features I need',
  'Too confusing / hard to use',
  'Found another tool',
  'It didn\u2019t get me results',
  'Other',
];

export default function ExitSurveyPage() {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, details, kind: 'exit' }),
    });
    setStatus(res.ok ? 'done' : 'error');
  }

  return (
    <div style={{ maxWidth: 560, margin: '60px auto', padding: '0 20px' }}>
      {status === 'done' ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <h2 style={{ marginBottom: 8 }}>Thanks — noted.</h2>
          <p style={{ color: 'var(--fg-dim)', fontSize: 14.5, lineHeight: 1.7 }}>
            Your feedback goes straight to the founder and shapes what we build next.
          </p>
          <Link href="/" className="btn" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}>
            Back to home
          </Link>
        </div>
      ) : (
        <div className="card">
          <h2 style={{ marginBottom: 6 }}>Before you go — what went wrong?</h2>
          <p style={{ color: 'var(--fg-dim)', fontSize: 14, marginBottom: 20 }}>
            Be honest. This is how the product gets better.
          </p>
          <form onSubmit={submit}>
            {REASONS.map((r) => (
              <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: 'var(--fg)', margin: '10px 0', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  style={{ width: 'auto' }}
                />
                {r}
              </label>
            ))}
            {reason && (
              <div className="field" style={{ marginTop: 16 }}>
                <label>{reason === 'Other' ? 'Tell us why' : 'Anything else? (optional)'}</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder={reason === 'Other' ? 'What would have kept you around?' : 'What could we have done better?'}
                  rows={3}
                />
              </div>
            )}
            {status === 'error' && <p style={{ color: '#f87171', fontSize: 13 }}>Something went wrong — please try again.</p>}
            <button
              className="btn"
              type="submit"
              disabled={!reason || status === 'sending'}
              style={{ marginTop: 12, width: 'fit-content' }}
            >
              {status === 'sending' ? 'Sending…' : 'Submit'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
