import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseMimeMessage, decodeRfc2047, sanitizeMimeNoise, ParsedMime } from '@/lib/mime';
import { parseQuoteEmail, autoReply } from '@/lib/ai';
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

  // 处理轨迹追踪：每个分支结束时写入 inbound_debug 表，替代看 Vercel 日志
  let trace!: {
    message_id: string; in_reply_to: string; sender_email: string;
    followup_email: string; subject: string; body_len: number; raw_len: number;
  };
  const traceInit = (m: InboundMail, bodyLen: number, rawLen: number) => {
    trace = {
      message_id: (m['Message-Id'] || '').trim(),
      in_reply_to: (m['In-Reply-To'] || '').trim(),
      sender_email: (m.From || '').trim(),
      followup_email: (m.To || '').trim(),
      subject: (m.Subject || '').trim().slice(0, 200),
      body_len: bodyLen,
      raw_len: rawLen,
    };
  };
  const traceWrite = async (result: string, detail?: string) => {
    try {
      const admin0 = createAdminClient();
      await admin0.from('inbound_debug').insert({ ...trace, result, detail: (detail || '').slice(0, 500) });
    } catch (e: any) {
      console.error('[inbound] trace write failed:', e?.message || e);
    }
  };

  const rawMimeB64 = mail.raw_mime || '';
  let mime: ParsedMime | null = null;

  // 调试：打印 Resend webhook 原始数据
  console.log('[inbound] === MAIL OBJECT ===');
  console.log('[inbound] mail.text:', mail.text ? mail.text.slice(0, 500) : 'NULL');
  console.log('[inbound] mail.html:', mail.html ? mail.html.slice(0, 300) : 'NULL');
  console.log('[inbound] mail.raw_mime length:', rawMimeB64.length);
  console.log('[inbound] mail.From:', mail.From);
  console.log('[inbound] mail.Subject:', mail.Subject);
  console.log('[inbound] mail.To:', mail.To);

  if (rawMimeB64) {
    try {
      const decoded = Buffer.from(rawMimeB64, 'base64').toString('latin1');
      console.log('[inbound] raw_mime decoded length:', decoded.length);
      console.log('[inbound] raw_mime first 500 chars:', decoded.slice(0, 500));
      mime = parseMimeMessage(decoded);
      console.log('[inbound] mime parsed - text length:', mime.text?.length, 'html length:', mime.html?.length, 'parse_failed:', mime.parse_failed);
      console.log('[inbound] mime.text:', mime.text ? mime.text.slice(0, 500) : 'NULL');
      console.log('[inbound] mime.html:', mime.html ? mime.html.slice(0, 300) : 'NULL');
    } catch (e) {
      console.warn('[inbound] raw_mime parse failed:', e);
    }
  }

  const fromRaw = mime?.headers['from'] || mail.From || '';
  const toRaw = mime?.headers['to'] || mail.To || '';
  const subject = mime ? decodeRfc2047(mime.headers['subject'] || '') : mail.Subject || '';

  let plainText = '';
  if (mime && mime.text && !mime.parse_failed) {
    plainText = mime.text;
  } else if (mime && mime.html && mime.html.length > 0) {
    // 不再限制 html 长度：QQ邮箱回复的 html 部分经常超过 2000 字符（带引用样式），
    // 旧代码直接拒绝导致客户明明回了字却显示"回复为空"。
    // 转成纯文本后只保留前 5000 字符即可。
    plainText = mime.html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|h\d|li)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const trimmed = plainText.trim();
    if (!trimmed) plainText = '';
  }

  // mime.text 是解析失败的占位符时不能用
  if (plainText.startsWith('(解析失败')) plainText = '';

  console.log('[inbound] mime.text:', mime?.text ? mime.text.slice(0, 500) : 'NULL');
  console.log('[inbound] mime.html:', mime?.html ? mime.html.slice(0, 300) : 'NULL');
  console.log('[inbound] mime.parse_failed:', mime?.parse_failed);
  console.log('[inbound] plainText after mime:', plainText ? plainText.slice(0, 500) : 'NULL');
  console.log('[inbound] mail.text:', mail.text ? mail.text.slice(0, 500) : 'NULL');
  console.log('[inbound] mail.html:', mail.html ? mail.html.slice(0, 300) : 'NULL');

  if (!plainText) {
    plainText = mail.text || mail.html || '';
    console.log('[inbound] fallback to mail.text/html, plainText:', plainText ? plainText.slice(0, 500) : 'NULL');
  }

  const body = sanitizeMimeNoise(plainText)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  console.log('[inbound] final body length:', body.length);
  console.log('[inbound] final body preview:', body.slice(0, 500));
  console.log('[inbound] === END DEBUG ===');

  if (!body) {
    console.warn('[inbound] body is empty after parsing, saving raw MIME for debugging');
  }

  traceInit(mail, body.length, rawMimeB64.length);

  const messageId = (mime?.headers['message-id'] || mail['Message-Id'] || '')
    .replace(/^<|>$/g, '')
    .trim();

  const rawInReply = (mime?.headers['in-reply-to'] || mail['In-Reply-To'] || '')
    .split(',')[0]
    .trim();
  const inReplyTo = rawInReply.replace(/^<|>$/g, '');

  const senderEmail = extractEmail(fromRaw);
  const followupEmail = extractEmail(toRaw);

  const admin = createAdminClient();

  if (inReplyTo) {
    const baseId = inReplyTo.split('@')[0];
    console.log('[inbound] inReplyTo:', inReplyTo, 'baseId:', baseId);

    // 修复 SQL 注入：用参数化查询替代字符串拼接
    console.log('[inbound] querying messages by inReplyTo...');
    const { data: msg1, error: err1 } = await admin
      .from('messages')
      .select('quote_id, direction')
      .eq('message_id', inReplyTo)
      .maybeSingle();
    console.log('[inbound] msg1 query result:', msg1 ? 'found' : 'not found', 'error:', err1);

    if (msg1) {
      return handleCustomerReply({ admin, messageId, senderEmail, subject, body, rawMimeB64, quoteId: msg1.quote_id });
    }

    console.log('[inbound] querying messages by baseId...');
    const { data: msg2, error: err2 } = await admin
      .from('messages')
      .select('quote_id, direction')
      .eq('message_id', baseId)
      .maybeSingle();
    console.log('[inbound] msg2 query result:', msg2 ? 'found' : 'not found', 'error:', err2);

    if (msg2) {
      return handleCustomerReply({ admin, messageId, senderEmail, subject, body, rawMimeB64, quoteId: msg2.quote_id });
    }

    console.log('[inbound] querying fallback quote for sender:', senderEmail);
    const { data: fallbackQuote, error: err3 } = await admin
      .from('quotes')
      .select('id')
      .eq('customer_email', senderEmail)
      .not('status', 'in', '("won","lost")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    console.log('[inbound] fallback quote result:', fallbackQuote ? 'found' : 'not found', 'error:', err3);

    if (fallbackQuote) {
      await traceWrite('handled_reply_fallback', 'quote=' + fallbackQuote.id);
      return handleCustomerReply({ admin, messageId, senderEmail, subject, body, rawMimeB64, quoteId: fallbackQuote.id });
    }
    // inReplyTo 存在但完全没配对上：不静默掉进新报价分支，直接记录并返回
    console.log('[inbound] no match found, writing reply_unmatched trace');
    await traceWrite('reply_unmatched', 'inReplyTo=' + inReplyTo + ' no msg/no fallback quote');
    return NextResponse.json({ ok: true, handled: false, reason: 'reply could not be matched to a quote' });
  }

  if (messageId && (await isDuplicateMessage(admin, messageId))) {
    await traceWrite('duplicate', 'message_id already exists');
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
    await traceWrite('no_account', 'followup=' + followupEmail + ' sender=' + senderEmail);
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
      source_raw_mime: rawMimeB64.slice(0, 50000),
      next_followup_at: scheduleForDay(quoteDate, 1).toISOString(),
    })
    .select()
    .single();

  if (qErr) {
    console.error('[inbound] insert quote error:', qErr);
    await traceWrite('error_insert_quote', qErr.message);
    return NextResponse.json({ ok: false, error: 'db error' }, { status: 500 });
  }

  await admin.from('messages').insert({
    quote_id: quote.id,
    direction: 'in',
    subject,
    body: body.slice(0, 5000),
    raw_mime: rawMimeB64.slice(0, 50000),
    message_id: messageId,
    in_reply_to: '',
  });

  console.log('[inbound] new quote created:', quote.id);
  await traceWrite('new_quote', 'quote=' + quote.id);
  return NextResponse.json({ ok: true, quote_id: quote.id });
}

