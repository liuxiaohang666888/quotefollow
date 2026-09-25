'use client';

import { useState } from 'react';

const REASONS = [
  'Too expensive',
  'Missing features I need',
  'Too confusing / hard to use',
  'Found another tool',
  'It didn\u2019t get me results',
  'Other',
];

export default function FeedbackBox() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, details, kind: 'in_app' }),
    });
    if (res.ok) {
      setStatus('done');
      setReason('');
      setDetails('');
      setTimeout(() => { setStatus('idle'); setOpen(false); }, 2500);
    } else {
      setStatus('error');
    }
  }

  if (!open) {
    return (
      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--fg-dim)',
            padding: '10px 20px',
            borderRadius: 10,
            fontSize: 13.5,
            cursor: 'pointer',
          }}
        >
          💬 Have feedback? Tell us what to improve
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 40 }}>
      <h3>💬 Feedback</h3>
      {status === 'done' ? (
        <p style={{ color: '#34d399', fontWeight: 600 }}>✓ Thanks — we read every piece of feedback.</p>
      ) : (
        <form onSubmit={submit}>
          <div className="field">
            <label>What&apos;s on your mind?</label>
            {REASONS.map((r) => (
              <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--fg)', margin: '6px 0', cursor: 'pointer' }}>
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
          </div>
          {reason && (
            <div className="field">
              <label>{reason === 'Other' ? 'Tell us more' : 'Anything else? (optional)'}</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={reason === 'Other' ? 'What would make this work for you?' : 'Suggestions, complaints, wishes — all welcome.'}
                rows={3}
              />
            </div>
          )}
          {status === 'error' && <p style={{ color: '#f87171', fontSize: 13 }}>Something went wrong — please try again.</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" type="submit" disabled={!reason || status === 'sending'}>
              {status === 'sending' ? 'Sending…' : 'Send feedback'}
            </button>
            <button type="button" onClick={() => setOpen(false)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--fg-dim)', borderRadius: 10, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
