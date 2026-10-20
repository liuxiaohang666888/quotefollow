import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 客户公开报价页读取接口（无需登录）
// 安全说明：quote id 是 uuid，不可枚举；只暴露有限字段。
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: quote, error } = await admin
    .from('quotes')
    .select('id, customer_name, service_type, amount, quote_date, source_subject, account_id')
    .eq('id', id)
    .maybeSingle();

  if (error || !quote) {
    return NextResponse.json({ ok: false, error: 'quote not found' }, { status: 404 });
  }

  // 带上商家名称，让页面更可信
  // L6 修复：不再返回 followup_email——公开页（无需登录）暴露商家内部收件箱，
  // 等于给垃圾邮件/爬虫递目标。前端页面本就未使用该字段（已 grep 验证）。
  const { data: account } = await admin
    .from('accounts')
    .select('business_name')
    .eq('id', quote.account_id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    quote: {
      id: quote.id,
      customer_name: quote.customer_name,
      service_type: quote.service_type,
      amount: quote.amount,
      quote_date: quote.quote_date,
      source_subject: quote.source_subject,
      business_name: account?.business_name || '',
    },
  });
}
