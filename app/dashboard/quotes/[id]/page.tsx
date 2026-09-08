'use client';

import { useEffect, useState, useCallback } from 'react';
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
  source_raw_mime?: string;
  created_at: string;
}

interface Message {
  id: string;
  direction: 'in' | 'out';
  subject: string;
  body: string;
  raw_mime?: string;
  created_at: string;
}

function fmt(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const B64_LINE = /^[A-Za-z0-9+/]{30,}=*$/;
const B64_FRAG = /^[A-Za-z0-9+/=]+$/;
function cleanMimeNoise(s: string): string {
  if (!s) return '';
  if (
    !/NextPart|mimepart/i.test(s) &&
    !/^Content-[\w-]+:/im.test(s) &&
    !/MIME-Version:/i.test(s)
  ) {
    return s;
  }
  const out: string[] = [];
  let b64Run = 0;
  for (const line of s.split(/\r?\n/)) {
    const t = line.trim();
    if (/^-{2,}=*_?(NextPart|mimepart|Part)_/i.test(t)) { b64Run = 0; continue; }
    if (/^-{5,}[A-Za-z0-9_.=+-]{10,}$/.test(t)) { b64Run = 0; continue; }
    if (/^(Content-[\w-]+|MIME-Version):/i.test(t)) continue;
    if (/^This is a multi-part message in MIME format\.?$/i.test(t)) continue;
    if (B64_LINE.test(t)) { b64Run++; continue; }
    if (b64Run > 0 && B64_FRAG.test(t)) continue;
    b64Run = 0;
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function displayBody(s: string): string {
  return stripHtml(cleanMimeNoise(s || ''));
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const supabase = createClient();
    const [qResult, mResult] = await Promise.all([
      supabase.from('quotes').select('*').eq('id', id).single(),
      supabase
        .from('messages')
        .select('*')
        .eq('quote_id', id)
        .order('created_at', { ascending: true }),
    ]);
    setQuote((qResult.data as Quote) || null);
    setMessages((mResult.data as Message[]) || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [id, load]);

  async function setStatus(status: Quote['status']) {
    if (busy) return;
    setBusy(true);
    setError('');
    setQuote(prev => prev ? { ...prev, status } : null);
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || 'Failed');
        await load();
      }
    } catch (e) {
      setError('Network error');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this quote and all its messages? This cannot be undone.')) return;
    setBusy(true);
    setError('');
    router.push('/dashboard');
    setTimeout(() => router.refresh(), 100);
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
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {displayBody(m.body) || (m.raw_mime ? '(解析失败，已保存原始邮件原文供检查)' : '(no message content)')}
                </pre>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Original quote</h3>
            <div className="msg in">
              <div className="h">Subject: {quote.source_subject || '—'}</div>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {displayBody(quote.source_body) || (quote.source_raw_mime ? '(解析失败，已保存原始邮件原文)' : 'No body captured.')}
              </pre>
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
              <button
                className="btn sm green"
                disabled={busy || quote.status === 'won'}
                onClick={() => setStatus('won')}
                title={quote.status === 'won' ? 'Already marked as won' : 'Mark as won'}
              >
                {quote.status === 'won' ? '✓ Won' : '✓ Mark won'}
              </button>
              <button
                className="btn sm gray"
                disabled={busy || quote.status === 'replied'}
                onClick={() => setStatus('replied')}
                title={quote.status === 'replied' ? 'Already replied' : 'Mark as replied'}
              >
                {quote.status === 'replied' ? '↻ Replied' : '↻ Mark replied'}
              </button>
              <button
                className="btn sm gray"
                disabled={busy || quote.status === 'lost'}
                onClick={() => setStatus('lost')}
                title={quote.status === 'lost' ? 'Already marked as lost' : 'Mark as lost'}
              >
                {quote.status === 'lost' ? '✕ Lost' : '✕ Mark lost'}
              </button>
              <button
                className="btn sm red"
                disabled={busy}
                onClick={handleDelete}
                title="Delete this quote permanently"
              >
                Delete
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 12 }}>
              {quote.status === 'won' && '✓ Quote marked as won — follow-ups stopped.'}
              {quote.status === 'lost' && '✕ Quote marked as lost — follow-ups stopped.'}
              {quote.status !== 'won' && quote.status !== 'lost' && 'Marking a quote won or lost stops automatic follow-ups.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
