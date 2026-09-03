'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { isAdminEmail } from '@/lib/paywall';

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
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      // 管理员/开发者邮箱直接放行（免订阅测试）
      const { data: authData } = await supabase.auth.getUser();
      const adminEmail = authData.user?.email || null;
      const isAdmin = isAdminEmail(adminEmail);

      const { data: q } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });
      setQuotes((q as Quote[]) || []);
      const { data: acc } = await supabase
        .from('accounts')
        .select('followup_email, business_name, paypal_subscription_id')
        .single();
      const accData = acc as { followup_email: string; paypal_subscription_id: string | null } | null;
      setAccount(accData);
      
      const hasValidSub =
        !!accData?.paypal_subscription_id && /^I-[A-Z0-9]+$/i.test(accData.paypal_subscription_id);

      if (!isAdmin && !hasValidSub) {
        setRedirecting(true);
        setTimeout(() => {
          window.location.href = '/signup';
        }, 2000);
      } else {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = quotes.filter((q) => filter === 'all' || q.status === filter);

  if (redirecting) {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ color: 'var(--fg-dim)', marginTop: 16 }}>Please subscribe to access...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1>Your quotes</h1>
        <Link href="/dashboard/new" className="btn" style={{ width: 'fit-content', padding: '10px 16px' }}>
          + Add a quote
        </Link>
      </div>
      <p className="page-sub">
        {account?.followup_email
          ? <>Forward or BCC every quote to <strong>{account.followup_email}</strong> and it appears here automatically — or click <strong>Add a quote</strong> to paste it in.</>
          : <>Click <strong>Add a quote</strong> and paste the email you sent a customer, or set up your follow-up inbox in <Link href="/dashboard/settings" style={{ color: '#2563eb' }}>Settings</Link>.</>}
      </p>

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
