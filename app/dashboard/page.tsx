'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { computeHeat } from '@/lib/heat';
import { FREE_QUOTA, TRIAL_DAYS } from '@/lib/paywall';
import { useEnsureReferralCode } from '@/hooks/useEnsureReferralCode';
import PayPalSubscribeButton, { PLAN_PRO_ID } from '@/components/PayPalSubscribeButton';
import { getVerticalConfig } from '@/lib/vertical';

interface Quote {
  id: string;
  customer_name: string;
  customer_email: string;
  service_type: string;
  amount: number | null;
  status: string;
  quote_date: string;
  followup_count: number;
  next_followup_at: string | null;
  require_deposit: boolean;
  deposit_status: string;
  deposit_amount: number | null;
  deposit_paid_at: string | null;
}

type Filter = 'all' | 'following' | 'replied' | 'won' | 'lost' | 'paused' | 'closed';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  following: 'Following up',
  replied: 'Client replied — paused',
  paused: 'Paused',
  closed: 'Closed',
  won: 'Won',
  lost: 'Lost',
  paid: 'Paid',
  stopped: 'Stopped',
};

const STATUS_COLOR: Record<string, string> = {
  draft: '#9ca3af',
  sent: '#60a5fa',
  following: '#a5b4fc',
  replied: '#60a5fa',
  paused: '#fbbf24',
  closed: '#f87171',
  won: '#34d399',
  lost: '#9ca3af',
  paid: '#34d399',
  stopped: '#9ca3af',
};

function statusLabel(status: string): string {
  return STATUS_LABEL[status] || status || 'Unknown';
}

