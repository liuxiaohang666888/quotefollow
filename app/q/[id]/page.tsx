'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface PublicQuote {
  id: string;
  customer_name: string;
  service_type: string;
  amount: number | null;
  quote_date: string;
  source_subject: string;
  business_name: string;
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function PublicQuotePage() {
  const { id } = useParams<{ id: string }>();
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [decided, setDecided] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/public/quotes/${id}`);
      const json = await res.json();
      if (json.ok) setQuote(json.quote);
      else setNotFound(true);
      setLoading(false);
    })();
  }, [id]);

  async function decide(decision: 'accept' | 'decline') {
    setBusy(true);
    setMsg('');
    const res = await fetch(`/api/public/quotes/${id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    const json = await res.json();
    if (json.ok) {
      setDecided(decision);
      setMsg(json.message || '');
    } else {
      setMsg(json.error || 'Something went wrong. Please try again.');
    }
    setBusy(false);
  }

  if (loading) return <div className="public-wrap"><p className="public-loading">Loading…</p></div>;
  if (notFound || !quote) return <div className="public-wrap"><h1>Quote not found</h1><p>This link may be expired or incorrect.</p></div>;

  return (
    <div className="public-wrap">
      <div className="public-card">
        <div className="public-brand">{quote.business_name || 'Our business'}</div>
        <p className="public-sub">Here’s the quote we prepared for you.</p>

        <div className="public-amount">
          {quote.amount !== null && quote.amount > 0 ? `$${quote.amount}` : '—'}
          {quote.service_type ? <div className="public-service">{quote.service_type}</div> : null}
        </div>

        <div className="public-meta">
          {quote.customer_name ? <div><span>Prepared for</span><strong>{quote.customer_name}</strong></div> : null}
          {quote.quote_date ? <div><span>Quote date</span><strong>{fmtDate(quote.quote_date)}</strong></div> : null}
          {quote.source_subject ? <div className="public-subject"><span>Subject</span><strong>{quote.source_subject}</strong></div> : null}
        </div>

        {decided ? (
          <div className="public-done">
            <div className="public-done-title">{decided === 'accept' ? '🎉 Accepted' : 'Thanks for letting us know'}</div>
            <p>{msg}</p>
          </div>
        ) : (
          <div className="public-actions">
            <button className="btn public-accept" disabled={busy} onClick={() => decide('accept')}>
              ✓ Accept this quote
            </button>
            <button className="btn public-decline" disabled={busy} onClick={() => decide('decline')}>
              No thanks
            </button>
          </div>
        )}

        {!decided && <p className="public-note">Your reply goes straight to the business — no account needed.</p>}
      </div>
    </div>
  );
}
