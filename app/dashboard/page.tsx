'use client';

import { useEffect, useState, useCallback } from 'react';
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
  const [account, setAccount] = useState<{ followup_email: string; business_name: string; paypal_subscription_id: string | null } | null>(null);
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: q } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false });
    setQuotes((q as Quote[]) || []);
    setPage(1);

    const { data: acc } = await supabase
      .from('accounts')
      .select('followup_email, business_name, paypal_subscription_id')
      .maybeSingle();
    setAccount(acc as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  // 查免费额度
  useEffect(() => {
    if (!account || account.paypal_subscription_id) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('customer_email', user.email).then(({ count }) => {
        setQuotaUsed(count ?? 0);
      });
    });
  }, [account]);

  const remaining = Math.max(0, 10 - quotaUsed);
  const isFree = !account?.paypal_subscription_id;
  const isExhausted = isFree && remaining === 0;

  const filtered = quotes.filter((q) => filter === 'all' || q.status === filter);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const displayedQuotes = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1>Your quotes</h1>
        <Link
          href="/dashboard/new"
          className="btn"
          style={{ width: 'fit-content', padding: '10px 16px', opacity: isExhausted ? 0.5 : 1, pointerEvents: isExhausted ? 'none' : 'auto' }}
        >
          + Send a quote
        </Link>
      </div>

      {/* 额度提示 */}
      {isFree && (
        <div style={{
          marginTop: 12,
          padding: '12px 16px',
          borderRadius: 10,
          background: isExhausted ? '#fef3c7' : '#f0fdf4',
          border: `1px solid ${isExhausted ? '#f59e0b' : '#86efac'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          <span style={{ fontSize: 14, color: isExhausted ? '#92400e' : '#166534' }}>
            {isExhausted
              ? 'Free plan quota used up — '
              : `Free plan: ${remaining} of 10 quotes remaining`}
          </span>
          {!isExhausted && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 120,
                height: 6,
                background: '#d1fae5',
                borderRadius: 3,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.min(100, (quotaUsed / 10) * 100)}%`,
                  height: '100%',
                  background: '#22c55e',
                  borderRadius: 3,
                  transition: 'width 0.3s',
                }} />
              </div>
              <span style={{ fontSize: 12, color: '#166534' }}>{quotaUsed}/10</span>
            </div>
          )}
          {isExhausted && (
            <Link href="/signup" style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              background: '#f59e0b',
              padding: '6px 14px',
              borderRadius: 8,
              textDecoration: 'none',
            }}>
              Upgrade to Pro — $9/mo
            </Link>
          )}
        </div>
      )}

      <p className="page-sub" style={{ marginTop: 12 }}>
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
            onClick={() => { setFilter(f); setPage(1); }}
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
      ) : displayedQuotes.length === 0 ? (
        <div className="empty">
          <div className="big">{filter === 'all' ? 'No quotes yet' : 'Nothing here'}</div>
          <p>
            {filter === 'all'
              ? 'Click "+ Add a quote" above and paste the email you sent a customer - we will read it, save it, and start the Day 1 / 3 / 7 follow-ups automatically.'
              : 'Quotes in this status will show up here.'}
          </p>
        </div>
      ) : (
        <>
          {displayedQuotes.map((q) => (
            <Link key={q.id} href={`/dashboard/quotes/${q.id}`}>
              <div className="quote-card">
                <div className="left">
                  <div className="name">
                    {q.customer_name || q.customer_email || 'Unknown customer'}
                  </div>
                  <div className="meta">
                    {q.service_type || 'Service not specified'}
                    {' · '}Quoted {formatDate(q.quote_date)}
                    {q.followup_count > 0 && <> · {q.followup_count} follow-up{q.followup_count > 1 ? 's' : ''}</>}
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
          ))}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <span style={{ padding: '8px 16px', color: '#6b7280' }}>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
