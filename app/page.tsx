import PayPalSubscribeButton from '../components/PayPalSubscribeButton';
import DemoPreview from './components/DemoPreview';

export default function LandingPage() {
  const painStories = [
    { emoji: '😤', role: 'Plumber', location: 'Sydney', quote: 'Sent 15 quotes last month. Followed up on 3. The other 12? Who knows.' },
    { emoji: '💸', role: 'Electrician', location: 'Melbourne', quote: 'Customer went with someone else because I took 4 days to follow up.' },
    { emoji: '⏰', role: 'Builder', location: 'Brisbane', quote: 'Should follow up but on the tools at 6am. By the time I remember, it\'s been two weeks.' },
  ];

  const comparison = {
    before: [
      { day: 'Mon', event: 'Sent quote for bathroom reno — $8,500' },
      { day: 'Tue–Wed', event: 'Silence… too busy to follow up' },
      { day: 'Thu', event: 'Sarah chose a competitor who followed up first' },
      { day: 'Fri', event: 'You call: "Oh, we found someone else." $8,500 gone.' },
    ],
    after: [
      { day: 'Mon', event: 'Sent quote for bathroom reno — $8,500' },
      { day: 'Wed', event: 'Auto follow-up sent: "Hey Sarah, any questions?"' },
      { day: 'Thu', event: 'Sarah replies: "Yeah, let\'s do it!"' },
      { day: 'Fri', event: 'You get alerted → Job booked. $8,500 locked in.' },
    ],
  };

  const features = [
    { icon: '🤖', title: 'Auto Follow-Up', desc: 'Intelligent follow-ups that sound like you wrote them. No robotic messages.' },
    { icon: '🧠', title: 'Smart Timing', desc: 'AI picks the best moment to follow up — not too early, not too late.' },
    { icon: '🔥', title: 'Hot Lead Detection', desc: 'Know which quotes are hot, warm, or cold before the customer tells you.' },
    { icon: '📊', title: 'Win / Loss Analytics', desc: 'See what\'s working. Track your quote-to-job conversion rate over time.' },
    { icon: '💬', title: 'AI Auto-Replies', desc: 'Common questions (pricing, timing, deposit) get answered automatically.' },
    { icon: '🔔', title: 'Instant Alerts', desc: 'Get pinged the second a customer sounds ready to book. Strike while hot.' },
  ];

  const faqs = [
    { q: 'Do I have to change how I send quotes?', a: 'No. Just forward or BCC follow@yourbusiness.com on any quote email you already send. We handle the rest. If you prefer, you can also paste quotes directly into your Dashboard.' },
    { q: 'How does QuoteFollow know when I\'ve sent a quote?', a: 'You either BCC follow@yourbusiness.com when you email a quote, or paste the quote into your Dashboard. Our AI reads it, files it, and starts the follow-up sequence automatically.' },
    { q: 'What happens when a customer replies?', a: 'The automatic follow-ups stop immediately. Our AI reads their reply — if it\'s a common question (pricing, timing, deposit), it answers for you. If they sound ready to book, you get an instant hot-lead alert so you can strike while the iron\'s hot.' },
    { q: 'Will customers know it\'s automated?', a: 'No. Follow-ups are written to sound like they come from you — friendly, professional, and personal. You can customize the tone in your Dashboard settings, and you can review every message before it goes out.' },
    { q: 'Can I control what the AI says?', a: 'Yes. In your Dashboard you set your availability, deposit policy, pricing ranges, and anything else the AI should know. You can turn auto-replies off any time, pause follow-ups, and review every message in your quote history.' },
    { q: 'What if a customer asks something the AI can\'t answer?', a: 'The AI flags it as needing human attention and notifies you immediately. You handle it directly — no awkward silences or wrong information.' },
    { q: 'Is my data safe?', a: 'Your quotes live in your own private Dashboard. Only you can see them, and you can delete anything at any time. We never share your customer data.' },
    { q: 'How much does it cost?', a: '$29/month, cancel anytime. No contracts, no setup fees. Start with a free preview — no credit card required.' },
    { q: 'When will I see results?', a: 'Most businesses see their first closed job within 2–4 weeks. The AI learns your business quickly, and follow-ups start automatically from day one.' },
  ];

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Ambient background */}
      <div className="ambient" />

      {/* ===== Hero ===== */}
      <section className="hero">
        <div className="container">
          <span className="badge">⚡ For cleaners · movers · lawn care · handymen · tradies</span>
          <h1>
            You sent the quote.<br />
            Now stop chasing.
          </h1>
          <p className="sub">
            QuoteFollow automatically follows up on your quotes — at smart times,
            in your voice — so you never lose another job to silence.
          </p>
          <div>
            <PayPalSubscribeButton label="Get Started — $29/mo" />
            <a className="btn secondary" href="#demo">
              ▶ See it in action
            </a>
          </div>
          <div className="proof">
            <span>⭐ No contracts</span>
            <span>·</span>
            <span>Cancel anytime</span>
            <span>·</span>
            <span>Set up in 10 minutes</span>
          </div>
        </div>
      </section>

      {/* ===== Pain Stories ===== */}
      <section className="pain-section">
        <div className="container">
          <div className="section-label">Real stories</div>
          <h2>Sound familiar?</h2>
          <p className="section-sub">These are the stories we hear every day from tradespeople who lost jobs to poor follow-up.</p>
          <div className="pain-grid">
            {painStories.map((s, i) => (
              <div key={i} className="pain-card">
                <div className="emoji">{s.emoji}</div>
                <blockquote>&ldquo;{s.quote}&rdquo;</blockquote>
                <div className="meta">— {s.role}, {s.location}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Before / After ===== */}
      <section className="compare-section">
        <div className="container">
          <div className="section-label">See the difference</div>
          <h2>Same quote. Different outcome.</h2>
          <p className="section-sub">Watch what changes when QuoteFollow handles the follow-up.</p>
          <div className="compare-grid">
            <div className="compare-col bad">
              <div className="label">✕ Without QuoteFollow</div>
              {comparison.before.map((row, i) => (
                <div key={i} className="timeline-row">
                  <span className="day">{row.day}</span>
                  <span className="event">{row.event}</span>
                </div>
              ))}
            </div>
            <div className="compare-col good">
              <div className="label">✓ With QuoteFollow</div>
              {comparison.after.map((row, i) => (
                <div key={i} className="timeline-row">
                  <span className="day">{row.day}</span>
                  <span className="event">{row.event}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section className="steps-section" id="demo">
        <div className="container">
          <div className="section-label">How it works</div>
          <h2>Set it once. Forget about it. Win more jobs.</h2>
          <p className="section-sub">Three steps. Ten minutes. That's it.</p>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-num">1</div>
              <h3>Send your quote as normal</h3>
              <p>Use your existing process. Email, text, or hand-deliver your quotes. Or just paste it into your Dashboard.</p>
            </div>
            <div className="step-card">
              <div className="step-num">2</div>
              <h3>AI follows up at the right time</h3>
              <p>QuoteFollow reads your quote, files it, and sends a friendly follow-up at the smartest moment. Replies stop the sequence instantly.</p>
            </div>
            <div className="step-card">
              <div className="step-num">3</div>
              <h3>You only handle hot leads</h3>
              <p>Common questions get answered automatically. When a customer sounds ready to book, you get an instant alert — that's the quote worth your time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Features ===== */}
      <section className="features-section">
        <div className="container">
          <div className="section-label">Features</div>
          <h2>Everything you need</h2>
          <p className="section-sub">Built for tradespeople who want to close more jobs without chasing.</p>
          <div className="features-grid">
            {features.map((f, i) => (
              <div key={i} className="feature-card">
                <div className="icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Live Demo Preview ===== */}
      <DemoPreview />

      {/* ===== Why I built this ===== */}
      <section style={{ padding: '80px 0', borderTop: '1px solid var(--border)' }}>
        <div className="container" style={{ maxWidth: 680, textAlign: 'center' }}>
          <div className="section-label">The story</div>
          <h2 style={{ marginBottom: 24 }}>Why I built this</h2>
          <p style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--fg-dim)' }}>
            A friend who runs a cleaning company told me he'd sent out dozens of quotes that month —
            and only heard back from a handful. He was busy doing the actual jobs, so the quotes just sat there.
            When we added it up, the deals he never followed up on came to about <strong style={{ color: 'var(--fg)' }}>$23,000</strong>
            in lost work that quarter. Not because his prices were wrong — just because nobody followed up.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--fg-dim)', marginTop: 20 }}>
            QuoteFollow exists so that never happens to you. You send the quote exactly like you always do —
            and the follow-up happens automatically, even on your busiest week.
          </p>
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section className="pricing-section" id="pricing">
        <div className="container">
          <div className="section-label">Pricing</div>
          <h2>Simple pricing</h2>
          <p className="section-sub">One plan. Everything included. No surprises.</p>
          <div className="price-card-wrap">
            <span className="tag">Most Popular</span>
            <div className="amount">$29<small>/month</small></div>
            <ul>
              <li>Your own follow-up inbox</li>
              <li>AI quote filing &amp; dashboard</li>
              <li>Smart-timed follow-ups (day 1, 3, 7)</li>
              <li>AI answers to common questions</li>
              <li>Hot / warm / cold lead detection</li>
              <li>Win / loss analytics</li>
              <li>Slack notifications</li>
              <li>Cancel anytime, no contracts</li>
            </ul>
            <PayPalSubscribeButton label="Start monthly" />
            <p style={{ fontSize: 13, color: 'var(--fg-dim)', marginTop: 12 }}>No credit card required for preview</p>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="faq-section">
        <div className="container">
          <div className="section-label">FAQ</div>
          <h2>Common questions</h2>
          <p className="section-sub">Everything you need to know before getting started.</p>
          <div className="faq-list">
            {faqs.map((faq, i) => (
              <details key={i} className="faq-item">
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="cta-section">
        <div className="container">
          <h2>Don't lose another job<br />to silence</h2>
          <p>Join tradespeople who stopped chasing and started closing. Set up takes 10 minutes.</p>
          <PayPalSubscribeButton label="Get Started — $29/mo" />
          <p className="note">No credit card required · Cancel anytime · 10-minute setup</p>
        </div>
      </section>

      <footer>
        <div className="container">© {new Date().getFullYear()} QuoteFollow · Never lose a quote again</div>
      </footer>
    </div>
  );
}
