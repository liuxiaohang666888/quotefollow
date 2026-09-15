import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/resend';

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
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
    const monthLabel = new Date(now.getFullYear(), now.getMonth() - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Get all accounts with subscriptions
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, followup_email, business_name, paypal_subscription_id')
      .not('paypal_subscription_id', 'is', null);

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ message: 'No subscribed accounts found' });
    }

    let sent = 0;
    let failed = 0;

    for (const account of accounts) {
      try {
        // Get quotes created this month
        const { data: quotes } = await supabase
          .from('quotes')
          .select('*')
          .eq('account_id', account.id)
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd);

        // Get won quotes this month
        const { data: wonQuotes } = await supabase
          .from('quotes')
          .select('*')
          .eq('account_id', account.id)
          .eq('status', 'won')
          .gte('paid_at', monthStart)
          .lte('paid_at', monthEnd);

        // Get follow-ups sent this month
        const { data: followups } = await supabase
          .from('messages')
          .select('*')
          .eq('account_id', account.id)
          .gte('sent_at', monthStart)
          .lte('sent_at', monthEnd);

        const totalQuotes = quotes?.length || 0;
        const totalWon = wonQuotes?.length || 0;
        const totalRevenue = wonQuotes?.reduce((sum, q) => sum + (q.amount || 0), 0) || 0;
        const totalFollowups = followups?.length || 0;

        // Calculate "recovered" - quotes that were won after follow-ups
        const recoveredQuotes = wonQuotes?.filter(q => {
          const followupCount = followups?.filter(f => f.quote_id === q.id).length || 0;
          return followupCount > 0;
        }).length || 0;

        const recoveredAmount = wonQuotes?.filter(q => {
          const followupCount = followups?.filter(f => f.quote_id === q.id).length || 0;
          return followupCount > 0;
        }).reduce((sum, q) => sum + (q.amount || 0), 0) || 0;

        // Skip if no activity
        if (totalQuotes === 0 && totalFollowups === 0) continue;

        // Generate email
        const subject = `Your ${monthLabel} QuoteFollow Report`;
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="background: #f8fafc; border-radius: 12px; padding: 32px;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 700; color: #111827;">QuoteFollow Monthly Report</h1>
                <p style="margin: 0; color: #6b7280; font-size: 16px;">${monthLabel}</p>
              </div>

              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 32px;">
                <div style="background: white; border-radius: 8px; padding: 20px; text-align: center; border: 1px solid #e5e7eb;">
                  <div style="font-size: 32px; font-weight: 700; color: #2563eb;">${totalQuotes}</div>
                  <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">Quotes Sent</div>
                </div>
                <div style="background: white; border-radius: 8px; padding: 20px; text-align: center; border: 1px solid #e5e7eb;">
                  <div style="font-size: 32px; font-weight: 700; color: #22c55e;">$${totalRevenue.toLocaleString()}</div>
                  <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">Revenue Won</div>
                </div>
                <div style="background: white; border-radius: 8px; padding: 20px; text-align: center; border: 1px solid #e5e7eb;">
                  <div style="font-size: 32px; font-weight: 700; color: #f59e0b;">${recoveredAmount.toLocaleString()}</div>
                  <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">Recovered by Follow-ups</div>
                </div>
                <div style="background: white; border-radius: 8px; padding: 20px; text-align: center; border: 1px solid #e5e7eb;">
                  <div style="font-size: 32px; font-weight: 700; color: #8b5cf6;">${totalFollowups}</div>
                  <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">Follow-ups Sent</div>
                </div>
              </div>

              <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; font-size: 16px; color: #166534;">Key Wins This Month</h3>
                <ul style="margin: 0; padding-left: 20px; color: #166534; font-size: 14px;">
                  <li>You sent <strong>${totalQuotes}</strong> quotes and followed up <strong>${totalFollowups}</strong> times automatically</li>
                  <li>Won <strong>${totalWon}</strong> deals worth <strong>$${totalRevenue.toLocaleString()}</strong></li>
                  <li><strong>${recoveredQuotes}</strong> deals (worth <strong>$${recoveredAmount.toLocaleString()}</strong>) were recovered after follow-ups</li>
                  <li>Without QuoteFollow, you might have lost ~<strong>$${recoveredAmount.toLocaleString()}</strong> to silence</li>
                </ul>
              </div>

              <div style="text-align: center;">
                <a href="https://www.voxalo.top/dashboard" style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 15px;">
                  View Dashboard →
                </a>
              </div>

              <p style="margin-top: 32px; font-size: 12px; color: #9ca3af; text-align: center;">
                You're receiving this because you're a QuoteFollow subscriber.<br>
                <a href="https://www.voxalo.top/dashboard/settings" style="color: #6b7280;">Unsubscribe from reports</a>
              </p>
            </div>
          </body>
          </html>
        `;

        await sendEmail({
          to: account.followup_email,
          subject,
          html,
        });

        sent++;
      } catch (e) {
        console.error(`Failed to send report to ${account.followup_email}:`, e);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      month: monthLabel,
      sent,
      failed,
    });

  } catch (e) {
    console.error('Monthly report cron error:', e);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}