import Link from 'next/link';
import { getBrandName } from '@/lib/vertical';

export const metadata = { title: 'Privacy Policy' };

// 复用 auth 页面布局样式，窄卡片排版适合长文阅读
export default function PrivacyPage() {
  const brand = getBrandName();
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Privacy Policy</h1>
        <p className="sub">Last updated: September 2026</p>

        <h3>What we collect</h3>
        <p>
          When you create a {brand} account we store your email address, business name, and the
          settings you configure. When you forward or paste a quote email, we process its content
          (customer email, name, quoted amount, service details) to build your quote dashboard.
        </p>

        <h3>How we use it</h3>
        <p>
          Your data is used only to run the service: parsing quotes, sending scheduled follow-up
          emails, and replying to customer questions on your behalf when auto-reply is enabled. We
          do not sell your data or use it for advertising.
        </p>

        <h3>Third-party processors</h3>
        <p>
          {brand} relies on: Supabase (database &amp; authentication, EU/US hosted), Resend (email
          delivery), PayPal (subscription payments), and an AI provider (quote parsing &amp; email
          drafting). Each processes data only as needed to provide the service.
        </p>

        <h3>Data retention &amp; deletion</h3>
        <p>
          Quotes, messages, and account details belong to you. Deleting a quote removes it and its
          message history permanently. Closing your account removes all associated data. Contact
          support at any time to request a full export or deletion.
        </p>

        <h3>Email handling</h3>
        <p>
          Follow-up emails are sent from a shared follow-up inbox. Customer replies are matched to
          your quotes by thread headers and sender address. We never email your customers outside
          of the follow-up flow you configure.
        </p>

        <p className="alt-link" style={{ marginTop: '24px' }}>
          <Link href="/">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
