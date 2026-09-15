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
    const type = searchParams.get('type') || 'quotes';

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (range) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Fetch quotes
    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select(`
        *,
        scope_changes (
          id,
          description,
          amount,
          created_at
        )
      `)
      .eq('account_id', user.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (quotesError) throw quotesError;

    // Fetch messages for follow-up stats
    const { data: messages } = await supabase
      .from('messages')
      .select('id, quote_id, direction, created_at, is_ai_generated')
      .in('quote_id', quotes?.map(q => q.id) || [])
      .eq('direction', 'outbound');

    // Build CSV
    const headers = [
      'Quote ID',
      'Customer Name',
      'Customer Email',
      'Service Type',
      'Original Amount',
      'Deposit Required',
      'Deposit Amount',
      'Deposit Status',
      'Scope Changes Count',
      'Scope Changes Total',
      'Total Amount (with changes)',
      'Status',
      'Quote Date',
      'Follow-ups Sent',
      'Last Follow-up',
      'Created At'
    ];

    const rows = quotes?.map(quote => {
      const scopeChanges = quote.scope_changes || [];
      const scopeChangesTotal = scopeChanges.reduce((sum: number, sc: any) => sum + (sc.amount || 0), 0);
      const totalAmount = (quote.amount || 0) + scopeChangesTotal;
      const quoteMessages = messages?.filter(m => m.quote_id === quote.id) || [];
      const lastFollowup = quoteMessages.length > 0 
        ? new Date(Math.max(...quoteMessages.map(m => new Date(m.created_at).getTime()))).toISOString()
        : '';

      return [
        quote.id,
        quote.customer_name,
        quote.customer_email,
        quote.service_type || '',
        quote.amount || 0,
        quote.require_deposit ? 'Yes' : 'No',
        quote.deposit_amount || 0,
        quote.deposit_status || 'unpaid',
        scopeChanges.length,
        scopeChangesTotal,
        totalAmount,
        quote.status,
        quote.quote_date || '',
        quoteMessages.length,
        lastFollowup,
        quote.created_at
      ];
    }) || [];

    if (format === 'csv') {
      const csvContent = [headers.join(','), ...rows.map(row => 
        row.map(cell => {
          const str = String(cell ?? '');
          return str.includes(',') || str.includes('"') || str.includes('\n') 
            ? '"' + str.replace(/"/g, '""') + '"' 
            : str;
        }).join(',')
      )].join('\n');

      const filename = `quotefollow-${type}-${range}-${now.toISOString().split('T')[0]}.csv`;
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // JSON format
    return NextResponse.json({
      data: rows.map((row, i) => {
        const obj: Record<string, any> = {};
        headers.forEach((h, idx) => { obj[h] = row[idx]; });
        return obj;
      }),
      meta: {
        total: rows.length,
        range,
        generatedAt: now.toISOString(),
      },
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}