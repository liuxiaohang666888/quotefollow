import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/resend';
import { scheduleForDay } from '@/lib/followup';
import { resumePausedFollowupsForCustomer } from '@/lib/followup-resume';
import { isAdminEmail, FREE_QUOTA, countQuotesFor, isTrialActive } from '@/lib/paywall';
import { isValidPaypalSubscriptionId } from '@/lib/paypal';
import { isQuoteCreateRateLimited } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 邮件正文里的用户输入转义，防止 HTML 注入
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 发送报价邮件给客户 + 自动建档 + 安排跟进
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  // 防刷：限频（共享限流模块，见 lib/rate-limit.ts）
  if (isQuoteCreateRateLimited(user.id)) {
    return NextResponse.json({ ok: false, error: 'rate limited: too many quotes in a minute' }, { status: 429 });
  }

  // 付费检查
  const admin = createAdminClient();
  let { data: acc } = await admin.from('accounts').select('*').eq('id', user.id).maybeSingle();

  if (!acc) {
    const { data: created, error: accErr } = await admin
      .from('accounts')
      .upsert(
        { id: user.id, email: user.email ?? '', followup_email: 'follow@voxalo.top' },
        { onConflict: 'id' }
      )
      .select()
      .single();
    if (accErr) {
      console.error('[quotes/send] account self-heal failed:', accErr);
    }
    acc = created ?? acc;
  }
  const isAdmin = isAdminEmail(user.email);
  const isPaid = !!acc?.paypal_subscription_id && isValidPaypalSubscriptionId(acc.paypal_subscription_id);
  if (!isAdmin && !isPaid) {
    const used = await countQuotesFor(admin, user.id, user.email);
    if (used >= FREE_QUOTA || !isTrialActive(acc)) {
      const reason = used >= FREE_QUOTA
        ? `Free plan allows ${FREE_QUOTA} quotes. Subscribe to add more.`
        : 'Your free trial (14 days or 3 clients, whichever comes first) has ended. Subscribe to continue using QuoteFollow.';
      return NextResponse.json({ ok: false, error: reason }, { status: 402 });
    }
  }

  let body: {
      customer_name: string;
      customer_email: string;
      service_type: string;
      amount: number | null;
      message: string;
      require_deposit?: boolean;
      deposit_amount?: number | null;
    };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 });
  }

  const customerName = (body.customer_name || '').trim();
  const customerEmail = (body.customer_email || '').trim().toLowerCase();
  const serviceType = (body.service_type || '').trim();
  const amount = typeof body.amount === 'number' && body.amount > 0 ? body.amount : null;
    const requireDeposit = !!body.require_deposit;
    const depositAmount = (requireDeposit && typeof body.deposit_amount === 'number' && body.deposit_amount > 0) ? body.deposit_amount : null;

    const message = (body.message || '').trim();

  if (!customerEmail) {
    return NextResponse.json({ ok: false, error: 'Customer email is required' }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ ok: false, error: 'Quote message is required' }, { status: 400 });
  }

  const businessName = acc?.business_name || 'Your business';
  const subject = `Quote: ${serviceType || 'our service'}${customerName ? ` for ${customerName}` : ''}`;

  // 防止邮件头 CRLF 注入（只处理 subject，body 是邮件正文不需要去掉换行）
  const safeSubject = subject.replace(/[\r\n]/g, '');
  const safeMessage = message.trim();

  const quoteDate = new Date();

  // 定金要求：需要时生成客户门户 token，邮件里带 Pay deposit 按钮
  const portalToken = requireDeposit ? randomBytes(24).toString('hex') : null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxalo.top';

  const emailHtml = requireDeposit && portalToken
    ? `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111827;">
<p style="white-space:pre-wrap;">${escapeHtml(safeMessage)}</p>
<div style="margin:28px 0;text-align:center;">
<a href="${appUrl}/portal/pay/${portalToken}" style="display:inline-block;background:#16a34a;color:#ffffff;padding:13px 30px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">Pay deposit — $${depositAmount}</a>
<p style="color:#6b7280;font-size:13px;margin-top:10px;">A deposit of $${depositAmount} is required to lock your booking.</p>
</div>
</div>`
    : `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111827;"><p style="white-space:pre-wrap;">${escapeHtml(safeMessage)}</p></div>`;

  try {
    // 配额二次复核（M11①）：count-then-insert 之间有并发窗口，免费用户两个并发请求
    // 可能同时通过检查。发信前再查一次把窗口压到最小（邮件一旦发出撤不回）。
    if (!isAdmin && !isPaid) {
      const recheck = await countQuotesFor(admin, user.id, user.email);
      if (recheck >= FREE_QUOTA) {
        return NextResponse.json(
          { ok: false, error: `Free plan allows ${FREE_QUOTA} quotes. Subscribe to add more.` },
          { status: 402 }
        );
      }
    }

    // 1. 发送报价邮件给客户
    const sentRes = await sendEmail({
      to: customerEmail,
      subject: safeSubject,
      text: safeMessage,
      html: emailHtml,
      replyTo: acc?.followup_email || 'follow@voxalo.top',
      fromName: businessName,
    });

    // 2. 创建报价记录
    const { data: quote, error: qErr } = await supabase
      .from('quotes')
      .insert({
        account_id: user.id,
        customer_email: customerEmail,
        customer_name: customerName,
        amount,
        service_type: serviceType,
        quote_date: quoteDate.toISOString().slice(0, 10),
        source_subject: safeSubject,
        source_body: safeMessage.slice(0, 5000),
        next_followup_at: scheduleForDay(quoteDate, 1).toISOString(),
        require_deposit: requireDeposit,
        deposit_amount: depositAmount,
        deposit_status: requireDeposit ? 'unpaid' : null,
        portal_token: portalToken,
      })
      .select()
      .single();

    if (qErr) {
      console.error('[quotes/send] insert error:', qErr);
      const code = (qErr as { code?: string }).code ?? 'unknown';
      return NextResponse.json(
        { ok: false, error: `Quote sent but failed to save (code ${code}). Please contact support.` },
        { status: 500 }
      );
    }

    // 插入后复查（M11① 自纠）：并发 Burst 下最终超配额时，删掉自己刚建的这行并告知，
    // 保证库里免费账号的报价数不会超过 FREE_QUOTA。邮件已发出的代价接受
    // （窗口已压到毫秒级，且客户收到的是真实报价内容，不是垃圾）。
    if (!isAdmin && !isPaid) {
      const recount = await countQuotesFor(admin, user.id, user.email);
      if (recount > FREE_QUOTA) {
        await supabase.from('quotes').delete().eq('id', quote.id);
        return NextResponse.json(
          { ok: false, error: `Free plan allows ${FREE_QUOTA} quotes. Subscribe to add more.` },
          { status: 402 }
        );
      }
    }

    // 3. 记录发送的邮件
    await admin.from('messages').insert({
      quote_id: quote.id,
      direction: 'out',
      subject: safeSubject,
      body: safeMessage.slice(0, 5000),
      message_id: sentRes?.id || '',
      in_reply_to: '',
    });

    // 4. 新报价发出 = 同客户有新商机：恢复该客户此前 paused 的报价，继续自动跟进
    const resumed = await resumePausedFollowupsForCustomer(admin, user.id, customerEmail, quote.id);
    console.log('[quotes/send] resumed paused followups for customer:', resumed);

    return NextResponse.json({ ok: true, quote_id: quote.id });
  } catch (e) {
    console.error('[quotes/send] send failed:', e);
    return NextResponse.json({ ok: false, error: 'Failed to send quote email. Please try again.' }, { status: 500 });
  }
}
