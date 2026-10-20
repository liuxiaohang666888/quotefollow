'use client';

import Link from 'next/link';
import PayPalSubscribeButton from '@/components/PayPalSubscribeButton';
import { getVerticalConfig, getBrandName } from '@/lib/vertical';

// ⚠️ 测试专用页：完整渲染三档订阅选择（Early Bird $29 / Pro $49 / Yearly $490），
//    每档透传 tier.planId 给 PayPalSubscribeButton。
//    顶部醒目标注：点击订阅按钮会真实发起 PayPal 订阅流程（正式扣款）。
export default function SubscribeTestPage() {
  const config = getVerticalConfig();
  const brand = getBrandName();
  const tiers = config.pricing.tiers || [];

  return (
    <>
      <div className="landing">
        <header className="landing-header">
          <div className="landing-header-inner">
            <div className="brand">
              <span className="brand-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-6"/>
                </svg>
              </span>
              <span className="brand-name">{brand}</span>
            </div>
            <nav className="landing-nav">
              <Link href="/" className="nav-link">Home</Link>
              <Link href="/dashboard" className="nav-link">Dashboard</Link>
              <Link href="/login" className="nav-link nav-link-login">Log in</Link>
            </nav>
          </div>
        </header>

        {/* 醒目标注：真实订阅测试 */}
        <div style={{
          maxWidth: 760,
          margin: '40px auto 0',
          padding: '14px 18px',
          border: '2px solid rgba(248, 113, 113, 0.55)',
          borderRadius: 12,
          background: 'rgba(248, 113, 113, 0.12)',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f87171', letterSpacing: 0.2 }}>
            ⚠️ TEST PAGE — REAL PAYPAL SUBSCRIPTION
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--fg-dim)', lineHeight: 1.6 }}>
            This page renders the three subscription tiers for testing. Clicking any Subscribe button will{' '}
            <strong style={{ color: 'var(--fg)' }}>really initiate the PayPal subscription flow</strong> and may charge your account.
            Do not click unless you intend to subscribe.
          </p>
        </div>

        {/* Pricing — 三档订阅测试 */}
        <section className="pricing-section" id="pricing" style={{ paddingTop: 32 }}>
          <p className="eyebrow">Subscribe Test</p>
          <h2>Three-tier subscription test</h2>
          <p className="pricing-sub">Early Bird $29/mo · Pro $49/mo · Yearly $490/yr — each tier passes its own planId.</p>
          <div className="pricing-grid">
            {tiers.map((tier, i) => (
              <div className={`pricing-card ${tier.isPopular ? 'popular' : ''}`} key={tier.id || i} data-tilt>
                <div className="pricing-header">
                  <div className="pricing-name">{tier.name}</div>
                  {tier.badge && <div className="pricing-badge">{tier.badge}</div>}
                </div>
                <div className="pricing-price">
                  <span className="pricing-amount">${tier.price}</span>
                  <span className="pricing-period">{tier.period === 'month' ? '/ month' : tier.period}</span>
                </div>
                <div className="pricing-features">
                  {tier.features.map((feat, j) => (
                    <div className="pricing-feature" key={j}>
                      <span className="check">✓</span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
                <div className="pricing-cta">
                  <PayPalSubscribeButton planId={tier.planId} label={tier.cta || `Subscribe — $${tier.price}/${tier.period === 'month' ? 'mo' : 'yr'}`} />
                  <p className="pricing-guarantee">planId: {tier.planId || 'missing → explicit config error'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
