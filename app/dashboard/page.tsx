'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
  next_followup_at: string | null;
}

type Filter = 'all' | 'following' | 'replied' | 'won' | 'lost';

const STATUS_LABEL: Record<Quote['status'], string> = {
  following: 'Following up',
  replied: 'Replied',
  won: 'Won',
  lost: 'Lost',
};

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DashboardPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<{ followup_email: string; paypal_subscription_id: string | null } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: q } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });
      setQuotes((q as Quote[]) || []);
      const { data: acc } = await supabase
        .from('accounts')
        .select('followup_email, business_name, paypal_subscription_id')
        .maybeSingle();
      const accData = acc as { followup_email: string; paypal_subscription_id: string | null } | null;
      setAccount(accData);
      
      setLoading(false);
    })();
  }, []);

  const filtered = quotes.filter((q) => filter === 'all' || q.status === filter);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1>Your quotes</h1>
        <Link href="/dashboard/new" className="btn" style={{ width: 'fit-content', padding: '10px 16px' }}>
          + Send a quote
        </Link>
      </div>
      <p className="page-sub">
        {account?.followup_email
          ? <>Forward or BCC every quote to <strong>{account.followup_email}</strong> and it appears here automatically — or click <strong>Add a quote</strong> to paste it in.</>
          : <>Click <strong>Add a quote</strong> and paste the email you sent a customer, or set up your follow-up inbox in <Link href="/dashboard/settings" style={{ color: '#2563eb' }}>Settings</Link>.</>}
      </p>

      {!loading && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total quotes</div>
            <div className="stat-value purple">{quotes.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Following up</div>
            <div className="stat-value amber">{quotes.filter((q) => q.status === 'following').length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Won</div>
            <div className="stat-value green">{quotes.filter((q) => q.status === 'won').length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Revenue won</div>
            <div className="stat-value green">
              ${quotes.filter((q) => q.status === 'won').reduce((s, q) => s + (q.amount || 0), 0).toLocaleString()}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Replied</div>
            <div className="stat-value blue">{quotes.filter((q) => q.status === 'replied').length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Lost</div>
            <div className="stat-value" style={{ color: '#f87171' }}>{quotes.filter((q) => q.status === 'lost').length}</div>
          </div>
        </div>
      )}

      <div className="status-pills">
        {(['all', 'following', 'replied', 'won', 'lost'] as Filter[]).map((f) => (
          <button
            key={f}
            className={`status-pill ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : STATUS_LABEL[f as Quote['status']]}
            {f !== 'all' && (
              <span> ({quotes.filter((q) => q.status === f).length})</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="big">{filter === 'all' ? 'No quotes yet' : 'Nothing here'}</div>
          <p>
            {filter === 'all'
              ? 'Click “+ Add a quote” above and paste the email you sent a customer — we’ll read it, save it, and start the Day 1 / 3 / 7 follow-ups automatically.'
              : 'Quotes in this status will show up here.'}
          </p>
        </div>
      ) : (
        filtered.map((q) => (
          <Link key={q.id} href={`/dashboard/quotes/${q.id}`}>
            <div className="quote-card">
              <div className="left">
                <div className="name">
                  {q.customer_name || q.customer_email || 'Unknown customer'}
                </div>
                <div className="meta">
                  {q.service_type || 'Service not specified'}
                  {' · '}Quoted {formatDate(q.quote_date)}
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
          </Link>
        ))
      )}
    </div>
  );
}
