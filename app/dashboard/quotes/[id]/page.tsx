'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Quote {
  id: string;
  customer_name: string;
  customer_email: string;
  service_type: string;
  amount: number | null;
  status: 'following' | 'replied' | 'won' | 'lost';
  quote_date: string;
  followup_count: number;
  last_followup_at: string | null;
  next_followup_at: string | null;
  source_subject: string;
  source_body: string;
  created_at: string;
}

interface Message {
  id: string;
  direction: 'in' | 'out';
  subject: string;
  body: string;
  created_at: string;
}

function fmt(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const supabase = createClient();
    const { data: q } = await supabase.from('quotes').select('*').eq('id', id).single();
    setQuote((q as Quote) || null);
    const { data: m } = await supabase
      .from('messages')
      .select('*')
      .eq('quote_id', id)
      .order('created_at', { ascending: true });
    setMessages((m as Message[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function setStatus(status: Quote['status']) {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/quotes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!json.ok) { setError(json.error || 'Failed'); setBusy(false); return; }
    await load();
    setBusy(false);
  }

  async function handleDelete() {
    if (!confirm('Delete this quote and all its messages?')) return;
    const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.ok) { setError(json.error || 'Failed'); return; }
    router.push('/dashboard');
    router.refresh();
  }

  async function sendFollowupNow() {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/quotes/${id}/followup`, { method: 'POST' });
    const json = await res.json();
    if (!json.ok) { setError(json.error || 'Failed to send'); setBusy(false); return; }
    await load();
    setBusy(false);
  }

  async function copyPublicLink() {
    const url = `${window.location.origin}/q/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setError('');
      alert('Copied! Send this link to your customer:\n\n' + url + '\n\nThey can view the quote and accept/decline with one click.');
    } catch {
      prompt('Copy this link and send it to your customer:', url);
    }
  }

  if (loading) return <p style={{ color: '#6b7280' }}>Loading…</p>;
  if (!quote) return <p>Quote not found. <a href="/dashboard" style={{ color: '#2563eb' }}>Back to dashboard</a></p>;

  return (
    <div>
      <a href="/dashboard" style={{ color: '#2563eb', fontSize: 14 }}>← Back to quotes</a>
      <h1 style={{ marginTop: 12 }}>{quote.customer_name || quote.customer_email || 'Unknown customer'}</h1>
      <p className="page-sub">{quote.service_type || 'Service not specified'}</p>

      {error && <div className="error-box">{error}</div>}

      <div className="detail-grid">
        <div>
          <div className="card">
            <h3>Conversation</h3>
            {messages.length === 0 && <p style={{ color: '#6b7280', fontSize: 14 }}>No messages yet.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`msg ${m.direction}`}>
                <div className="h">
                  {m.direction === 'in' ? '📥 From customer' : '📤 Sent by QuoteFollow'} · {fmt(m.created_at)}
                </div>
                <pre>{m.body}</pre>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Original quote</h3>
            <div className="msg in">
              <div className="h">Subject: {quote.source_subject || '—'}</div>
              <pre>{quote.source_body || 'No body captured.'}</pre>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <h3>Details</h3>
            <div className="kv"><span className="k">Customer</span><span>{quote.customer_name || '—'}</span></div>
            <div className="kv"><span className="k">Email</span><span style={{ wordBreak: 'break-all' }}>{quote.customer_email || '—'}</span></div>
            <div className="kv"><span className="k">Service</span><span>{quote.service_type || '—'}</span></div>
            <div className="kv"><span className="k">Amount</span><span>{quote.amount !== null && quote.amount > 0 ? `$${quote.amount}` : '—'}</span></div>
            <div className="kv"><span className="k">Quote date</span><span>{fmt(quote.quote_date)}</span></div>
            <div className="kv"><span className="k">Status</span><span className={`badge-status ${quote.status}`}>{quote.status}</span></div>
            <div className="kv"><span className="k">Follow-ups sent</span><span>{quote.followup_count}</span></div>
            <div className="kv"><span className="k">Next follow-up</span><span>{fmt(quote.next_followup_at || '')}</span></div>
          </div>

          <div className="card">
            <h3>Actions</h3>
            <div className="actions">
              <button className="btn sm blue" disabled={busy} onClick={copyPublicLink}>
                🔗 Copy customer link
              </button>
              <button className="btn sm blue" disabled={busy} onClick={sendFollowupNow}>
                ✉ Send follow-up now
              </button>
              <button className="btn sm green" disabled={busy} onClick={() => setStatus('won')}>
                ✓ Mark won
              </button>
              <button className="btn sm gray" disabled={busy} onClick={() => setStatus('replied')}>
                ↻ Back to replied
              </button>
              <button className="btn sm gray" disabled={busy} onClick={() => setStatus('lost')}>
                ✕ Mark lost
              </button>
              <button className="btn sm red" disabled={busy} onClick={handleDelete}>
                Delete
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 12 }}>
              The customer link lets them accept or decline the quote in one click — no account needed.
              Marking won or lost stops automatic follow-ups.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
