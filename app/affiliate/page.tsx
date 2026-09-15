'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AffiliatePage() {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    website: '',
    traffic: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.email || !formData.website) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      const res = await fetch('/api/affiliate/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Network error. Please try again.');
    }
  };

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', padding: '60px 24px', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px' }}>
          <Link href="/" style={{ color: '#2563eb', fontWeight: 600, marginBottom: 32, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            ← Back to QuoteFollow
          </Link>

          <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', padding: 48, background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 16, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 28, marginBottom: 16 }}>Application submitted!</h2>
            <p style={{ color: 'var(--fg-dim)', fontSize: 18, lineHeight: 1.6, marginBottom: 24 }}>
              Thanks for applying. We&apos;ll review your application within 2-3 business days and get back to you via email.
            </p>
            <Link href="/" className="btn" style={{ display: 'inline-flex', justifyContent: 'center' }}>
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '60px 24px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px' }}>
        <Link href="/" style={{ color: '#2563eb', fontWeight: 600, marginBottom: 32, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          ← Back to QuoteFollow
        </Link>

        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <p className="eyebrow">Become a Partner</p>
          <h1 style={{ fontSize: 42, lineHeight: 1.2, marginBottom: 16 }}>Earn 20% recurring commission</h1>
          <p style={{ color: 'var(--fg-dim)', fontSize: 18, maxWidth: 600, margin: '0 auto' }}>
            Recommend QuoteFollow to your audience. Earn 20% recurring commission for every paying customer you refer — for the lifetime of their subscription.
          </p>
        </div>

        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 16, padding: 40, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', marginBottom: 32, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
            <h2 style={{ fontSize: 24, marginBottom: 8 }}>Join the QuoteFollow Affiliate Program</h2>
            <p style={{ color: 'var(--fg-dim)', marginBottom: 32 }}>
              We&apos;re looking for creators, agencies, consultants, and educators who help freelancers and small businesses get paid. If that sounds like you, we&apos;d love to have you.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 32 }}>
              <div style={{ textAlign: 'center', padding: '24px 16px', background: 'rgba(34,197,94,0.1)', borderRadius: 12, border: '1px solid #22c55e' }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>20%</div>
                <div style={{ color: 'var(--fg-dim)', fontSize: 14 }}>Recurring commission</div>
              </div>
              <div style={{ textAlign: 'center', padding: '24px 16px', background: 'rgba(245,158,11,0.1)', borderRadius: 12, border: '1px solid #f59e0b' }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>Lifetime</div>
                <div style={{ color: 'var(--fg-dim)', fontSize: 14 }}>Commission duration</div>
              </div>
              <div style={{ textAlign: 'center', padding: '24px 16px', background: 'rgba(37,99,235,0.1)', borderRadius: 12, border: '1px solid #2563eb' }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#2563eb', marginBottom: 8 }}>30 days</div>
                <div style={{ color: 'var(--fg-dim)', fontSize: 14 }}>Cookie window</div>
              </div>
            </div>

            <h3 style={{ fontSize: 18, marginBottom: 16 }}>Who we&apos;re looking for</h3>
            <ul style={{ color: 'var(--fg-dim)', lineHeight: 2, marginBottom: 32 }}>
              <li>Creators & educators teaching freelancing/small business</li>
              <li>Agencies & consultants serving freelancers/SMBs</li>
              <li>Newsletter writers in business/freelance niche</li>
              <li>Course creators teaching client management</li>
              <li>Communities for freelancers/agencies</li>
            </ul>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--fg)' }}>Full name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="John Doe"
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 16, background: 'var(--bg-glass)', color: 'var(--fg)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--fg)' }}>Company / Brand name *</label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  required
                  placeholder="Acme Agency / John Doe Consulting"
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 16, background: 'var(--bg-glass)', color: 'var(--fg)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--fg)' }}>Email address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="john@example.com"
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 16, background: 'var(--bg-glass)', color: 'var(--fg)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--fg)' }}>Website / Social profile *</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  required
                  placeholder="https://yourwebsite.com or https://twitter.com/yourhandle"
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 16, background: 'var(--bg-glass)', color: 'var(--fg)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--fg)' }}>Monthly traffic / audience size *</label>
                <select
                  name="traffic"
                  value={formData.traffic}
                  onChange={handleChange}
                  required
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 16, background: 'var(--bg-glass)', color: 'var(--fg)' }}
                >
                  <option value="">Select...</option>
                  <option value="1k-10k">1,000 - 10,000</option>
                  <option value="10k-50k">10,000 - 50,000</option>
                  <option value="50k-100k">50,000 - 100,000</option>
                  <option value="100k-500k">100,000 - 500,000</option>
                  <option value="500k+">500,000+</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--fg)' }}>How will you promote QuoteFollow?</label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={4}
                  placeholder="e.g., I'll write a newsletter review, create a YouTube tutorial, share in my Slack community..."
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 16, fontFamily: 'inherit', lineHeight: 1.6, background: 'var(--bg-glass)', color: 'var(--fg)' }}
                />
              </div>

              {error && <p style={{ color: '#ef4444', marginBottom: 16, fontSize: 14 }}>{error}</p>}

              <button type="submit" className="btn" style={{ width: '100%', padding: 16, fontSize: 16 }}>
                Apply to become an affiliate
              </button>
            </form>

            <p style={{ textAlign: 'center', color: 'var(--fg-dim)', fontSize: 14, marginTop: 24 }}>
              By submitting, you agree to our <a href="/terms" style={{ color: '#2563eb' }}>Terms of Service</a> and <a href="/privacy" style={{ color: '#2563eb' }}>Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}