'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Account {
  business_name: string;
  followup_email: string;
  slack_webhook: string;
  auto_reply_enabled: boolean;
  business_info: Record<string, string>;
}

const DEFAULT_INFO: Record<string, string> = {
  availability: '',
  deposit_policy: '',
  turnaround_time: '',
  what_is_included: '',
  extra_notes: '',
};

export default function SettingsPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [info, setInfo] = useState<Record<string, string>>(DEFAULT_INFO);

  async function load() {
    const res = await fetch('/api/account');
    const json = await res.json();
    if (json.ok && json.account) {
      setAccount(json.account);
      setInfo({ ...DEFAULT_INFO, ...(json.account.business_info || {}) });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    setSaving(true);
    setSaved(false);
    const res = await fetch('/api/account', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_name: account.business_name,
        followup_email: account.followup_email,
        slack_webhook: account.slack_webhook,
        auto_reply_enabled: account.auto_reply_enabled,
        business_info: info,
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setAccount(json.account);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  }

  if (loading) return <p style={{ color: '#6b7280' }}>Loading…</p>;

  return (
    <div>
      <h1>Settings</h1>
      <p className="page-sub">Connect your inbox and teach the AI about your business.</p>

      {/* 接入说明 */}
      <div className="card">
        <h3>1 · Connect your follow-up inbox</h3>
        <div className="setup-steps">
          <div className="setup-step">
            <div className="num"></div>
            <p>
              Decide your follow-up email — e.g. <code>follow@yourdomain.com</code>.
              You need to own the domain (any registrar works). If you don&apos;t have
              one yet, grab a cheap one (~$10/yr) before deploying.
            </p>
          </div>
          <div className="setup-step">
            <div className="num"></div>
            <p>
              Type the address below, then set up email routing (Cloudflare Email
              Routing or Resend Inbound) so mail sent to it hits our webhook. Full
              step-by-step in the README included in your project.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={save}>
        <div className="card">
          <h3>2 · Your business</h3>
          <div className="field">
            <label>Business name</label>
            <input
              type="text"
              value={account?.business_name || ''}
              onChange={(e) => setAccount((a) => (a ? { ...a, business_name: e.target.value } : a))}
              placeholder="e.g. Sparkle Clean Co."
            />
          </div>
          <div className="field" style={{ opacity: 0.6 }}>
            <label>Follow-up inbox</label>
            <input type="text" value="follow@voxalo.top" disabled />
            <div className="hint">BCC every quote you send to follow@voxalo.top — it is pre-configured.</div>
          </div>
          <div className="field">
            <label>Slack webhook (optional)</label>
            <input
              type="text"
              value={account?.slack_webhook || ''}
              onChange={(e) => setAccount((a) => (a ? { ...a, slack_webhook: e.target.value } : a))}
              placeholder="https://hooks.slack.com/services/…"
            />
            <div className="hint">Hot-lead alerts will also be posted here.</div>
          </div>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={account?.auto_reply_enabled ?? true}
                onChange={(e) =>
                  setAccount((a) => (a ? { ...a, auto_reply_enabled: e.target.checked } : a))
                }
                style={{ width: 'auto', marginRight: 8 }}
              />
              Let the AI auto-reply to common customer questions
            </label>
          </div>
        </div>

        <div className="card">
          <h3>3 · What the AI should know</h3>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            Fill these in and the AI can answer real questions from your customers.
            Leave blank = AI will only check in, never make up facts.
          </p>
          <div className="field">
            <label>Availability / schedule</label>
            <input
              type="text"
              value={info.availability}
              onChange={(e) => setInfo((i) => ({ ...i, availability: e.target.value }))}
              placeholder="e.g. We book 1–2 weeks out, weekdays 9am–5pm"
            />
          </div>
          <div className="field">
            <label>Deposit policy</label>
            <input
              type="text"
              value={info.deposit_policy}
              onChange={(e) => setInfo((i) => ({ ...i, deposit_policy: e.target.value }))}
              placeholder="e.g. 25% deposit to lock your date, refundable up to 48h before"
            />
          </div>
          <div className="field">
            <label>Turnaround / how long it takes</label>
            <input
              type="text"
              value={info.turnaround_time}
              onChange={(e) => setInfo((i) => ({ ...i, turnaround_time: e.target.value }))}
              placeholder="e.g. Most jobs done in one visit, 2–4 hours"
            />
          </div>
          <div className="field">
            <label>What&apos;s included in the quote</label>
            <textarea
              value={info.what_is_included}
              onChange={(e) => setInfo((i) => ({ ...i, what_is_included: e.target.value }))}
              placeholder="e.g. Deep clean of 3 bedrooms + 2 baths, supplies included"
            />
          </div>
          <div className="field">
            <label>Extra notes</label>
            <textarea
              value={info.extra_notes}
              onChange={(e) => setInfo((i) => ({ ...i, extra_notes: e.target.value }))}
              placeholder="Anything else the AI should know — policies, guarantees, specials…"
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          {saved && <span style={{ color: '#059669', fontSize: 14, fontWeight: 600 }}>✓ Saved</span>}
        </div>
      </form>
    </div>
  );
}
