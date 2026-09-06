import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseMimeMessage, decodeRfc2047, sanitizeMimeNoise, ParsedMime } from '@/lib/mime';
import { parseQuoteEmail, autoReply, generateFollowupBody } from '@/lib/ai';
import { sendEmail } from '@/lib/resend';
import { scheduleForDay } from '@/lib/followup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  // 完整 MIME 解析
  let mime: ParsedMime | null = null;
  if (mail.raw_mime) {
    try {
      const decoded = Buffer.from(mail.raw_mime, 'base64').toString('latin1');
      console.log('[inbound] raw_mime length:', decoded.length);
      mime = parseMimeMessage(decoded);
      console.log('[inbound] mime parsed - text length:', mime.text?.length, 'html length:', mime.html?.length);
    } catch (e) {
      console.warn('[inbound] raw_mime parse failed:', e);
    }
  }

  // 提取头部信息
  const fromRaw = mime?.headers['from'] || mail.From || '';
  const toRaw = mime?.headers['to'] || mail.To || '';
  const subject = mime ? decodeRfc2047(mime.headers['subject'] || '') : mail.Subject || '';

  // 正文决策（多级 fallback，所有路径统一过 sanitizeMimeNoise 清洗）：
  //   1) mime.text 解析成功 → 直接用；
  //   2) mime.html → 剥离标签转纯文本；
  //   3) 无 raw_mime（老版 Worker 未传）→ 用 Worker 的 text，
  //      老版 text 可能是未解析的原始 MIME 垃圾，清洗后为空则 body 留空，绝不把垃圾入库。
  let plainText = '';
  if (mime) {
    // mime.text 可能是空字符串（trim 后），需要检查是否有实际内容
    if (mime.text) {
      plainText = mime.text;
    } else if (mime.html) {
      // html 存在但 text 为空，从 html 提取文本
      plainText = mime.html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|tr|h\d)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
  }
  if (!plainText) {
    plainText = mail.text || mail.html || '';
  }

  // 所有路径统一清洗：boundary / base64 块 / Content-* 头 / 残片
  const body = sanitizeMimeNoise(plainText)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 如果 body 仍为空，尝试从 raw_mime 中提取更多信息
  if (!body && mail.raw_mime) {
    console.warn('[inbound] body is empty after parsing, raw_mime was provided but parse failed');
  }

  // 提取 Message-ID
  const messageId = (mime?.headers['message-id'] || mail['Message-Id'] || '')
    .replace(/^<|>$/g, '')
    .trim();

  // 提取 In-Reply-To
  const rawInReply = (mime?.headers['in-reply-to'] || mail['In-Reply-To'] || '')
    .split(',')[0]
    .trim();
  const inReplyTo = rawInReply.replace(/^<|>$/g, '');

  // 提取邮箱
  const senderEmail = extractEmail(fromRaw);
  const followupEmail = extractEmail(toRaw);

  const admin = createAdminClient();

  // ========== 情况 1：客户回复 ==========
  if (inReplyTo) {
    const baseId = inReplyTo.split('@')[0];
    const { data: msg } = await admin
      .from('messages')
      .select('quote_id, direction')
      .or(`message_id.eq.${inReplyTo},message_id.eq.${baseId}`)
      .maybeSingle();

    if (msg) {
      return handleCustomerReply({ admin, messageId, senderEmail, subject, body, quoteId: msg.quote_id });
    }

    // 兜底
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

  // ========== 情况 2：新报价邮件 ==========
  if (messageId && (await isDuplicateMessage(admin, messageId))) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  let account: Record<string, any> | null = null;

  if (senderEmail) {
    const { data: bySender, error: senderErr } = await admin
      .from('accounts')
      .select('*')
      .eq('email', senderEmail)
      .limit(1)
      .maybeSingle();
    if (senderErr) {
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

  await admin
    .from('quotes')
    .update({ status: 'replied', next_followup_at: null })
    .eq('id', quoteId);

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
    const replyPreview = body
      ? body.slice(0, 1000)
      : '(no readable text could be parsed from this email — please check the original message)';
    notificationText += `\n⚠️ Needs human attention. Customer's reply:\n\n${replyPreview}`;
  }

  await notifyOwner(admin, account, notificationText, quote.id, subject);

  return NextResponse.json({ ok: true, quote_id: quoteId, is_hot: ai.is_hot, needs_human: ai.needs_human });
}

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
