import Link from 'next/link';
import { getBrandName, getVerticalConfig } from '@/lib/vertical';

export const metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  const brand = getBrandName();
  const config = getVerticalConfig();
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Terms of Service</h1>
        <p className="sub">Last updated: September 2026</p>

        <h3>1. The service</h3>
        <p>
          {brand} helps small businesses track quotes and send automated follow-up emails. The free
          plan includes up to 10 quotes. The Professional plan ({config.pricing.monthly}
          {config.pricing.currency} per month) unlocks unlimited quotes.
        </p>

        <h3>2. Accounts</h3>
        <p>
          You are responsible for keeping your login credentials secure and for the accuracy of the
          email addresses you configure. One account per business. You must have permission to
          contact the customers and email addresses you enter into the service.
        </p>

        <h3>3. Billing &amp; cancellation</h3>
        <p>
          Subscriptions are billed monthly through PayPal and renew automatically until cancelled.
          You can cancel anytime from your PayPal account — access continues until the end of the
          paid period. Contact support if you believe a charge is incorrect.
        </p>

        <h3>4. Acceptable use</h3>
        <p>
          Do not use {brand} to send spam, unlawful content, or messages to people who have not
          requested a quote from you. We may suspend accounts that abuse the service or cause
          email deliverability damage.
        </p>

        <h3>5. Availability &amp; liability</h3>
        <p>
          We aim for high availability but do not guarantee uninterrupted service. {brand} is not
          liable for lost business, missed opportunities, or indirect damages arising from use of
          the service. Email delivery ultimately depends on third-party providers and recipient
          mail servers.
        </p>

        <h3>6. Changes</h3>
        <p>
          We may update these terms as the service evolves. Material changes will be announced on
          this page. Continued use after changes means you accept the updated terms.
        </p>

        <p className="alt-link" style={{ marginTop: '24px' }}>
          <Link href="/">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
