import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseQuoteEmail } from '@/lib/ai';
import { scheduleForDay } from '@/lib/followup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 手动创建报价：老板在后台粘贴报价邮件内容 → AI 解析 → 建档 → 安排跟进
// 这是"邮件转发"之外的另一个入口，不依赖域名/邮件路由，今天即可用。
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let body: { subject?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 });
  }

  const subject = (body.subject || '').toString();
  const text = (body.text || '')
    .toString()
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text && !subject) {
    return NextResponse.json({ ok: false, error: 'please paste the quote email' }, { status: 400 });
  }

  const parsed = await parseQuoteEmail(subject, text);
  const quoteDate = parsed.quote_date ? new Date(parsed.quote_date) : new Date();

  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({
      account_id: user.id,
      customer_email: parsed.customer_email,
      customer_name: parsed.customer_name,
      amount: parsed.amount,
      service_type: parsed.service_type,
      quote_date: quoteDate.toISOString().slice(0, 10),
      source_subject: subject,
      source_body: text.slice(0, 5000),
      next_followup_at: scheduleForDay(quoteDate, 1).toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, quote_id: quote.id });
}
