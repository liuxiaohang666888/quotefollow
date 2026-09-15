'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function ReferPage() {
  const [account, setAccount] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }

      const { data: acc } = await supabase
        .from('accounts')
        .select('referral_code, free_months_earned, business_name')
        .eq('id', user.id)
        .single();
      setAccount(acc);

      const { data: refs } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });
      setReferrals(refs || []);
      setLoading(false);
    };
    load();
  }, []);

  function copyLink() {
    const link = `https://www.voxalo.top/signup?ref=${account?.referral_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <p style={{ color: '#6b7280' }}>Loading…</p>;

  const referredCount = referrals.length;
  const completedCount = referrals.filter(r => r.status === 'completed').length;
  const freeMonths = account?.free_months_earned || 0;

  return (
    <div>
      <Link href="/dashboard" style={{ color: '#2563eb', fontSize: 14 }}>← Back to dashboard</Link>
      <h1 style={{ marginTop: 12 }}>Refer & Earn</h1>
      <p className="page-sub">Share your link. When someone subscribes, you both get 1 month free.</p>

      {/* Referral Link Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Your referral link</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={`https://www.voxalo.top/signup?ref=${account?.referral_code || ''}`}
            readOnly
            style={{
              flex: 1,
              minWidth: 200,
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-glass)',
              color: 'var(--fg)',
              fontSize: 14,
              fontFamily: 'monospace',
            }}
          />
          <button
            className="btn"
            style={{ padding: '12px 24px', whiteSpace: 'nowrap' }}
            onClick={copyLink}
          >
            {copied ? '✓ Copied!' : 'Copy link'}
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--fg-dim)', marginTop: 12 }}>
          Share this link via email, LinkedIn, or DMs. Works for anyone — freelancers, agencies, contractors.
        </p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Referred</div>
          <div className="stat-value purple">{referredCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value green">{completedCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Free months</div>
          <div className="stat-value amber">{freeMonths}</div>
        </div>
      </div>

      {/* Referral List */}
      <div className="card">
        <h3>Referral history</h3>
        {referrals.length === 0 ? (
          <p style={{ color: 'var(--fg-dim)', fontSize: 14 }}>No referrals yet. Share your link to start earning!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {referrals.map((r) => (
              <div key={r.id} style={{
                padding: '12px 16px',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>
                    {r.referred_id === account?.id ? 'You' : r.referred_id?.slice(0, 8) + '...'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-dim)' }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span className={`badge-status ${r.status === 'completed' ? 'won' : r.status === 'pending' ? 'following' : 'lost'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
