import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseMimeMessage, decodeRfc2047, ParsedMime } from '@/lib/mime';
import { parseQuoteEmail, autoReply, generateFollowupBody } from '@/lib/ai';
import { sendEmail } from '@/lib/resend';
import { scheduleForDay } from '@/lib/followup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============ 入站邮件 Webhook ============
// 两种来源都打到这里：
//   A) Resend Inbound（官方 webhook payload）
//   B) Cloudflare Email Routing → Worker → POST（Worker 已转成 Resend 兼容 payload）
// 鉴权：X-Inbound-Secret header == INBOUND_WEBHOOK_SECRET

interface InboundMail {
  From: string;
  To: string;
  Subject?: string;
  text?: string;
  html?: string;
  raw_mime?: string;
  'Message-Id'?: string;
  'In-Reply-To'?: string;
  References?: string;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-inbound-secret');
  if (secret !== process.env.INBOUND_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let mail: InboundMail;
  try {
    mail = (await req.json()) as InboundMail;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 });
  }

  let mime: ParsedMime | null = null;
  if (mail.raw_mime) {
    try {
      const decoded = Buffer.from(mail.raw_mime, 'base64').toString('latin1');
      console.log('[inbound] raw_mime length:', decoded.length, 'first 200:', decoded.substring(0, 200).replace(/\n/g, '\\n'));
      mime = parseMimeMessage(decoded);
      console.log('[inbound] mime parsed - text length:', mime.text?.length, 'html length:', mime.html?.length);
    } catch (e) {
      console.warn('[inbound] raw_mime parse failed:', e);
    }
  }

  // 优先使用 MIME 解析结果，兜底用 Worker 传来的 text/html
  const fromRaw = mime?.headers['from'] || mail.From || '';
  const toRaw = mime?.headers['to'] || mail.To || '';
  const subject = mime ? decodeRfc2047(mime.headers['subject'] || '') : mail.Subject || '';

  // 关键修复：如果 MIME 解析成功但有 text，用 text；否则用 html；都空才 fallback
  let plainText = '';
  if (mime) {
    plainText = mime.text || mime.html || '';
    console.log('[inbound] using mime text:', plainText.substring(0, 100));
  } else if (mail.text && !mail.text.includes('NextPart') && !mail.text.includes('boundary')) {
    // mail.text 干净（不含 MIME 噪声）才用
    plainText = mail.text;
    console.log('[inbound] using mail.text (clean)');
  } else {
    // 兜底：mail.text 可能含乱码，至少去掉明显噪声
    plainText = mail.text || mail.html || '';
    console.log('[inbound] using fallback text, contains noise:', plainText.includes('NextPart'));
  }

  const body = plainText
    .replace(/
\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const messageId = (mime?.headers['message-id'] || mail['Message-Id'] || '')
    .replace(/^<|>$/g, '')
    .trim();
  // In-Reply-To 可能带 < >，也可能多个引用；取第一个并剥掉尖括号
  const rawInReply = (mime?.headers['in-reply-to'] || mail['In-Reply-To'] || '')
    .split(',')[0]
    .trim();
  const inReplyTo = rawInReply.replace(/^<|>$/g, '');

  // 发件人 = 客户（老板是收件人 follow@domain）
  const senderEmail = extractEmail(fromRaw);
  const followupEmail = extractEmail(toRaw);

  const admin = createAdminClient();

  // ========== 情况 1：这是客户对跟进邮件的回复（In-Reply-To 命中我们发过的邮件） ==========
  if (inReplyTo) {
    // Resend 生成的 Message-ID 形如 <{apiId}@resend.dev>，我们入库存的是 apiId，
    // 所以既匹配完整值也匹配 @ 前的 id。
    const baseId = inReplyTo.split('@')[0];
    const { data: msg } = await admin
      .from('messages')
      .select('quote_id, direction')
      .or(`message_id.eq.${inReplyTo},message_id.eq.${baseId}`)
      .maybeSingle();

    if (msg) {
      return handleCustomerReply({ admin, messageId, senderEmail, subject, body, quoteId: msg.quote_id });
    }

    // 兜底：In-Reply-To 没匹配上时，用发件人邮箱找最近的报价（status 非 won/lost）
    const { data: fallbackQuote } = await admin
      .from('quotes')
      .select('id')
      .eq('customer_email', senderEmail)
      .not('status', 'in', '("won","lost")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackQuote) {
      return handleCustomerReply({ admin, messageId, senderEmail, subject, body, quoteId: fallbackQuote.id });
    }
  }

  // ========== 情况 2：老板转发来的新报价邮件 ==========
  // 幂等：同一封原始邮件重复投递（webhook 重试）时跳过，防止重复建档
  if (messageId && (await isDuplicateMessage(admin, messageId))) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // 找老板账号：优先按发件人邮箱（= 注册邮箱）精确匹配。
  // 所有垂直共享入站邮箱 follow@voxalo.top，多账户下按 To 无法区分；
  // 按 From 匹配不到时再按 To（followup_email）兜底（兼容老数据/单账户）。
  let account: Record<string, any> | null = null;

  if (senderEmail) {
    const { data: bySender, error: senderErr } = await admin
      .from('accounts')
      .select('*')
      .eq('email', senderEmail)
      .limit(1)
      .maybeSingle();
    if (senderErr) {
      // email 列可能尚未创建（未跑 003 migration）→ 降级到 To 匹配
      console.warn('[inbound] sender lookup skipped:', senderErr.message);
    } else if (bySender) {
      account = bySender;
    }
  }

  if (!account && followupEmail) {
    const { data: byInbox } = await admin
      .from('accounts')
      .select('*')
      .eq('followup_email', followupEmail)
      .limit(1)
      .maybeSingle();
    account = byInbox || null;
  }

  if (!account) {
    console.warn('[inbound] no account for followup email:', followupEmail, 'sender:', senderEmail);
    return NextResponse.json({ ok: false, error: 'no account for this inbox' }, { status: 404 });
  }

  // AI 解析报价 → 建档
  const parsed = await parseQuoteEmail(subject, body);

  const quoteDate = parsed.quote_date ? new Date(parsed.quote_date) : new Date();
  const { data: quote, error: qErr } = await admin
    .from('quotes')
    .insert({
      account_id: account.id,
      customer_email: parsed.customer_email || senderEmail,
      customer_name: parsed.customer_name,
      amount: parsed.amount,
      service_type: parsed.service_type,
      quote_date: quoteDate.toISOString().slice(0, 10),
      source_subject: subject,
      source_body: body.slice(0, 5000),
      next_followup_at: scheduleForDay(quoteDate, 1).toISOString(),
    })
    .select()
    .single();

  if (qErr) {
    console.error('[inbound] insert quote error:', qErr);
    return NextResponse.json({ ok: false, error: 'db error' }, { status: 500 });
  }

  // 记录原始邮件
  await admin.from('messages').insert({
    quote_id: quote.id,
    direction: 'in',
    subject,
    body: body.slice(0, 5000),
    message_id: messageId,
    in_reply_to: '',
  });

  console.log('[inbound] new quote created:', quote.id);
  return NextResponse.json({ ok: true, quote_id: quote.id });
}

