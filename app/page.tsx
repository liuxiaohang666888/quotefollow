'use client';

import { useState } from 'react';
import Link from 'next/link';
import PayPalSubscribeButton from '@/components/PayPalSubscribeButton';
import DashboardPreview from '@/components/DashboardPreview';
import { getVerticalConfig, getBrandName } from '@/lib/vertical';

// 统一线性图标（stroke=currentColor），比 emoji 更克制、更接近苹果风格
const icons = {
  chat: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  clock: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
    </svg>
  ),
  flame: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l3-8 4 16 3-8h4"/>
    </svg>
  ),
  chart: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-6"/>
    </svg>
  ),
  reply: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  bell: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
};

const iconMap: Record<string, React.ReactNode> = {
  chat: icons.chat,
  clock: icons.clock,
  flame: icons.flame,
  chart: icons.chart,
  reply: icons.reply,
  bell: icons.bell,
};

export default function LandingPage() {
  const [active, setActive] = useState<number>(-1);
  const config = getVerticalConfig();
  const brand = getBrandName();

  return (
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
            <Link href="#pricing" className="nav-link"> Pricing</Link>
            <Link href="#how-it-works" className="nav-link"> How it Works</Link>
            <Link href="#features" className="nav-link"> Features</Link>
            <Link href="/login" className="nav-link"> Log in</Link>
            <Link href="/signup" className="btn btn-sm">Get started free</Link>
          </nav>
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">{config.eyebrow}</p>
        <h1>{config.tagline} <span className="gradient">{config.gradientText}</span></h1>
        <p className="hero-sub">{config.heroSub}</p>
        <div className="hero-actions">
          <Link href="/signup" className="btn">
            Get started free
            <span className="arrow">→</span>
          </Link>
          <Link href="/login" className="btn btn-ghost">
            Log in
          </Link>
        </div>
        <p className="hero-trust">No credit card required · Cancel anytime</p>
        <p className="hero-tech">
          <span className="trust-badge">Powered by PayPal</span>
        </p>
      </section>

      {/* Pain section */}
      <section className="pain-section" id="how-it-works">
        <p className="eyebrow"> Sound familiar?</p>
        <h2>These are the jobs people lose because they forgot to follow up.</h2>
        <div className="case-cards">
          {config.painPoints.map((p, i) => (
            <div className="case-card" key={i}>
              <div className="case-tag">{p.tag}</div>
              <p>{p.quote}</p>
              <div className="case-loss">{p.loss}: <strong>{p.amount}</strong></div>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="compare-section">
        <p className="eyebrow">See the difference</p>
        <h2>The same quote. Completely different outcome.</h2>
        <div className="compare-grid">
          <div className="compare-col compare-no">
            <div className="compare-header">
              <span className="compare-icon">✕</span>
              <span>No follow-up</span>
            </div>
            <div className="compare-scenario">
              <p className="scenario-label">Scenario</p>
              <p>Sent a $8,500 quote on Tuesday.</p>
            </div>
            <div className="compare-timeline">
              <div className="timeline-day">
                <span className="day-num">Tue</span>
                <span className="day-label">You: busy, no time</span>
              </div>
              <div className="timeline-day">
                <span className="day-num">Wed</span>
                <span className="day-label">Still silent</span>
              </div>
              <div className="timeline-day">
                <span className="day-num">Thu</span>
                <span className="day-label">Client calls competitor who followed up</span>
              </div>
              <div className="timeline-day">
                <span className="day-num">Fri</span>
                <span className="day-label">You get a call: "Found someone else"</span>
              </div>
            </div>
            <div className="compare-result">
              <p className="result-label">Result</p>
              <p className="result-amount">-$8,500</p>
              <p className="result-note">Gone. Just like that.</p>
            </div>
          </div>
          <div className="compare-col compare-yes">
            <div className="compare-header">
              <span className="compare-icon">✓</span>
              <span>{brand} follows up</span>
            </div>
            <div className="compare-scenario">
              <p className="scenario-label">Scenario</p>
              <p>Sent a $8,500 quote on Tuesday.</p>
            </div>
            <div className="compare-timeline">
              <div className="timeline-day">
                <span className="day-num">Tue</span>
                <span className="day-label">You send the quote normally</span>
              </div>
              <div className="timeline-day">
                <span className="day-num">Wed</span>
                <span className="day-label">{brand} sends: "Hey Sarah, any questions?"</span>
              </div>
              <div className="timeline-day">
                <span className="day-num">Thu</span>
                <span className="day-label">Client replies: "Yeah, let's do it!"</span>
              </div>
              <div className="timeline-day">
                <span className="day-num">Fri</span>
                <span className="day-label">Dashboard: job booked, payment incoming</span>
              </div>
            </div>
            <div className="compare-result">
              <p className="result-label">Result</p>
              <p className="result-amount">+$8,500</p>
              <p className="result-note">Locked in. You did nothing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="steps-section">
        <p className="eyebrow">How it works</p>
        <h2>Set it up once. Walk away. Win more jobs.</h2>
        <div className="steps-grid">
          {config.howItWorks.map((step, i) => (
            <div className="step-card" key={i}>
              <div className="step-num">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="features-section" id="features">
        <p className="eyebrow">Features</p>
        <h2>Everything you need to stop losing quotes</h2>
        <div className="features-grid">
          {config.features.map((f, i) => (
            <div className="feature-card" key={i}>
              <div className="feature-icon">{iconMap[f.iconKey]}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="preview-section">
        <p className="eyebrow">Preview</p>
        <h2>This is what your dashboard looks like</h2>
        <p className="preview-sub">All your quotes in one place. Filter, search, and track every job.</p>
        <DashboardPreview />
        <div className="preview-cta">
          <p>Ready to stop losing quotes? Set up your dashboard in 10 minutes.</p>
          <Link href="/signup" className="btn">
            Get started free →
          </Link>
        </div>
      </section>

      {/* Story */}
      <section className="story-section">
        <div className="story-content">
          <p className="eyebrow">Story</p>
          <h2>Why I built this</h2>
          <p>{config.story.intro} {config.story.hook} {config.story.business}</p>
          <p>
            I did the math. That's <strong>{config.story.lossAmount}</strong> in potential revenue just… gone. {config.story.closing}
          </p>
          <p>
            {brand} exists so you never have to face that again. Send your quotes the way you always do. Even on your busiest week, the follow-ups happen automatically.
          </p>
        </div>
        <div className="story-visual">
          <div className="story-card">
            <div className="story-card-header">
              <span className="story-card-label">{brand}</span>
              <span className="story-card-badge">Day 3 Follow-up</span>
            </div>
            <div className="story-card-body">
              <p className="story-card-text">"Hey Mike, just checking in on that quote I sent over. Any questions or ready to lock it in?"</p>
            </div>
            <div className="story-card-footer">
              <span>Sent automatically · 2:34 PM</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="pricing-section" id="pricing">
        <p className="eyebrow">Pricing</p>
        <h2>Simple pricing</h2>
        <p className="pricing-sub">Free to start. Upgrade when you outgrow it.</p>
        <div className="pricing-grid">
          <div className="pricing-card free">
            <div className="pricing-header">
              <div className="pricing-name">Free</div>
              <div className="pricing-badge">Start here</div>
            </div>
            <div className="pricing-price">
              <span className="pricing-amount">$0</span>
              <span className="pricing-period">forever</span>
            </div>
            <div className="pricing-features">
              <div className="pricing-feature">
                <span className="check">✓</span>
                <span>Up to 10 quotes</span>
              </div>
              <div className="pricing-feature">
                <span className="check">✓</span>
                <span>AI quote reading & dashboard</span>
              </div>
              <div className="pricing-feature">
                <span className="check">✓</span>
                <span>Day 1 / 3 / 7 follow-ups</span>
              </div>
              <div className="pricing-feature">
                <span className="check">✓</span>
                <span>AI auto-reply to common questions</span>
              </div>
            </div>
            <div className="pricing-cta">
              <Link href="/signup" className="btn" style={{ width: '100%', justifyContent: 'center' }}>
                Get started free
              </Link>
            </div>
          </div>
          <div className="pricing-card">
            <div className="pricing-header">
              <div className="pricing-name">Professional</div>
              <div className="pricing-badge">Most popular</div>
            </div>
            <div className="pricing-price">
              <span className="pricing-amount">${config.pricing.monthly}</span>
              <span className="pricing-period">{config.pricing.currency} / month</span>
            </div>
            <div className="pricing-features">
              <div className="pricing-feature">
                <span className="check">✓</span>
                <span>Unlimited quotes & customers</span>
              </div>
              <div className="pricing-feature">
                <span className="check">✓</span>
                <span>Your own follow-up inbox</span>
              </div>
              <div className="pricing-feature">
                <span className="check">✓</span>
                <span>AI quote reading & dashboard</span>
              </div>
              <div className="pricing-feature">
                <span className="check">✓</span>
                <span>Precise follow-ups (Day 1, 3, 7)</span>
              </div>
              <div className="pricing-feature">
                <span className="check">✓</span>
                <span>AI answers common questions</span>
              </div>
              <div className="pricing-feature">
                <span className="check">✓</span>
                <span>Cancel anytime</span>
              </div>
            </div>
            <div className="pricing-cta">
              <PayPalSubscribeButton label={`Subscribe — $${config.pricing.monthly}/month`} />
              <p className="pricing-guarantee">No credit card required · Cancel anytime</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section">
        <p className="eyebrow">FAQ</p>
        <h2>Common questions</h2>
        <div className="faq-list">
          {config.faq.map((item, i) => (
            <div className="faq-item" key={i}>
              <button className="faq-question" onClick={() => setActive(active === i ? -1 : i)}>
                <span>{item.q}</span>
                <span className="faq-toggle">{active === i ? '−' : '+'}</span>
              </button>
              {active === i && (
                <div className="faq-answer">
                  <p>{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="final-cta-section">
        <h2>Stop losing jobs to silence.</h2>
        <p>Join {config.audience} who never miss a follow-up again.</p>
        <Link href="/signup" className="btn btn-lg">
          Get started free
          <span className="arrow">→</span>
        </Link>
        <p className="final-cta-note">No credit card required · Cancel anytime</p>
      </section>

      <footer className="footer">
        <div className="footer-brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-name">{brand}</span>
        </div>
        <div className="footer-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href={`mailto:${config.footer.supportEmail}`}>Support</a>
        </div>
        <p className="footer-copy">© 2026 {config.footer.copyright}. All rights reserved.</p>
      </footer>
    </div>
  );
}