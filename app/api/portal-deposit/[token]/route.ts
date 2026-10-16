import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 客户付定金门户：凭 portal_token 读取报价定金信息 + 老板收款链接
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ ok: false, error: 'missing token' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. 按 token 找报价（只暴露定金相关字段，不暴露内部信息）
  const { data: quote, error: quoteError } = await admin
    .from('quotes')
    .select('id, account_id, customer_name, service_type, require_deposit, deposit_amount, deposit_status, deposit_paid_at')
    .eq('portal_token', token)
    .maybeSingle();

  if (quoteError || !quote) {
    return NextResponse.json({ ok: false, error: 'quote not found' }, { status: 404 });
  }
  if (!quote.require_deposit) {
    return NextResponse.json({ ok: false, error: 'no deposit required' }, { status: 400 });
  }

  // 2. 取老板的收款链接（客户可见）
  const { data: account, error: accountError } = await admin
    .from('accounts')
    .select('business_name, payment_link')
    .eq('id', quote.account_id)
    .maybeSingle();

  if (accountError || !account) {
    return NextResponse.json({ ok: false, error: 'account not found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      customerName: quote.customer_name,
      serviceType: quote.service_type,
      depositAmount: quote.deposit_amount?.toString() || null,
      depositStatus: quote.deposit_status,
      depositPaidAt: quote.deposit_paid_at,
      paymentLink: account.payment_link || '',
      businessName: account.business_name || 'Your business',
    },
  });
}
