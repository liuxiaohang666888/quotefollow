import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';
    const range = searchParams.get('range') || 'month';

    let dateFilter = '';
    const now = new Date();
    if (range === 'week') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (range === 'month') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    } else if (range === 'quarter') {
      dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    } else if (range === 'year') {
      dateFilter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Fetch quotes
    let query = supabase
      .from('quotes')
      .select('*')
      .eq('account_id', user.id)
      .order('created_at', { ascending: false });

    if (dateFilter) {
      query = query.gte('created_at', dateFilter);
    }

    const { data: quotes, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch scope changes
    const { data: scopeChanges } = await supabase
      .from('scope_changes')
      .select('*, quotes!inner(account_id)')
      .eq('quotes.account_id', user.id);

    // Fetch followup logs
    const { data: followups } = await supabase
      .from('messages')
      .select('*')
      .eq('account_id', user.id)
      .order('created_at', { ascending: false });

    // Generate CSV
    if (format === 'csv') {
      // Quotes CSV
      const quotesHeaders = [
        'Quote ID',
        'Customer Name',
        'Customer Email',
        'Amount ($)',
        'Status',
        'Deposit Required',
        'Deposit Amount ($)',
        'Deposit Status',
        'Created At',
        'Sent At',
        'Paid At',
      ];

      const quotesRows = quotes?.map(q => [
        q.id,
        q.customer_name,
        q.customer_email,
        q.amount?.toString() || '0',
        q.status,
        q.require_deposit ? 'Yes' : 'No',
        q.deposit_amount?.toString() || '0',
        q.deposit_status || 'N/A',
        q.created_at,
        q.sent_at || '',
        q.paid_at || '',
      ]) || [];

      // Followups CSV
      const followupHeaders = [
        'Message ID',
        'Quote ID',
        'Type',
        'Subject',
        'Sent At',
        'Status',
      ];

      const followupRows = followups?.map(m => [
        m.id,
        m.quote_id,
        m.type,
        m.subject || '',
        m.sent_at || m.created_at,
        m.status,
      ]) || [];

      // Scope changes CSV
      const scopeHeaders = [
        'Change ID',
        'Quote ID',
        'Description',
        'Amount ($)',
        'Created At',
      ];

      const scopeRows = scopeChanges?.map(s => [
        s.id,
        s.quote_id,
        s.description,
        s.amount.toString(),
        s.created_at,
      ]) || [];

      const csv = [
        '=== QUOTES ===',
        quotesHeaders.join(','),
        ...quotesRows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
        '',
        '=== FOLLOW-UPS ===',
        followupHeaders.join(','),
        ...followupRows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
        '',
        '=== SCOPE CHANGES ===',
        scopeHeaders.join(','),
        ...scopeRows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const filename = `quotefollow-export-${range}-${now.toISOString().split('T')[0]}.csv`;

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // JSON fallback
    return NextResponse.json({
      quotes: quotes || [],
      scopeChanges: scopeChanges || [],
      followups: followups || [],
      exportedAt: now.toISOString(),
      range,
    });

  } catch (e) {
    console.error('Export error:', e);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}