'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { sendEmail } from '@/lib/resend';

interface Quote {
  id: string;
  customer_name: string;
  customer_email: string;
  service_type: string;
  amount: number | null;
  status: string;
  require_deposit: boolean;
  deposit_amount: number | null;
  deposit_status: string;
  business_name?: string;
  created_at: string;
}

interface ScopeChange {
  id: string;
  description: string;
  additional_amount: number;
  status: string;
  created_at: string;
  sent_at: string | null;
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [scopeChanges, setScopeChanges] = useState<ScopeChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const supabase = createClient();
    const [qRes, sRes] = await Promise.all([
      supabase.from('quotes').select('*').eq('id', id).single(),
      supabase.from('scope_changes').select('*').eq('quote_id', id).order('created_at', { ascending: false }),
    ]);
    setQuote(qRes.data as Quote);
    setScopeChanges((sRes.data as ScopeChange[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const originalAmount = quote?.amount || 0;
  const totalChanges = scopeChanges.reduce((sum, s) => sum + (s.additional_amount || 0), 0);
  const totalPrice = originalAmount + totalChanges;

  async function handleAddScopeChange(e: React.FormEvent) {
    e.preventDefault();
    if (!newDesc.trim() || !newAmount) return;

    const supabase = createClient();
    const { error: insertErr } = await supabase
      .from('scope_changes')
      .insert({
        quote_id: id,
        description: newDesc.trim(),
        additional_amount: parseFloat(newAmount),
        status: 'pending',
      });

    if (insertErr) {
      setError('Failed to add scope change');
      return;
    }

    // Generate draft email
    const subject = `Quote Update: ${newDesc} — Additional $${parseFloat(newAmount)}`;
    const body = `Hi ${quote?.customer_name || 'there'},\n\nYou asked to add "${newDesc}". That comes to an additional $${parseFloat(newAmount)}.\n\nOriginal: $${originalAmount}\nChanges: +$${totalChanges}\nTotal now: $${totalPrice}\n\nLet me know if you have any questions.\n\nBest,\n${quote?.business_name || 'QuoteFollow'}`;

    setDraftSubject(subject);
    setDraftBody(body);
    setNewDesc('');
    setNewAmount('');
    await load();
  }

  async function handleSendDraft() {
    setSending(true);
    setError('');
    setSendSuccess(false);

    try {
      const result = await sendEmail({
        to: quote?.customer_email || '',
        subject: draftSubject,
        text: draftBody,
      });

      // Mark as sent
      const supabase = createClient();
      await supabase
        .from('scope_changes')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', scopeChanges[0]?.id);

      setSendSuccess(true);
      await load();
    } catch (err) {
      setError('Failed to send email. Please try again.');
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  async function handleMarkDepositPaid() {
    if (!quote) return;
    const supabase = createClient();
    await supabase
      .from('quotes')
      .update({ deposit_status: 'paid', deposit_paid_at: new Date().toISOString() })
      .eq('id', id);
    await load();

    // Send confirmation email
    const subject = `Deposit Received — Your booking is locked in!`;
    const body = `Hi ${quote.customer_name},\n\nGreat news! We've received your deposit of $${quote.deposit_amount}. Your booking is officially on the schedule.\n\nLooking forward to working with you!\n\nBest,\n${quote.business_name || 'QuoteFollow'}`;

    try {
      await sendEmail({ to: quote.customer_email, subject, text: body });
    } catch (e) {
      console.error('Failed to send deposit confirmation:', e);
    }
  }

  if (loading) return <p style={{ color: '#6b7280' }}>Loading…</p>;
  if (!quote) return <p>Quote not found. <a href="/dashboard" style={{ color: '#2563eb' }}>Back</a></p>;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 0' }}>
      <a href="/dashboard" style={{ color: '#2563eb', fontSize: 14 }}>← Back to quotes</a>
      <h1 style={{ marginTop: 12 }}>{quote.customer_name || quote.customer_email}</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>{quote.service_type}</p>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#f87171' }}>{error}</div>}
      {sendSuccess && <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#34d399' }}>✓ Email sent successfully!</div>}

      {/* Amount Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Original</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>${originalAmount}</div>
        </div>
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Changes</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fbbf24' }}>+${totalChanges}</div>
        </div>
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Total</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f87171' }}>${totalPrice}</div>
        </div>
      </div>

      {/* Scope Changes */}
      <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Scope Changes</h3>

        {scopeChanges.length === 0 && <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>No changes yet.</p>}

        {scopeChanges.map((sc) => (
          <div key={sc.id} style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14 }}>{sc.description}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#fbbf24' }}>+${sc.additional_amount}</span>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {sc.status} · {new Date(sc.created_at).toLocaleDateString()}
              {sc.sent_at && ' · Sent'}
            </div>
          </div>
        ))}

        {/* Add Scope Change Form */}
        <form onSubmit={handleAddScopeChange} style={{ marginTop: 16, padding: '16px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8 }}>
          <button type="button" onClick={() => document.getElementById('scope-form')?.classList.toggle('hidden')} style={{ background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            + Add scope change
          </button>
          <div id="scope-form" className="hidden" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              placeholder="What changed? (e.g., Added extra room)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-glass)', color: 'var(--fg)', fontSize: 14 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                placeholder="Additional amount ($)"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                min={0}
                step={0.01}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-glass)', color: 'var(--fg)', fontSize: 14 }}
              />
              <button type="submit" className="btn" style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}>Save</button>
            </div>
          </div>
        </form>

        {/* Draft Email */}
        {draftSubject && (
          <div style={{ marginTop: 16, padding: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>Draft email to customer</h4>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}><strong>Subject:</strong> {draftSubject}</p>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--fg)', fontFamily: 'inherit', margin: '12px 0', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>{draftBody}</pre>
            <button className="btn" onClick={handleSendDraft} disabled={sending} style={{ width: '100%' }}>
              {sending ? 'Sending...' : 'Send to customer'}
            </button>
          </div>
        )}
      </div>

      {/* Deposit Section */}
      {quote.require_deposit && (
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Deposit</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14 }}>Amount: ${quote.deposit_amount}</span>
            <span className={`badge-status ${quote.deposit_status === 'paid' ? 'won' : 'following'}`}>
              {quote.deposit_status === 'paid' ? 'Paid' : 'Unpaid'}
            </span>
          </div>
          {quote.deposit_status !== 'paid' && (
            <button className="btn" onClick={handleMarkDepositPaid} style={{ padding: '10px 20px' }}>
              Mark deposit as paid
            </button>
          )}
        </div>
      )}
    </div>
  );
}
