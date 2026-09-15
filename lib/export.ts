'use server';

import { createClient } from '@/lib/supabase/server';

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export async function exportQuotesCSV(accountId: string, range: 'week' | 'month' | 'year' | 'all' = 'month') {
  const supabase = await createClient();
  
  const now = new Date();
  let startDate: Date;
  
  switch (range) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(0);
  }

  const { data: quotes, error } = await supabase
    .from('quotes')
    .select(`
      id,
      customer_name,
      customer_email,
      service_type,
      amount,
      status,
      require_deposit,
      deposit_amount,
      deposit_status,
      created_at,
      sent_at,
      paid_at
    `)
    .eq('account_id', accountId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;

  const headers = [
    'Quote ID',
    'Customer Name',
    'Customer Email',
    'Service Type',
    'Amount ($)',
    'Status',
    'Deposit Required',
    'Deposit Amount ($)',
    'Deposit Status',
    'Created At',
    'Sent At',
    'Paid At'
  ];

  const rows = quotes.map(q => [
    q.id,
    q.customer_name,
    q.customer_email,
    q.service_type || '',
    q.amount?.toString() || '0',
    q.status,
    q.require_deposit ? 'Yes' : 'No',
    q.deposit_amount?.toString() || '0',
    q.deposit_status || 'N/A',
    formatDate(new Date(q.created_at)),
    q.sent_at ? formatDate(new Date(q.sent_at)) : '',
    q.paid_at ? formatDate(new Date(q.paid_at)) : ''
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
  
  return csv;
}

export async function exportFollowupsCSV(accountId: string, range: 'week' | 'month' | 'year' | 'all' = 'month') {
  const supabase = await createClient();
  
  const now = new Date();
  let startDate: Date;
  
  switch (range) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(0);
  }

  const { data: quotes, error } = await supabase
    .from('quotes')
    .select(`
      id,
      customer_name,
      customer_email,
      status,
      created_at,
      messages!inner (
        id,
        subject,
        body,
        direction,
        status,
        sent_at,
        created_at
      )
    `)
    .eq('account_id', accountId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;

  const headers = [
    'Quote ID',
    'Customer Name',
    'Customer Email',
    'Quote Status',
    'Message ID',
    'Subject',
    'Direction',
    'Message Status',
    'Sent At',
    'Created At'
  ];

  const rows: string[][] = [];
  
  for (const q of quotes) {
    for (const m of q.messages || []) {
      rows.push([
        q.id,
        q.customer_name,
        q.customer_email,
        q.status,
        m.id,
        (m.subject || '').replace(/"/g, '""'),
        m.direction,
        m.status,
        m.sent_at ? formatDate(new Date(m.sent_at)) : '',
        formatDate(new Date(m.created_at))
      ]);
    }
  }

  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
  
  return csv;
}

export async function generateMonthlyReport(accountId: string) {
  const supabase = await createClient();
  
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, amount, status, paid_at, created_at')
    .eq('account_id', accountId)
    .gte('created_at', monthStart.toISOString())
    .lt('created_at', monthEnd.toISOString());

  const { data: messages } = await supabase
    .from('messages')
    .select(`
      id,
      direction,
      status,
      sent_at,
      quotes!inner (account_id)
    `)
    .eq('quotes.account_id', accountId)
    .gte('created_at', monthStart.toISOString())
    .lt('created_at', monthEnd.toISOString());

  const totalQuotes = quotes?.length || 0;
  const paidQuotes = quotes?.filter(q => q.status === 'paid' || q.status === 'deposit_paid').length || 0;
  const totalAmount = quotes?.reduce((sum, q) => sum + (q.amount || 0), 0) || 0;
  const collectedAmount = quotes?.filter(q => q.status === 'paid' || q.status === 'deposit_paid').reduce((sum, q) => sum + (q.amount || 0), 0) || 0;
  const pendingAmount = totalAmount - collectedAmount;
  
  const followupsSent = messages?.filter(m => m.direction === 'outbound' && m.status === 'sent').length || 0;
  const repliesReceived = messages?.filter(m => m.direction === 'inbound').length || 0;
  const autoStopped = messages?.filter(m => m.direction === 'inbound' && m.status === 'read').length || 0;

  const report = {
    period: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    totalQuotes,
    paidQuotes,
    totalAmount,
    collectedAmount,
    pendingAmount,
    followupsSent,
    repliesReceived,
    autoStopped,
    collectionRate: totalQuotes > 0 ? Math.round((paidQuotes / totalQuotes) * 100) : 0,
  };

  return report;
}

export function formatReportEmail(report: any, userName: string) {
  return `
    <h2>Your Monthly QuoteFollow Report — ${report.period}</h2>
    <p>Hi ${userName},</p>
    <p>Here's how your follow-ups performed last month:</p>
    
    <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
      <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Quotes Sent</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${report.totalQuotes}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Quotes Paid</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${report.paidQuotes}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Collection Rate</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${report.collectionRate}%</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Total Invoiced</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${report.totalAmount.toLocaleString()}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Collected</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #059669;">$${report.collectedAmount.toLocaleString()}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Still Pending</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #dc2626;">$${report.pendingAmount.toLocaleString()}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Follow-ups Sent</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${report.followupsSent}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Replies Received</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${report.repliesReceived}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Auto-stopped (client replied)</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #059669;">${report.autoStopped}</td></tr>
    </table>
    
    <p style="margin-top: 24px;">
      <a href="https://www.voxalo.top/dashboard" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
        View Dashboard →
      </a>
    </p>
    
    <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
    <p style="color: #6b7280; font-size: 14px;">
      QuoteFollow — Follow-ups that stop themselves.<br>
      Deposits upfront. Chases automatically. Stops when they reply.
    </p>
  `;
}