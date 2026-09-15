import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Get all active accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, email, business_name, plan')
      .neq('plan', 'cancelled');

    if (accountsError) throw accountsError;

    let sent = 0;
    let failed = 0;

    for (const account of accounts || []) {
      try {
        // Get quotes for last month
        const { data: quotes } = await supabase
          .from('quotes')
          .select(`
            *,
            scope_changes (amount)
          `)
          .eq('account_id', account.id)
          .gte('created_at', firstDayLastMonth.toISOString())
          .lte('created_at', lastDayLastMonth.toISOString());

        if (!quotes || quotes.length === 0) continue;

        // Calculate stats
        const totalQuotes = quotes.length;
        const totalAmount = quotes.reduce((sum, q) => sum + (q.amount || 0), 0);
        const scopeChangesTotal = quotes.reduce((sum, q) => 
          sum + (q.scope_changes?.reduce((s: number, sc: any) => s + (sc.amount || 0), 0) || 0), 0);
        const totalWithChanges = totalAmount + scopeChangesTotal;

        // Get paid quotes
        const paidQuotes = quotes.filter(q => q.status === 'paid');
        const paidAmount = paidQuotes.reduce((sum, q) => sum + (q.amount || 0), 0);
        const paidScopeChanges = paidQuotes.reduce((sum, q) => 
          sum + (q.scope_changes?.reduce((s: number, sc: any) => s + (sc.amount || 0), 0) || 0), 0);
        const totalPaid = paidAmount + paidScopeChanges;

        // Get follow-up stats
        const quoteIds = quotes.map(q => q.id);
        const { data: messages } = await supabase
          .from('messages')
          .select('id, quote_id, direction, created_at')
          .in('quote_id', quoteIds)
          .eq('direction', 'outbound');

        const followupsSent = messages?.length || 0;

        // Get deposit stats
        const depositQuotes = quotes.filter(q => q.require_deposit);
        const depositsPaid = depositQuotes.filter(q => q.deposit_status === 'paid').length;
        const depositsPending = depositQuotes.filter(q => q.deposit_status === 'unpaid').length;
        const depositAmountCollected = depositQuotes
          .filter(q => q.deposit_status === 'paid')
          .reduce((sum, q) => sum + (q.deposit_amount || 0), 0);
        const depositAmountPending = depositQuotes
          .filter(q => q.deposit_status === 'unpaid')
          .reduce((sum, q) => sum + (q.deposit_amount || 0), 0);

        // Send email
        const monthName = firstDayLastMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        
        await resend.emails.send({
          from: 'QuoteFollow <reports@voxalo.top>',
          to: account.email,
          subject: `Your QuoteFollow Monthly Report — ${monthName}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px;">
              <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; padding: 32px; color: white;">
                <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 700;">Monthly Report</h1>
                <p style="margin: 0; color: #94a3b8; font-size: 16px;">${monthName} — ${account.business_name || 'Your Business'}</p>
              </div>
              
              <div style="padding: 24px 0;">
                <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">📊 At a Glance</h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div style="background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 24px; font-weight: 700; color: #1e293b;">${totalQuotes}</div>
                    <div style="font-size: 13px; color: #64748b;">Quotes Created</div>
                  </div>
                  <div style="background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 24px; font-weight: 700; color: #1e293b;">$${totalWithChanges.toLocaleString()}</div>
                    <div style="font-size: 13px; color: #64748b;">Total Quote Value</div>
                  </div>
                  <div style="background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 24px; font-weight: 700; color: #1e293b;">$${totalPaid.toLocaleString()}</div>
                    <div style="font-size: 13px; color: #64748b;">Collected</div>
                  </div>
                  <div style="background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 24px; font-weight: 700; color: #1e293b;">${followupsSent}</div>
                    <div style="font-size: 13px; color: #64748b;">Follow-ups Sent</div>
                  </div>
                </div>
              </div>

              <div style="background: #f0f9ff; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #bae6fd;">
                <h3 style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #0369a1;">💰 Deposits</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; font-size: 14px;">
                  <div>
                    <div style="color: #64748b; font-size: 12px;">Collected</div>
                    <div style="font-weight: 600; color: #059669;">${depositsPaid} / ${depositQuotes.length}</div>
                  </div>
                  <div>
                    <div style="color: #64748b; font-size: 12px;">Pending</div>
                    <div style="font-weight: 600; color: #d97706;">${depositsPending}</div>
                  </div>
                  <div>
                    <div style="color: #64748b; font-size: 12px;">Amount Collected</div>
                    <div style="font-weight: 600; color: #1e293b;">$${depositAmountCollected.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <div style="background: #fef3c7; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #fcd34d;">
                <h3 style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #92400e;">⚠️ Action Needed</h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #1f2937;">
                  ${depositsPending > 0 ? `<li>${depositsPending} deposit(s) pending — $${depositAmountPending.toLocaleString()} at risk</li>` : ''}
                  ${quotes.filter(q => q.status === 'sent' && new Date(q.created_at) < new Date(Date.now() - 14*24*60*60*1000)).length > 0 
                    ? `<li>${quotes.filter(q => q.status === 'sent' && new Date(q.created_at) < new Date(Date.now() - 14*24*60*60*1000)).length} quote(s) over 14 days unpaid</li>` 
                    : ''}
                  ${scopeChangesTotal > 0 ? `<li>${quotes.filter(q => q.scope_changes && q.scope_changes.length > 0).length} quote(s) have scope changes — review totals</li>` : ''}
                  ${depositsPending === 0 && quotes.filter(q => q.status === 'sent' && new Date(q.created_at) < new Date(Date.now() - 14*24*60*60*1000)).length === 0 && scopeChangesTotal === 0 
                    ? '<li style="color: #059669;">All caught up! 🎉</li>' : ''}
                </ul>
              </div>

              <div style="text-align: center; margin-top: 32px;">
                <a href="https://www.voxalo.top/dashboard" style="display: inline-block; background: #1e293b; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Dashboard →</a>
              </div>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">
                You received this because you use QuoteFollow. 
                <a href="https://www.voxalo.top/dashboard/settings" style="color: #2563eb;">Manage notifications</a>
              </p>
            </body>
            </html>
          `,
        });

        sent++;
      } catch (err) {
        console.error(`Failed to send report to ${account.email}:`, err);
        failed++;
      }
    }

    return NextResponse.json({ sent, failed, total: accounts?.length || 0 });
  } catch (error) {
    console.error('Monthly report error:', error);
    return NextResponse.json({ error: 'Report generation failed' }, { status: 500 });
  }
}