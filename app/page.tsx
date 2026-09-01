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
      { day: 'Wed', event: 'Auto follow-up sent: "Hey Sarah, any questions about the quote?"' },
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
    <div>
      {/* ===== Hero ===== */}
      <section className="hero">
        <div className="container">
          <span className="badge">For cleaners · movers · lawn care · handymen · tradies</span>
          <h1>
            You sent the quote.{' '}
            <span className="underline">Now stop chasing.</span>
          </h1>
          <p className="sub">
            QuoteFollow automatically follows up on your quotes — via email at smart times
            — so you never lose another job to silence. AI handles the chasing. You close the deal.
          </p>
          <PayPalSubscribeButton label="Get Started — $29/mo" />
          <a className="btn secondary" href="#demo">
            ▶ See it in action (free preview)
          </a>
          <a className="btn ghost" href="#pricing">
            See pricing
          </a>
          <div className="proof">
            ⭐ No contracts · Cancel anytime · Set up in 10 minutes
          </div>
        </div>
      </section>

      {/* ===== Pain Stories ===== */}
      <section style={{ padding: '72px 0', background: '#fafafa', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: 28, marginBottom: 8 }}>Sound familiar?</h2>
          <p style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: 40, fontSize: 15 }}>
            These are the stories we hear every day from tradespeople who lost jobs to poor follow-up.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {painStories.map((s, i) => (
              <div key={i} className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{s.emoji}</div>
                <p style={{ fontSize: 15, lineHeight: 1.6, fontStyle: 'italic', margin: '0 0 12px' }}>
                  &ldquo;{s.quote}&rdquo;
                </p>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  — {s.role}, {s.location}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Before / After Comparison ===== */}
      <section style={{ padding: '72px 0', background: '#fff', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: 28, marginBottom: 8 }}>Same quote. Different outcome.</h2>
          <p style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: 40, fontSize: 15 }}>
            See what changes when QuoteFollow handles the follow-up.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {/* Without */}
            <div style={{ border: '1px solid #fecaca', borderRadius: 12, padding: 24, background: '#fff5f5' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
                Without QuoteFollow
              </div>
              {comparison.before.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', minWidth: 36, paddingTop: 2 }}>{row.day}</span>
                  <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.5 }}>{row.event}</span>
                </div>
              ))}
            </div>
            {/* With */}
            <div style={{ border: '1px solid #86efac', borderRadius: 12, padding: 24, background: '#f0fdf4' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#16a34a', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
                With QuoteFollow
              </div>
              {comparison.after.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', minWidth: 36, paddingTop: 2 }}>{row.day}</span>
                  <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.5 }}>{row.event}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section className="steps" id="demo">
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: 28, marginBottom: 8 }}>How it works</h2>
          <p style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: 40, fontSize: 15 }}>
            Set it once. Forget about it. Win more jobs.
          </p>
          <div className="grid">
            <div className="step">
              <div className="step-num">1</div>
              <h3>Send your quote as normal</h3>
              <p>
                Use your existing process. Email, text, or hand-deliver your quotes like you always do.
                Or just paste it into your Dashboard — whatever works.
              </p>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <h3>AI follows up at the right time</h3>
              <p>
                QuoteFollow reads your quote, files it, and sends a friendly follow-up at the
                smartest moment — not too early, not too late. Replies stop the sequence instantly.
              </p>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <h3>You only handle hot leads</h3>
              <p>
                Common questions get answered automatically. When a customer sounds ready to book,
                you get an instant alert — that&apos;s the quote worth your time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Features Grid ===== */}
      <section style={{ padding: '72px 0', background: '#fafafa', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: 28, marginBottom: 8 }}>Everything you need</h2>
          <p style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: 48, fontSize: 15 }}>
            Built for tradespeople who want to close more jobs without chasing.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {features.map((f, i) => (
              <div key={i} className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontSize: 16, margin: '0 0 8px' }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Live Demo Preview ===== */}
      <DemoPreview />

      {/* ===== Why I built this ===== */}
      <section style={{ padding: '72px 0', background: '#fff', borderBottom: '1px solid var(--border)' }}>
        <div className="container" style={{ maxWidth: 720 }}>
          <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 24 }}>Why I built this</h2>
          <p style={{ fontSize: 17, lineHeight: 1.7 }}>
            A few years back, a friend who runs a cleaning company told me he&apos;d
            sent out dozens of quotes that month — and only heard back from a
            handful. He was busy doing the actual jobs, so the quotes just sat
            there. When we added it up, the deals he never followed up on came to
            about <strong>$23,000</strong> in lost work that quarter. Not because
            his prices were wrong — just because nobody followed up.
          </p>
          <p style={{ fontSize: 17, lineHeight: 1.7, marginTop: 16 }}>
            QuoteFollow exists so that never happens to you. You send the quote
            exactly like you always do — and the follow-up happens automatically,
            even on your busiest week.
          </p>
        </div>
      </section>

      {/* ===== What happens after you subscribe ===== */}
      <section style={{ padding: '64px 0', background: '#eff6ff', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container" style={{ maxWidth: 760, textAlign: 'center' }}>
          <h2 style={{ fontSize: 26, marginBottom: 8 }}>What happens after you subscribe</h2>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 32 }}>Three quick steps. About 2 minutes total.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, textAlign: 'left' }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="step-num">1</div>
              <h3 style={{ fontSize: 16, margin: '10px 0 6px' }}>PayPal checkout</h3>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>Click subscribe, pay $29/month on PayPal. Cancel any time.</p>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div className="step-num">2</div>
              <h3 style={{ fontSize: 16, margin: '10px 0 6px' }}>Create your account</h3>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>We redirect you to a quick sign-up — just email + password (30 seconds).</p>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div className="step-num">3</div>
              <h3 style={{ fontSize: 16, margin: '10px 0 6px' }}>Dashboard ready</h3>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>Connect your follow-up inbox, teach the AI about your business — done.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section className="pricing" id="pricing">
        <div className="container">
          <h2>Simple pricing</h2>
          <div className="price-cards" style={{ gridTemplateColumns: 'minmax(0, 420px)', justifyContent: 'center' }}>
            <div className="price-card">
              <div className="amount">
                $29<small>/month</small>
              </div>
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
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="faq" style={{ padding: '72px 0', background: '#fafafa' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Common questions</h2>
          <p style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: 40, fontSize: 15 }}>Everything you need to know before getting started.</p>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {faqs.map((faq, i) => (
              <details key={i} className="faq-item">
                <summary>{faq.q}</summary>
                <p style={{ lineHeight: 1.7, fontSize: 15 }}>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section style={{ padding: '72px 0', background: '#1e3a5f', color: '#fff', textAlign: 'center' }}>
        <div className="container">
          <h2 style={{ fontSize: 28, marginBottom: 12 }}>Don&apos;t lose another job to silence</h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 32, maxWidth: 500, marginInline: 'auto' }}>
            Join tradespeople who stopped chasing and started closing. Set up takes 10 minutes.
          </p>
          <PayPalSubscribeButton label="Get Started — $29/mo" />
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 16 }}>
            No credit card required for preview · Cancel anytime
          </p>
        </div>
      </section>

      <footer style={{ background: '#0f172a', color: 'rgba(255,255,255,0.5)', padding: '24px 0' }}>
        <div className="container" style={{ fontSize: 13, textAlign: 'center' }}>
          © {new Date().getFullYear()} QuoteFollow · Never lose a quote again
        </div>
      </footer>
    </div>
  );
}
