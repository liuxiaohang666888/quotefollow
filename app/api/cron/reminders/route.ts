import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 每日定时：检查逾期发票，发送催款提醒
export async function POST(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // 查找逾期且未付费的客户（距离到期日超过 7 天）
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: clients, error } = await admin
    .from('clients')
    .select(`
      id,
      account_id,
      name,
      email,
      invoice_amount,
      invoice_due_date,
      invoice_paid,
      last_reminder_sent,
      reminder_count,
      notes
    `)
    .eq('invoice_paid', false)
    .not('invoice_due_date', 'is', null)
    .lt('invoice_due_date', new Date().toISOString().split('T')[0])
    .or('last_reminder_sent.is.null,last_reminder_sent.lt.7d'); // 至少 7 天没发过提醒

  if (error) {
    console.error('[cron/reminders] query error:', error);
    return NextResponse.json({ ok: false, error: 'db error' }, { status: 500 });
  }

  if (!clients || clients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  
  for (const client of clients) {
    try {
      // 获取老板信息
      const { data: account } = await admin
        .from('accounts')
        .select('business_name, followup_email')
        .eq('id', client.account_id)
        .single();

      if (!account) continue;

      // 计算逾期天数
      const dueDate = new Date(client.invoice_due_date);
      const daysOverdue = Math.ceil((Date.now() - dueDate.getTime()) / 86400000);
      
      // 构建邮件内容
      const subject = `发票提醒：${client.name} 的款项已逾期 ${daysOverdue} 天`;
      const body = `您好 ${client.name}，

您的发票已逾期 ${daysOverdue} 天。

📋 发票详情：
• 金额：$${client.invoice_amount?.toFixed(2) || '0.00'}
• 到期日：${dueDate.toLocaleDateString('zh-CN')}
• 当前状态：待支付

您可通过以下链接查看项目进度和发票详情：
[这是未来要加的链接，现在先手动告知客户]

如有疑问，请随时联系我们。

此致
${account.business_name || '我们的团队'}`;

      // 发送邮件
      const sentRes = await sendEmail({
        to: client.email,
        subject,
        text: body,
        replyTo: account.followup_email || undefined,
      });

      // 更新提醒记录
      await admin
        .from('clients')
        .update({
          last_reminder_sent: new Date().toISOString(),
          reminder_count: (client.reminder_count || 0) + 1,
        })
        .eq('id', client.id);

      console.log('[cron/reminders] sent reminder to', client.email, 'sentRes:', sentRes?.id);
      sent++;
    } catch (e) {
      console.error('[cron/reminders] failed for client', client.id, e);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