// ========== 客户回复处理：自动回复 + 热单提醒 + 停止自动跟进 ==========
async function handleCustomerReply(args: {
  admin: ReturnType<typeof createAdminClient>;
  messageId: string;
  senderEmail: string;
  subject: string;
  body: string;
  quoteId: string;
}) {
  const { admin, messageId, senderEmail, subject, body, quoteId } = args;

  const { data: quote } = await admin.from('quotes').select('*').eq('id', quoteId).single();
  if (!quote) {
    // quote 找不到时仍然入库，避免邮件丢包
    await admin.from('messages').insert({
      quote_id: quoteId,
      direction: 'in',
      subject,
      body: body.slice(0, 5000),
      message_id: messageId,
      in_reply_to: '',
    });
    console.warn('[inbound] quote not found, body stored without quote:', quoteId, 'sender:', senderEmail);
    return NextResponse.json({ ok: true, quote_id: quoteId, handled_orphan: true });
  }

  const { data: account } = await admin.from('accounts').select('*').eq('id', quote.account_id).single();

  // 客户回复 → 停止自动跟进
  await admin
    .from('quotes')
    .update({ status: 'replied', next_followup_at: null })
    .eq('id', quoteId);

  // 记录客户回复
  await admin.from('messages').insert({
    quote_id: quoteId,
    direction: 'in',
    subject,
    body: body.slice(0, 5000),
    message_id: messageId,
    in_reply_to: '',
  });

  const ai = await autoReply(quote.customer_name, body, account?.business_info || {});

  let notificationText = `Customer ${quote.customer_name || senderEmail} replied to your quote (${quote.service_type || 'service'}, $${quote.amount ?? 'n/a'}).`;

  if (ai.should_reply && ai.reply_body && account?.auto_reply_enabled !== false) {
    await sendEmail({
      to: senderEmail,
      subject: `Re: ${subject}`,
      text: ai.reply_body,
      inReplyTo: messageId,
    });
    await admin.from('messages').insert({
      quote_id: quoteId,
      direction: 'out',
      subject: `Re: ${subject}`,
      body: ai.reply_body,
      message_id: '',
      in_reply_to: messageId,
    });
  }

  if (ai.is_hot) {
    notificationText += '\n🔥 HOT LEAD — customer seems ready to book. Jump on this now!';
  }
  if (ai.needs_human) {
    notificationText += `\n⚠️ Needs human attention. Customer's reply:\n\n${body.slice(0, 1000)}`;
  }

  await notifyOwner(admin, account, notificationText, quote.id, subject);

  return NextResponse.json({ ok: true, quote_id: quoteId, is_hot: ai.is_hot, needs_human: ai.needs_human });
}

// ========== 通知老板（邮件 + 可选 Slack） ==========
async function notifyOwner(
  admin: ReturnType<typeof createAdminClient>,
  account: any,
  text: string,
  quoteId?: string,
  subject?: string
) {
  if (!account) {
    console.warn('[notify] account missing, skip notify');
    return;
  }
  const { data: user } = await admin.auth.admin.getUserById(account.id);
  const ownerEmail = user.user?.email;

  if (ownerEmail) {
    await sendEmail({
      to: ownerEmail,
      subject: `QuoteFollow: ${subject || 'update'}${quoteId ? ` — ${quoteId.slice(0, 8)}` : ''}`,
      text,
    }).catch((e) => console.error('[notify] email failed:', e));
  }

  if (account.slack_webhook) {
    await fetch(account.slack_webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `QuoteFollow: ${text}\n${process.env.NEXT_PUBLIC_APP_URL}/dashboard/quotes/${quoteId}`,
      }),
    }).catch((e) => console.error('[notify] slack failed:', e));
  }
}

function extractEmail(header: string): string {
  const m = header.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  return m ? m[0] : '';
}

// ========== 幂等检查：message_id 是否已入库 ==========
async function isDuplicateMessage(
  admin: ReturnType<typeof createAdminClient>,
  messageId: string
): Promise<boolean> {
  const { data } = await admin
    .from('messages')
    .select('id')
    .eq('message_id', messageId)
    .limit(1)
    .maybeSingle();
  return !!data;
}
