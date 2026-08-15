const PAYPAL_URL = process.env.NEXT_PUBLIC_PAYPAL_INVOICE_URL || '#';

export default function LandingPage() {
  return (
    <div>
      {/* ===== Hero ===== */}
      <section className="hero">
        <div className="container">
          <span className="badge">For cleaners · movers · lawn care · handymen</span>
          <h1>
            You sent the quote.{' '}
            <span className="underline">Now stop chasing.</span>
          </h1>
          <p className="sub">
            Forward every quote you send to your own follow-up inbox. QuoteFollow
            follows up for you on day 1, 3, and 7 — answers common questions
            automatically — and pings you the second a customer sounds ready to book.
          </p>
          <a className="btn" href={PAYPAL_URL}>
            Get Started — $29/mo
          </a>
          <a className="btn secondary" href="#pricing">
            See pricing
          </a>
          <div className="proof">
            ⭐ No contracts · Cancel anytime · Set up in 10 minutes
          </div>
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section className="steps">
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: 28 }}>How it works</h2>
          <div className="grid">
            <div className="step">
              <div className="step-num">1</div>
              <h3>Forward your quote</h3>
              <p>
                You get your own inbox — <strong>follow@yourbusiness.com</strong>.
                Send or BCC every quote there. Nothing else changes about how you work.
              </p>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <h3>We follow up for you</h3>
              <p>
                AI reads each quote, files it, and sends a friendly follow-up on
                day 1, day 3, and day 7. Replies from the customer stop the sequence instantly.
              </p>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <h3>You only handle hot ones</h3>
              <p>
                Common questions get answered automatically. When a customer sounds
                ready to book, you get an instant alert — that&apos;s the quote worth your time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section className="pricing" id="pricing">
        <div className="container">
          <h2>Simple pricing</h2>
          <div className="price-cards">
            <div className="price-card">
              <div className="amount">
                $29<small>/month</small>
              </div>
              <ul>
                <li>Your own follow-up inbox</li>
                <li>AI quote filing &amp; dashboard</li>
                <li>Follow-ups on day 1, 3, and 7</li>
                <li>AI answers to common questions</li>
                <li>Hot-lead alerts</li>
                <li>Slack notifications</li>
              </ul>
              <a className="btn" href={PAYPAL_URL}>Start monthly</a>
            </div>
            <div className="price-card featured">
              <span className="tag">Best value</span>
              <div className="amount">
                $199<small>/year</small>
              </div>
              <ul>
                <li>Everything in Monthly</li>
                <li>43% off — less than $17/mo</li>
                <li>Custom follow-up template built for your business</li>
                <li>Priority onboarding call</li>
                <li>Founding member pricing, locked in forever</li>
              </ul>
              <a className="btn" href={PAYPAL_URL}>Start yearly</a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="faq">
        <div className="container">
          <h2>Frequently asked questions</h2>
          <details className="faq-item">
            <summary>Do I have to change how I send quotes?</summary>
            <p>
              No. Just send or BCC <code>follow@yourbusiness.com</code> on any quote
              email you already send. We handle the rest.
            </p>
          </details>
          <details className="faq-item">
            <summary>What happens when a customer replies?</summary>
            <p>
              The automatic follow-ups stop immediately. Common questions (pricing,
              timing, deposit) are answered for you. If the customer sounds ready to
              book, you get an instant hot-lead alert.
            </p>
          </details>
          <details className="faq-item">
            <summary>Can I control what the AI says?</summary>
            <p>
              Yes. In your dashboard you tell us your availability, deposit policy,
              and anything else the AI should know. You can turn auto-replies off
              any time and review every message we send.
            </p>
          </details>
          <details className="faq-item">
            <summary>Is my data safe?</summary>
            <p>
              Your quotes live in your own private dashboard. Only you can see them,
              and you can delete anything at any time.
            </p>
          </details>
        </div>
      </section>

      <footer>
        <div className="container">© {new Date().getFullYear()} QuoteFollow · Never lose a quote again</div>
      </footer>
    </div>
  );
}
