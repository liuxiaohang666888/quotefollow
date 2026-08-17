'use client';

import { useState } from 'react';

/* ── Mock data ─────────────────────────────── */
const MOCK_QUOTES = [
  {
    id: 'demo-1',
    customer_name: 'Sarah Johnson',
    customer_email: 'sarah.johnson@gmail.com',
    service_type: 'Deep House Cleaning',
    amount: 380,
    status: 'won' as const,
    quote_date: '2026-08-10',
    followup_count: 3,
    next_followup_at: null,
    messages: [
      { dir: 'out' as const, body: 'Hi Sarah, just checking in on the deep cleaning quote we sent last week ($380). Any questions?', ts: 'Aug 11, 9:00 AM' },
      { dir: 'in' as const, body: 'Hey sorry for the delay! Yes we want to book. Are you free this Saturday?', ts: 'Aug 12, 2:34 PM' },
      { dir: 'out' as const, body: 'Saturday works perfectly! I have 9 AM or 1 PM available. Which do you prefer?', ts: 'Aug 12, 3:00 PM' },
      { dir: 'in' as const, body: '9 AM sounds great. See you then!', ts: 'Aug 12, 4:15 PM' },
    ],
  },
  {
    id: 'demo-2',
    customer_name: 'Mike Chen',
    customer_email: 'mchen@officepark.com',
    service_type: 'Office Move - 2 floors',
    amount: 1450,
    status: 'following' as const,
    quote_date: '2026-08-14',
    followup_count: 2,
    next_followup_at: '2026-08-17T09:00:00Z',
    messages: [
      { dir: 'out' as const, body: 'Hi Mike, following up on the office move quote ($1,450). Did you get a chance to review it?', ts: 'Aug 15, 9:00 AM' },
      { dir: 'out' as const, body: 'Just a friendly reminder — our calendar fills up fast. Happy to answer any questions!', ts: 'Aug 17, 9:00 AM' },
    ],
  },
  {
    id: 'demo-3',
    customer_name: 'Lisa Rodriguez',
    customer_email: 'lisa.r@gmail.com',
    service_type: 'Weekly Lawn Care Package',
    amount: 120,
    status: 'replied' as const,
    quote_date: '2026-08-13',
    followup_count: 1,
    next_followup_at: null,
    messages: [
      { dir: 'out' as const, body: 'Hi Lisa, thanks for considering our weekly lawn care package ($120/mo). Let us know if you have questions!', ts: 'Aug 14, 9:00 AM' },
      { dir: 'in' as const, body: 'What does the package include exactly? Mowing only or also edging/weeding?', ts: 'Aug 14, 11:20 AM' },
      { dir: 'out' as const, body: 'Great question! Our weekly package includes mowing, edging, line trimming, and debris removal. Weeding is an optional $25 add-on per visit.', ts: 'Aug 14, 11:22 AM' },
    ],
  },
  {
    id: 'demo-4',
    customer_name: 'David Park',
    customer_email: 'dpark@restaurant.co',
    service_type: 'Commercial Kitchen Deep Clean',
    amount: 2200,
    status: 'lost' as const,
    quote_date: '2026-08-05',
    followup_count: 3,
    next_followup_at: null,
    messages: [
      { dir: 'out' as const, body: 'Hi David, following up on your commercial kitchen deep clean quote ($2,200).', ts: 'Aug 6, 9:00 AM' },
      { dir: 'out' as const, body: 'Quick check-in — any thoughts on the quote?', ts: 'Aug 8, 9:00 AM' },
      { dir: 'in' as const, body: 'Thanks but we went with another company. Good luck!', ts: 'Aug 9, 10:05 AM' },
    ],
  },
];

const STATUS_LABEL: Record<string, string> = {
  following: 'Following up',
  replied: 'Replied',
  won: 'Won 🎉',
  lost: 'Lost',
};

type Filter = 'all' | 'following' | 'replied' | 'won' | 'lost';