function statusColor(status: string): string {
  return STATUS_COLOR[status] || 'var(--fg)';
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DashboardPage() {
  const config = getVerticalConfig();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<{ followup_email: string; business_name: string; paypal_subscription_id: string | null; referral_code: string; created_at: string | null; trial_ends_at: string | null } | null>(null);
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [exportOpen, setExportOpen] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const { referral_code: storedCode } = useEnsureReferralCode();

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
      .select('followup_email, business_name, paypal_subscription_id, referral_code, created_at, trial_ends_at')
      .maybeSingle();
    setAccount(acc as any);
    setLoading(false);
  }, []);

  // 兜底重试："我已付款，重新检查"——重新拉取 account，
  // 若订阅 ID 已写入（绑定模式成功/其他入口付款）则 isFree=false 自动解锁
  const handleRecheck = useCallback(async () => {
    if (rechecking) return;
    setRechecking(true);
    try {
      await loadQuotes();
    } finally {
      setRechecking(false);
    }
  }, [rechecking, loadQuotes]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  // 查免费额度
  useEffect(() => {
    if (!account || account.paypal_subscription_id) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('account_id', user.id).then(({ count }) => {
        setQuotaUsed(count ?? 0);
      });
    });
  }, [account]);

  const remaining = Math.max(0, FREE_QUOTA - quotaUsed);
  const isFree = !account?.paypal_subscription_id;
  const isExhausted = isFree && remaining === 0;

  // 14 天试用计时：优先用显式 trial_ends_at，老账号回退到 created_at + TRIAL_DAYS 推算
  const trialEndsAt = account?.trial_ends_at
    ? new Date(account.trial_ends_at)
    : account?.created_at
      ? new Date(new Date(account.created_at).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
      : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : TRIAL_DAYS;
  const isTrialOver = isFree && !!trialEndsAt && trialEndsAt.getTime() <= Date.now();
  // 锁定态：额度用尽 或 试用过期，二选一即锁
  const isLocked = isFree && (isExhausted || isTrialOver);

  const filtered = quotes.filter((q) => filter === 'all' || q.status === filter);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const displayedQuotes = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t || (!t.closest('#export-menu') && !t.closest('#export-btn'))) {
        setExportOpen(false);
      }
    }
    if (exportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportOpen]);

  return (
    <div>
      {/* 强制付款弹窗：锁定态不可关闭，阻断全部操作区 */}
      {isLocked && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#0a0a0f',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '24px 28px',
            maxWidth: 780,
            width: '100%',
            textAlign: 'center',
          }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              {isTrialOver ? 'Your free trial (14 days or 3 clients) has ended' : 'Free plan quota used up'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--fg-dim)', margin: '12px 0 20px', lineHeight: 1.6 }}>
              {isTrialOver
                ? 'You need an active subscription to keep using QuoteFollow.'
                : `You've used all ${FREE_QUOTA} free clients. Upgrade to Pro to keep sending quotes and follow-ups.`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 10, alignItems: 'stretch', textAlign: 'center' }}>
              {config.pricing.tiers?.map((tier) => (
                <div
                  key={tier.id}
                  style={{
                    border: tier.isPopular ? '1px solid rgba(99,102,241,0.55)' : '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 14,
                    padding: '12px 10px 10px',
                    background: 'rgba(255,255,255,0.04)',
                    textAlign: 'left',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#6366f1,#a855f7,#6366f1)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{tier.name}</span>
                    {tier.badge && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: tier.isPopular ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.10)', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.05, whiteSpace: 'nowrap' }}>
                        {tier.badge}
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', background: 'linear-gradient(135deg,#fff 0%,#a5b4fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', lineHeight: 1.1 }}>
                    ${tier.price}
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-dim)', WebkitTextFillColor: 'var(--fg-dim)', marginLeft: 4 }}>/ {tier.period === 'month' ? 'month' : 'year'}</span>
                  </div>
                  {tier.features && tier.features.length > 0 && (
                    <ul style={{ margin: '6px 0 8px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {tier.features.slice(0, 2).map((feat, j) => (
                        <li key={j} style={{ fontSize: 11, color: 'var(--fg-dim)', display: 'flex', gap: 5, alignItems: 'flex-start' }}>
                          <span style={{ color: '#34d399', fontSize: 11, lineHeight: 1.5 }}>✓</span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div style={{ textAlign: 'center' }}>
                    <PayPalSubscribeButton planId={tier.planId} bindMode onBound={loadQuotes} label={tier.cta || `Subscribe — $${tier.price}/${tier.period === 'month' ? 'mo' : 'yr'}`} />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn"
              onClick={handleRecheck}
              disabled={rechecking}
              style={{ width: '100%', maxWidth: 300, margin: '14px auto 0', padding: '10px 20px', fontSize: 13, background: 'transparent', border: '1px solid var(--border)', color: 'var(--fg)' }}
            >
              {rechecking ? 'Checking…' : "I've paid — re-check my account"}
            </button>
            <form action="/api/logout" method="post" style={{ width: '100%', maxWidth: 300, margin: '8px auto 0' }}>
              <button
                type="submit"
                className="btn"
                style={{ width: '100%', padding: '10px 20px', fontSize: 13, background: 'transparent', border: '1px solid var(--border)', color: 'var(--fg)' }}
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <h1>Your quotes</h1>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                            <div style={{ position: 'relative' }}>
                                              <button
                                                id="export-btn"
                                                className="btn"
                                                style={{ width: 'fit-content', padding: '10px 16px', fontSize: 14 }}
                                                onClick={() => setExportOpen(!exportOpen)}
                                              >
                                                Export ▼
                                              </button>
                                              {exportOpen && (
                                                                                              <div id="export-menu" style={{
                                                                                                position: 'absolute',
                                                                                                top: '100%',
                                                                                                right: 0,
                                                                                                marginTop: 8,
                                                                                                background: '#0a0a0f',
                                                                                                border: '1px solid var(--border)',
                                                                                                borderRadius: 8,
                                                                                                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                                                                                                zIndex: 100,
                                                                                                minWidth: 180,
                                                                                              }}>
                                                                                                <a
                                                                                                  href="/api/export?format=csv&range=week"
                                                                                                  style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', borderRadius: 0, border: 'none', background: 'transparent', fontSize: 14, color: 'var(--fg)' }}
                                                                                                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                                                                                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                                                                                >
                                                                                                  This week (CSV)
                                                                                                </a>
                                                                                                <a
                                                                                                  href="/api/export?format=csv&range=month"
                                                                                                  style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', borderRadius: 0, border: 'none', background: 'transparent', fontSize: 14, color: 'var(--fg)' }}
                                                                                                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                                                                                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                                                                                >
                                                                                                  This month (CSV)
                                                                                                </a>
                                                                                                <a
                                                                                                  href="/api/export?format=csv&range=quarter"
                                                                                                  style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', borderRadius: 0, border: 'none', background: 'transparent', fontSize: 14, color: 'var(--fg)' }}
                                                                                                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                                                                                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                                                                                >
                                                                                                  This quarter (CSV)
                                                                                                </a>
                                                                                                <a
                                                                                                  href="/api/export?format=csv&range=year"
                                                                                                  style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', borderRadius: 0, border: 'none', background: 'transparent', fontSize: 14, color: 'var(--fg)' }}
                                                                                                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                                                                                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                                                                                >
                                                                                                  This year (CSV)
                                                                                                </a>
                                                                                              </div>
                                                                                            )}
                                            </div>
                                            <Link
                                              href="/dashboard/new"
                                              className="btn"
                                              style={{ width: 'fit-content', padding: '10px 16px', opacity: isLocked ? 0.5 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}
                                            >
                                              + Send a quote
                                            </Link>
                                          </div>
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
              ? 'Free plan quota used up (3 clients) — '
              : isTrialOver
                ? 'Your free trial (14 days or 3 clients) has ended — '
                : `Free plan: ${remaining} of ${FREE_QUOTA} clients remaining · ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left in trial`}
          </span>
          {!isExhausted && !isTrialOver && (
            <Link
              href="/signup"
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: '#166534',
                textDecoration: 'underline',
                whiteSpace: 'nowrap',
              }}
            >
              Unlimited — $49/mo
            </Link>
          )}
          {!isExhausted && !isTrialOver && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 120,
                height: 6,
                background: '#d1fae5',
                borderRadius: 3,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.min(100, (quotaUsed / FREE_QUOTA) * 100)}%`,
                  height: '100%',
                  background: '#22c55e',
                  borderRadius: 3,
                  transition: 'width 0.3s',
                }} />
              </div>
              <span style={{ fontSize: 12, color: '#166534' }}>{quotaUsed}/{FREE_QUOTA}</span>
            </div>
          )}
          {isLocked && (
            <a href={`https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=${PLAN_PRO_ID}`} target="_blank" rel="noopener noreferrer" style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              background: '#f59e0b',
              padding: '6px 14px',
              borderRadius: 8,
              textDecoration: 'none',
            }}>
              Upgrade to Pro — $49/mo
            </a>
          )}
        </div>
              )}

              {/* Refer & Earn */}
                            {isFree && (
                <div style={{ marginTop: 24, padding: '20px 24px', background: 'var(--bg-glass)', borderRadius: 12, border: '1px solid var(--border)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 280 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#a5b4fc', marginBottom: 4 }}>Refer & Earn</p>
                      <p style={{ fontSize: 13, color: '#818cf8', margin: 0 }}>Share your link. When someone subscribes, you both get 1 month free.</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, color: '#818cf8', fontWeight: 500 }}>
        Your link: <code style={{ background: 'rgba(99,102,241,0.2)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{storedCode ? `voxalo.top/signup?ref=${storedCode}` : 'Loading...'}</code>
      </span>
      <button className="btn" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => {
        if (!storedCode) return;
        navigator.clipboard.writeText(`https://www.voxalo.top/signup?ref=${storedCode}`).then(() => alert('Link copied!'));
      }}>{storedCode ? 'Copy link' : 'Loading...'}</button>
                      <Link href="/dashboard/refer" className="btn" style={{ padding: '8px 16px', fontSize: 13, background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--fg)' }}>View stats</Link>
                    </div>
                  </div>
                </div>
              )}

              <p className="page-sub" style={{ marginTop: 12 }}>
        {account?.followup_email
          ? <>Forward or BCC every quote to <strong>{account.followup_email}</strong> and it appears here automatically — or click <strong>Add a quote</strong> to paste it in.</>
          : <>Click <strong>Add a quote</strong> and paste the email you sent a customer, or set up your follow-up inbox in <Link href="/dashboard/settings" style={{ color: '#2563eb' }}>Settings</Link>.</>}
      </p>

      {!loading && (
        <div className="stats-grid">
          <div className="stat-card" data-tilt>
            <div className="stat-label">Total quotes</div>
            <div className="stat-value purple">{quotes.length}</div>
          </div>
          <div className="stat-card" data-tilt>
            <div className="stat-label">Following up</div>
            <div className="stat-value amber">{quotes.filter((q) => q.status === 'following').length}</div>
          </div>
          <div className="stat-card" data-tilt>
            <div className="stat-label">Won</div>
            <div className="stat-value green">{quotes.filter((q) => q.status === 'won').length}</div>
          </div>
          <div className="stat-card" data-tilt>
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
            <div className="stat-label">Paused</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{quotes.filter((q) => q.status === 'paused').length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Closed</div>
            <div className="stat-value" style={{ color: '#f87171' }}>{quotes.filter((q) => q.status === 'closed').length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Lost</div>
            <div className="stat-value" style={{ color: '#9ca3af' }}>{quotes.filter((q) => q.status === 'lost').length}</div>
          </div>
        </div>
      )}

      <div className="status-pills">
        {(['all', 'following', 'replied', 'paused', 'closed', 'won', 'lost'] as Filter[]).map((f) => (
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
                    {q.next_followup_at && <>{' · '}Next: {formatDate(q.next_followup_at)}</>}
                  </div>
                </div>
                <div className="right">
                  {(() => {
                    const heat = computeHeat(q);
                    return (
                      <span
                        className="badge-status"
                        style={{ color: heat.color, borderColor: heat.color }}
                        title={heat.reason}
                      >
                        {heat.label}
                      </span>
                    );
                  })()}
                  {q.amount !== null && q.amount > 0 && (
                    <span className="amount">${q.amount}</span>
                  )}
                  {q.require_deposit && (
                    <span className={`badge-status ${q.deposit_status === 'paid' ? 'won' : 'following'}`} style={{ color: q.deposit_status === 'paid' ? '#34d399' : '#fbbf24' }}>
                      {q.deposit_status === 'paid' ? 'Deposit paid' : 'Deposit due'}
                    </span>
                  )}
                  <span className="badge-status" style={{ color: statusColor(q.status), borderColor: statusColor(q.status) }}>
                    {statusLabel(q.status)}
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
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-glass)', color: 'var(--fg)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <span style={{ padding: '8px 16px', color: 'var(--fg-dim)' }}>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-glass)', color: 'var(--fg)', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1 }}
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