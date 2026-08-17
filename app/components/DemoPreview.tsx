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

const STATUS_COLOR: Record<string, string> = {
  following: '#f59e0b',
  replied: '#3b82f6',
  won: '#22c55e',
  lost: '#ef4444',
};

type Filter = 'all' | 'following' | 'replied' | 'won' | 'lost';

export default function DemoPreview() {
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = MOCK_QUOTES.filter((q) => filter === 'all' || q.status === filter);
  const selected = MOCK_QUOTES.find((q) => q.id === selectedId) || null;

  return (
    <section id="demo" style={{
      background: '#0f172a', color: '#e2e8f0',
      padding: '48px 24px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{
            display: 'inline-block',
            background: 'rgba(59,130,246,0.15)', color: '#60a5fa',
            padding: '4px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
            marginBottom: 12,
          }}>👀 Live Preview — No sign-up required</span>
          <h2 style={{ fontSize: 28, margin: '0 0 8px', color: '#fff' }}>
            This is what your dashboard looks like
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 15, margin: 0 }}>
            Sample data below — try clicking filters and quote cards to see how it works
          </p>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center',
          marginBottom: 24,
        }}>
          {(['all', 'following', 'replied', 'won', 'lost'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? '#2563eb' : '#1e293b',
                color: filter === f ? '#fff' : '#94a3b8',
                border: filter === f ? 'none' : '1px solid #334155',
                borderRadius: 999, padding: '6px 16px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f === 'all' ? `All (${MOCK_QUOTES.length})` : `${STATUS_LABEL[f]} (${MOCK_QUOTES.filter(q => q.status === f).length})`}
            </button>
          ))}
        </div>

        {/* Dashboard grid */}
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 20, alignItems: 'start' }}>

          {/* Quote cards */}
          <div>
            {filtered.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '48px 24px',
                color: '#64748b', fontSize: 15,
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                Nothing here yet
              </div>
            ) : filtered.map((q) => (
              <div
                key={q.id}
                onClick={() => setSelectedId(selectedId === q.id ? null : q.id)}
                style={{
                  background: '#1e293b', border: selectedId === q.id ? '2px solid #3b82f6' : '1px solid #334155',
                  borderRadius: 12, padding: '14px 18px', marginBottom: 10,
                  cursor: 'pointer',
                  opacity: selectedId && selectedId !== q.id ? 0.45 : 1,
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 2 }}>
                    {q.customer_name}
                  </div>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>
                    {q.service_type} · Aug {new Date(q.quote_date).getDate()}
                    {q.followup_count > 0 && <> · {q.followup_count} follow-up{q.followup_count > 1 ? 's' : ''}</>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>
                    ${q.amount}
                  </div>
                  <span style={{
                    display: 'inline-block',
                    background: `${STATUS_COLOR[q.status]}22`,
                    color: STATUS_COLOR[q.status],
                    padding: '2px 10px', borderRadius: 999,
                    fontSize: 12, fontWeight: 600, marginTop: 4,
                  }}>
                    {STATUS_LABEL[q.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{
              background: '#1e293b', border: '1px solid #334155',
              borderRadius: 12, padding: 20,
              position: 'sticky', top: 20,
            }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 17, color: '#fff' }}>{selected.customer_name}</h3>

              {[
                ['Email', selected.customer_email],
                ['Service', selected.service_type],
                ['Amount', `$${selected.amount}`],
                ['Status', STATUS_LABEL[selected.status]],
                ['Follow-ups', `${selected.followup_count} sent`],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '6px 0', borderBottom: '1px solid #1e293b',
                  fontSize: 14,
                }}>
                  <span style={{ color: '#94a3b8' }}>{k}</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{v}</span>
                </div>
              ))}

              <h4 style={{ margin: '16px 0 10px', fontSize: 14, color: '#94a3b8' }}>Follow-up timeline</h4>
              {(selected.messages || []).map((m, i) => (
                <div key={i} style={{
                  background: m.dir === 'out' ? '#1e3a5f' : '#14202d',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 8,
                  borderLeft: `3px solid ${m.dir === 'out' ? '#3b82f6' : '#22c55e'}`,
                }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                    {m.dir === 'out' ? '→ Sent to customer' : '← Customer reply'} · {m.ts}
                  </div>
                  <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>{m.body}</div>
                </div>
              ))}

              {selected.status === 'following' && selected.next_followup_at && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(59,130,246,0.1)', fontSize: 13, color: '#60a5fa',
                  border: '1px solid rgba(59,130,246,0.25)',
                }}>
                  ⏰ Next follow-up: <strong>{new Date(selected.next_followup_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CTA under demo */}
        <div style={{ textAlign: 'center', marginTop: 40, paddingTop: 32, borderTop: '1px solid #1e293b' }}>
          <p style={{ color: '#94a3b8', fontSize: 15, margin: '0 0 16px' }}>
            Ready to stop losing quotes? Set up your dashboard in 10 minutes.
          </p>
          <a href="#pricing" style={{
            display: 'inline-block',
            background: '#2563eb', color: '#fff',
            padding: '12px 28px', borderRadius: 999,
            fontWeight: 700, fontSize: 15, textDecoration: 'none',
          }}>
            Get Started — $29/mo →
          </a>
        </div>

      </div>
    </section>
  );
}
