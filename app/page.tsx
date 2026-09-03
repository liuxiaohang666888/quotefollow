'use client';

import { useState } from 'react';
import Link from 'next/link';
import PayPalSubscribeButton from '@/components/PayPalSubscribeButton';
import DashboardPreview from '@/components/DashboardPreview';

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

export default function LandingPage() {
  const [active, setActive] = useState<number>(-1);

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
            <span className="brand-name">QuoteFollow</span>
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
        <p className="eyebrow">For contractors & small business owners</p>
        <h1>You sent the quote. <span className="gradient">Stop ignoring it.</span></h1>
        <p className="hero-sub">
          QuoteFollow reads your quote emails and follows up with your customers on auto-pilot — so you never lose another job to silence.
        </p>
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
        <div className="case-card">
            <div className="case-tag">Plumber · Sydney</div>
            <p>"Sent 15 quotes last month. Followed up on 3. The other 12? Who knows."</p>
            <div className="case-loss">Lost revenue: <strong>$14,200</strong></div>
          </div>
          <div className="case-card">
            <div className="case-tag">Electrician · Melbourne</div>
            <p>"Client went with another guy because I took 4 days to get back to them."</p>
            <div className="case-loss">Lost revenue: <strong>$8,500</strong></div>
          </div>
          <div className="case-card">
            <div className="case-tag">Builder · Brisbane</div>
            <p>"I meant to follow up, but by the time I remembered it was 2 weeks later."</p>
            <div className="case-loss">Lost revenue: <strong>$22,000</strong></div>
          </div>
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
              <p>Sent a $8,500 bathroom renovation quote on Tuesday.</p>
            </div>
            <div className="compare-timeline">
              <div className="timeline-day">
                <span className="day-num">Tue</span>
                <span className="day-label">你：忙，没空跟进</span>
              </div>
              <div className="timeline-day">
                <span className="day-num">Wed</span>
                <span className="day-label">还是没回音</span>
              </div>
              <div className="timeline-day">
                <span className="day-num">Thu</span>
                <span className="day-label">客户打给了跟进的同行</span>
              </div>
              <div className="timeline-day">
                <span className="day-num">Fri</span>
                <span className="day-label">你接到电话："找了别人"</span>
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
              <span>QuoteFollow follows up</span>
            </div>
            <div className="compare-scenario">
              <p className="scenario-label">Scenario</p>
              <p>Sent a $8,500 bathroom renovation quote on Tuesday.</p>
            </div>
            <div className="compare-timeline">
              <div className="timeline-day">
                <span className="day-num">Tue</span>
                <span className="day-label">你正常发送报价</span>
              </div>
              <div className="timeline-day">
                <span className="day-num">Wed</span>
                <span className="day-label">QuoteFollow 自动跟进："有问题吗？"</span>
              </div>
              <div className="timeline-day">
                <span className="day-num">Thu</span>
                <span className="day-label">客户回复："做！"</span>
              </div>
              <div className="timeline-day">
                <span className="day-num">Fri</span>
                <span className="day-label">Dashboard：成交，款在路上</span>
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
          <div className="step-card">
            <div className="step-num">01</div>
            <h3>Send your quote as usual</h3>
            <p>Email, SMS, or just paste it into the dashboard. We don't care how you work — we adapt to you.</p>
          </div>
          <div className="step-card">
            <div className="step-num">02</div>
            <h3>AI follows up at the right time</h3>
            <p>QuoteFollow reads your quote, saves it, and sends smart follow-ups when it matters most — not too early, not too late.</p>
          </div>
          <div className="step-card">
            <div className="step-num">03</div>
            <h3>You only handle hot leads</h3>
            <p>FAQs get answered automatically. When a customer says "yes", you get an instant alert. That's the money part.</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section" id="features">
        <p className="eyebrow">Features</p>
        <h2>Everything you need to stop losing quotes</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">{icons.chat}</div>
            <h3>Smart follow-ups that sound like you</h3>
            <p>No robotic "just checking in" messages. AI writes follow-ups that match your tone — friendly, professional, human.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">{icons.clock}</div>
            <h3>Smart timing</h3>
            <p>AI picks the best moment to follow up — when your customer is most likely to reply, not when you feel guilty.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">{icons.flame}</div>
            <h3>Hot lead detection</h3>
            <p>Know which quotes are hot, warm, or cold before the customer tells you. Focus your energy where it counts.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">{icons.chart}</div>
            <h3>Win/loss analysis</h3>
            <p>See what's working. Track your quote-to-job conversion rate and understand why you win (or lose) jobs.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">{icons.reply}</div>
            <h3>AI auto-reply</h3>
            <p>Common questions about pricing, availability, and deposits get answered instantly — 24/7, even while you sleep.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">{icons.bell}</div>
            <h3>Instant alerts</h3>
            <p>Get notified the second a customer is ready to book. Strike while the iron is hot.</p>
          </div>
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
          <p>
            My mate runs a cleaning company. Last quarter he sent out 47 quotes. Got replies from 12. He was too busy actually doing the cleaning jobs to follow up on the other 35.
          </p>
          <p>
            I did the math. At an average job value of $650, that's <strong>$22,750</strong> in potential revenue just… gone. Not because his prices were wrong. Not because his work was bad. Because he forgot to follow up.
          </p>
          <p>
            QuoteFollow exists so you never have to face that again. Send your quotes the way you always do. Even on your busiest week, the follow-ups happen automatically.
          </p>
        </div>
        <div className="story-visual">
          <div className="story-card">
            <div className="story-card-header">
              <span className="story-card-label">QuoteFollow</span>
              <span className="story-card-badge">Day 3 Follow-up</span>
            </div>
            <div className="story-card-body">
              <p className="story-card-text">"Hey Mike, just checking in on that kitchen quote I sent over. Any questions or ready to lock it in?"</p>
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
              <span className="pricing-amount">$29</span>
              <span className="pricing-period">USD / month</span>
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
              <PayPalSubscribeButton label="Subscribe — $29/month" />
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
          <div className="faq-item">
            <button className="faq-question" onClick={() => setActive(active === 0 ? -1 : 0)}>
              <span>How does QuoteFollow know I sent a quote?</span>
              <span className="faq-toggle">{active === 0 ? '−' : '+'}</span>
            </button>
            {active === 0 && (
              <div className="faq-answer">
                <p>You can forward quote emails to your unique inbox address, or paste them directly into the dashboard. Either way, we read and archive every quote automatically.</p>
              </div>
            )}
          </div>
          <div className="faq-item">
            <button className="faq-question" onClick={() => setActive(active === 1 ? -1 : 1)}>
              <span>What happens when a customer replies?</span>
              <span className="faq-toggle">{active === 1 ? '−' : '+'}</span>
            </button>
            {active === 1 && (
              <div className="faq-answer">
                <p>Any reply goes straight into your dashboard. You'll see whether it's positive, negative, or needs a response — and you'll get an instant alert if they say "yes".</p>
              </div>
            )}
          </div>
          <div className="faq-item">
            <button className="faq-question" onClick={() => setActive(active === 2 ? -1 : 2)}>
              <span>Will the customer know it's automated?</span>
              <span className="faq-toggle">{active === 2 ? '−' : '+'}</span>
            </button>
            {active === 2 && (
              <div className="faq-answer">
                <p>No. The follow-ups are written to sound like you — natural, friendly, and professional. Most customers won't even notice it's automated.</p>
              </div>
            )}
          </div>
          <div className="faq-item">
            <button className="faq-question" onClick={() => setActive(active === 3 ? -1 : 3)}>
              <span>Can I control what the AI says?</span>
              <span className="faq-toggle">{active === 3 ? '−' : '+'}</span>
            </button>
            {active === 3 && (
              <div className="faq-answer">
                <p>Yes. You can review and edit every follow-up before it's sent. You're always in control.</p>
              </div>
            )}
          </div>
          <div className="faq-item">
            <button className="faq-question" onClick={() => setActive(active === 4 ? -1 : 4)}>
              <span>What if the customer asks something the AI can't answer?</span>
              <span className="faq-toggle">{active === 4 ? '−' : '+'}</span>
            </button>
            {active === 4 && (
              <div className="faq-answer">
                <p>The AI handles common questions about pricing, availability, and process. For anything complex, it flags it for you and you can step in directly.</p>
              </div>
            )}
          </div>
          <div className="faq-item">
            <button className="faq-question" onClick={() => setActive(active === 5 ? -1 : 5)}>
              <span>Is my data secure?</span>
              <span className="faq-toggle">{active === 5 ? '−' : '+'}</span>
            </button>
            {active === 5 && (
              <div className="faq-answer">
                <p>Your data is encrypted and stored securely. We never sell or share your information. You can delete your account and all data at any time.</p>
              </div>
            )}
          </div>
          <div className="faq-item">
            <button className="faq-question" onClick={() => setActive(active === 6 ? -1 : 6)}>
              <span>How much does it cost?</span>
              <span className="faq-toggle">{active === 6 ? '−' : '+'}</span>
            </button>
            {active === 6 && (
              <div className="faq-answer">
                <p>$29/month for the Professional plan. That's less than one lost job. Cancel anytime — no contracts, no hidden fees.</p>
              </div>
            )}
          </div>
          <div className="faq-item">
            <button className="faq-question" onClick={() => setActive(active === 7 ? -1 : 7)}>
              <span>When will I see results?</span>
              <span className="faq-toggle">{active === 7 ? '−' : '+'}</span>
            </button>
            {active === 7 && (
              <div className="faq-answer">
                <p>Most users see their first recovered job within 2 weeks. The Day 1 follow-up alone can re-engage customers who went silent.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="final-cta-section">
        <h2>Stop losing jobs to silence.</h2>
        <p>Join contractors who never miss a follow-up again.</p>
        <Link href="/signup" className="btn btn-lg">
          Get started free
          <span className="arrow">→</span>
        </Link>
        <p className="final-cta-note">No credit card required · Cancel anytime</p>
      </section>

      <footer className="footer">
        <div className="footer-brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-name">QuoteFollow</span>
        </div>
        <div className="footer-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href="mailto:support@voxalo.top">Support</a>
        </div>
        <p className="footer-copy">© 2026 QuoteFollow. All rights reserved.</p>
      </footer>
    </div>
  );
}