async function handleCustomerReply(args: {
  admin: ReturnType<typeof createAdminClient>;
  messageId: string;
  senderEmail: string;
  subject: string;
  body: string;
  rawMimeB64: string;
  quoteId: string;
}) {
  const { admin, messageId, senderEmail, subject, body, rawMimeB64, quoteId } = args;

  console.log('[inbound] handleCustomerReply called:', { quoteId, senderEmail, subject, bodyLen: body.length });

  const { data: quote } = await admin.from('quotes').select('*').eq('id', quoteId).single();
  console.log('[inbound] quote lookup:', quote ? 'found' : 'NOT FOUND', quoteId);

  if (!quote) {
    console.warn('[inbound] quote not found, storing body only');
    await admin.from('messages').insert({
      quote_id: quoteId,
      direction: 'in',
      subject,
      body: body.slice(0, 5000),
      raw_mime: rawMimeB64.slice(0, 50000),
      message_id: messageId,
      in_reply_to: '',
    });
    return NextResponse.json({ ok: true, quote_id: quoteId, handled_orphan: true });
  }

  const { data: account } = await admin.from('accounts').select('*').eq('id', quote.account_id).single();
  console.log('[inbound] account lookup:', account ? 'found' : 'NOT FOUND', quote.account_id);

  const updateResult = await admin
    .from('quotes')
    .update({ status: 'replied', next_followup_at: null })
    .eq('id', quoteId);
  console.log('[inbound] quote update result:', JSON.stringify(updateResult));

  const insertResult = await admin.from('messages').insert({
    quote_id: quoteId,
    direction: 'in',
    subject,
    body: body.slice(0, 5000),
    raw_mime: rawMimeB64.slice(0, 50000),
    message_id: messageId,
    in_reply_to: '',
  });
  console.log('[inbound] message insert result:', JSON.stringify(insertResult));

  const bodyForAI = body || '(客户回复内容为空，请检查原始邮件)';
  const ai = await autoReply(quote.customer_name, bodyForAI, account?.business_info || {});

  let notificationText = `Customer ${quote.customer_name || senderEmail} replied to your quote (${quote.service_type || 'service'}, $${quote.amount ?? 'n/a'}).`;

  if (ai.should_reply && ai.reply_body && account?.auto_reply_enabled !== false) {
    const sent = await sendEmail({
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
      // 必须存 Resend 返回的邮件 id：客户回复时 In-Reply-To 指向它，
      // 下次才能精确配对到这条消息（旧代码存''导致回复永远配不上）
      message_id: sent?.id || '',
      in_reply_to: messageId,
    });
  }

  if (ai.is_hot) {
    notificationText += '\n🔥 HOT LEAD — customer seems ready to book. Jump on this now!';
  }
  if (ai.needs_human || !body) {
    const replyPreview = body
      ? body.slice(0, 1000)
      : '(客户回复内容为空，已保存原始邮件原文供检查)';
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
