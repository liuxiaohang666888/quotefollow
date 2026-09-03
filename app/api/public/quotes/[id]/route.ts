import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 客户公开报价页读取接口（无需登录）
// 安全说明：quote id 是 uuid，不可枚举；只暴露有限字段。
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = createAdminClient();
  const { data: quote, error } = await admin
    .from('quotes')
    .select('id, customer_name, service_type, amount, quote_date, source_subject, account_id')
    .eq('id', params.id)
    .maybeSingle();

  if (error || !quote) {
    return NextResponse.json({ ok: false, error: 'quote not found' }, { status: 404 });
  }

  // 带上商家名称，让页面更可信
  const { data: account } = await admin
    .from('accounts')
    .select('business_name, followup_email')
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
      followup_email: account?.followup_email || '',
    },
  });
}