export default function DemoPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = MOCK_QUOTES.filter((q) => filter === 'all' || q.status === filter);
  const selected = MOCK_QUOTES.find((q) => q.id === selectedId) || null;

  return (
    <div>
      {/* ── Top banner ── */}
      <div style={{
        background: 'linear-gradient(135deg,#1e40af,#2563eb)',
        color: '#fff', padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>📋 QuoteFollow — Live Demo</div>
        <a href="/" style={{
          background: '#fff', color: '#2563eb',
          padding: '7px 18px', borderRadius: 999, fontWeight: 600, fontSize: 14,
          textDecoration: 'none',
        }}>
          ← Back to home
        </a>
      </div>

      {/* ── Demo notice ── */}
      <div style={{
        maxWidth: 1100, margin: '16px auto 0', padding: '0 24px',
      }}>
        <div style={{
          background: '#fef3c7', border: '1px solid #f59e0b',
          borderRadius: 10, padding: '12px 18px', fontSize: 14,
          color: '#92400e', marginBottom: 20,
        }}>
          <strong>👀 This is a read-only demo</strong> — showing what QuoteFollow looks like after you sign up and add your first quotes.
          All data below is sample/fictional. Try clicking filters and quote cards!
        </div>

        {/* ── Dashboard-like view ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <h1 style={{ fontSize: 26, margin: 0 }}>Your quotes</h1>
          <span style={{ color: '#6b7280', fontSize: 14 }}>
            Forward or BCC every quote to <strong>follow@yourbusiness.com</strong> and it appears here automatically
          </span>
        </div>

        {/* Filters */}
        <div className="status-pills" style={{ marginBottom: 20 }}>
          {(['all', 'following', 'replied', 'won', 'lost'] as Filter[]).map((f) => (
            <button
              key={f}
              className={`status-pill ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
              style={{ cursor: 'pointer' }}
            >
              {f === 'all' ? 'All' : STATUS_LABEL[f]}
              {f !== 'all' && (
                <span> ({MOCK_QUOTES.filter((q) => q.status === f).length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Quote list + detail side-by-side on desktop */}
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>

          {/* Left: quote cards */}
          <div>
            {filtered.length === 0 ? (
              <div className="empty">
                <div className="big">Nothing here</div>
                <p>Quotes in this status will show up here.</p>
              </div>
            ) : filtered.map((q) => (
              <div
                key={q.id}
                className="quote-card"
                onClick={() => setSelectedId(selectedId === q.id ? null : q.id)}
                style={{ cursor: 'pointer', opacity: selectedId && selectedId !== q.id ? 0.55 : 1 }}
              >
                <div className="left">
                  <div className="name">{q.customer_name || q.customer_email}</div>
                  <div className="meta">
                    {q.service_type} · Quoted {new Date(q.quote_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {q.followup_count > 0 && <> · {q.followup_count} follow-up{q.followup_count > 1 ? 's' : ''} sent</>}
                  </div>
                </div>
                <div className="right">
                  {q.amount !== null && q.amount > 0 && (
                    <span className="amount">${q.amount}</span>
                  )}
                  <span className={`badge-status ${q.status}`}>
                    {STATUS_LABEL[q.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Right: selected quote detail */}
          {selected && (
            <div className="card" style={{ position: 'sticky', top: 80, alignSelf: 'start' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>{selected.customer_name}</h3>
              <div className="kv"><span className="k">Email</span><span>{selected.customer_email}</span></div>
              <div className="kv"><span className="k">Service</span><span>{selected.service_type}</span></div>
              <div className="kv"><span className="k">Amount</span><span>${selected.amount}</span></div>
              <div className="kv"><span className="k">Status</span><span>{STATUS_LABEL[selected.status]}</span></div>
              <div className="kv"><span className="k">Follow-ups sent</span><span>{selected.followup_count}</span></div>

              <h4 style={{ margin: '16px 0 8px', fontSize: 14, color: '#6b7280' }}>Follow-up timeline</h4>
              {(selected.messages || []).map((m, i) => (
                <div key={i} className={`msg ${m.dir}`}>
                  <div className="h">{m.dir === 'out' ? '→ Sent to customer' : '← Customer reply'} · {m.ts}</div>
                  <pre>{m.body}</pre>
                </div>
              ))}

              {selected.status === 'following' && selected.next_followup_at && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 8,
                  background: '#eff6ff', fontSize: 13, color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                }}>
                  ⏰ Next follow-up scheduled: <strong>{new Date(selected.next_followup_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
