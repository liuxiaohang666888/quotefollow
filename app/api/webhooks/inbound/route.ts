import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseMimeMessage, decodeRfc2047, sanitizeMimeNoise, ParsedMime } from '@/lib/mime';
import { parseQuoteEmail, autoReply } from '@/lib/ai';
import { sendEmail } from '@/lib/resend';
import { scheduleForDay } from '@/lib/followup';
import { resumePausedFollowupsForCustomer } from '@/lib/followup-resume';
import { isAdminEmail, FREE_QUOTA, countQuotesFor, isTrialActive, hasActiveFreeMonth } from '@/lib/paywall';
import { isValidPaypalSubscriptionId } from '@/lib/paypal';
import { isSafeSlackWebhook } from '@/lib/slack';
import { Webhook } from 'svix';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 共享密钥常量时间比较，防时序侧信道
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

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
  // 鉴权：两条合法入口，任一通过即放行；都配不上 → 401（fail-closed）
  // A. Cloudflare Email Routing → Worker 转发：X-Inbound-Secret 共享密钥
  //    （与 Vercel 环境变量 INBOUND_WEBHOOK_SECRET 一致，常量时间比较）
  // B. Resend 官方 webhook 直推：Svix 签名验签（必须使用原始请求体，
  //    任何先 JSON.parse 再 stringify 都会破坏签名导致校验失败）
  // 背景：旧代码只认 Svix，导致 Worker 转发的入站邮件全部 401 被拒——
  // "客户回复收不到"的隐形杀手；INBOUND_WEBHOOK_SECRET 全代码库无人读取。
  const payload = await req.text();
  const expectedSecret = process.env.INBOUND_WEBHOOK_SECRET;
  const workerSecret = req.headers.get('x-inbound-secret');

  let authorized = false;
  if (expectedSecret && workerSecret && safeEqual(workerSecret, expectedSecret)) {
    authorized = true; // Worker 转发路径
  } else if (process.env.RESEND_WEBHOOK_SIGNING_SECRET && req.headers.get('svix-id')) {
    try {
      const wh = new Webhook(process.env.RESEND_WEBHOOK_SIGNING_SECRET);
      wh.verify(payload, {
        'svix-id': req.headers.get('svix-id') || '',
        'svix-timestamp': req.headers.get('svix-timestamp') || '',
        'svix-signature': req.headers.get('svix-signature') || '',
      });
      authorized = true; // Resend 直推路径
    } catch {
      authorized = false;
    }
  }

  if (!authorized) {
    console.warn('[inbound] unauthorized: neither valid X-Inbound-Secret nor Svix signature');
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let mail: InboundMail;
  try {
    const parsed = JSON.parse(payload);
    // Resend email.received 与 SES 通知格式不同：Resend 为 { data: { from, to: [] } } 小写字段，
    // 直接按 InboundMail(大写 From/To) 解析会得到空值，导致 sender/followup 查不到账户。
    // 此处统一归一化为 InboundMail 风格。
    const rdata = parsed?.data && typeof parsed.data === 'object' ? parsed.data : null;
    if (rdata) {
      mail = {
        From: rdata.from || '',
        To: Array.isArray(rdata.to) ? rdata.to.join(', ') : (rdata.to || ''),
        Subject: rdata.subject || '',
        text: rdata.text || '',
        html: rdata.html || '',
        raw_mime: rdata.raw_mime || '',
        'Message-Id': rdata.messageId || rdata.message_id || '',
        'In-Reply-To': rdata.inReplyTo || rdata.in_reply_to || '',
      };
    } else {
      mail = parsed as InboundMail;
    }
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

  // 减少调试日志，生产环境保持简洁
  if (rawMimeB64) {
    try {
      const decoded = Buffer.from(rawMimeB64, 'base64').toString('latin1');
      mime = parseMimeMessage(decoded);
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

  // mime 解析没产出内容时，回退到 webhook payload 自带的 text/html
  if (!plainText) {
    plainText = mail.text || mail.html || '';
  }

  const body = sanitizeMimeNoise(plainText)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // L2 修复：邮件正文/主题属 PII，不再打进 Vercel 日志（旧代码 slice(0,500) 全量打印）。
  // 只记录长度与内容哈希，排障靠 inbound_debug 轨迹表（body_len/raw_len/result）+ 原始邮件存档。
  const bodyHash = body ? crypto.createHash('sha256').update(body).digest('hex').slice(0, 12) : 'empty';
  console.log(
    '[inbound] parsed: body_len=%d body_hash=%s mime_failed=%s has_raw=%s',
    body.length, bodyHash, mime?.parse_failed ?? false, !!rawMimeB64
  );

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
    if (msg1) {
      return handleCustomerReply({ admin, messageId, senderEmail, subject, body, rawMimeB64, quoteId: msg1.quote_id });
    }

    console.log('[inbound] querying fallback quote for sender:', senderEmail);
    const { data: fallbackQuote } = await admin
      .from('quotes')
      .select('id')
      .eq('customer_email', senderEmail)
      .not('status', 'in', '("won","lost")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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
    // M7 修复：旧代码返回 404 → Resend 对非 2xx 会重试，而"没有账号"重试也不会变出账号，
    // 纯粹浪费 AI 解析与重试额度。改 200 + trace 记录，人工在轨迹表里能看到漏配的收件箱。
    await traceWrite('no_account', 'followup=' + followupEmail + ' sender=' + senderEmail);
    console.warn('[inbound] no account for inbox:', followupEmail || senderEmail);
    return NextResponse.json({ ok: true, handled: false, reason: 'no account for this inbox' });
  }

  // 防白嫖兜底：邮件转发入口同样受免费额度限制（此前完全没查，免费用户可无限建档）
  const accountIsAdmin = isAdminEmail(account.email);
  const accountIsPaid =
    (!!account.paypal_subscription_id && isValidPaypalSubscriptionId(account.paypal_subscription_id)) ||
    hasActiveFreeMonth(account);
  if (!accountIsAdmin && !accountIsPaid) {
    // M17 修复：free_month_expires_at 为 NULL（未设置到期时间）视为免费额度可用，不拦截；
    // 仅当显式设置了到期时间且已过期时才进入额度/试用检查。
    const freeMonthExpired =
      account.free_month_expires_at != null &&
      new Date(account.free_month_expires_at).getTime() <= Date.now();
    if (freeMonthExpired) {
      const used = await countQuotesFor(admin, account.id, account.email);
      if (used >= FREE_QUOTA || !isTrialActive(account)) {
        await traceWrite(
          'quota_exhausted',
          'account=' + account.id + ' used=' + used + ' trial_ends=' + String(account.trial_ends_at)
        );
        // 通知账号主人：转发被拒绝，避免用户以为系统吞了邮件
        await notifyOwner(
          admin,
          account,
          `Free plan limit reached (${FREE_QUOTA} quotes) or 14-day trial ended. This forwarded quote was NOT saved.\nUpgrade to Pro ($49/mo) to keep capturing quotes: ${process.env.NEXT_PUBLIC_APP_URL || ''}/signup`
        );
        // M7 修复：旧代码返回 402 → Resend 重试，而额度/试用状态在重试窗口内不会变，
        // 每次重试都白跑一遍 AI 解析。改 200（trace 已记录 + 主人已收到通知）。
        return NextResponse.json({ ok: true, handled: false, reason: 'free quota exhausted or trial ended' });
      }
    }
  }

  const parsed = await parseQuoteEmail(subject, body);
  const quoteDate = parsed.quote_date ? new Date(parsed.quote_date) : new Date();

  // M7 幂等补齐：Resend 对超时/非 2xx 会重试，message_id 去重只覆盖 messages 表，
  // 覆盖不到"报价已建但响应丢了"的场景（重试会再建一条重复报价 + 双倍 AI 成本）。
  // 按 source_message_id 查重补齐这层防护（列与唯一索引见迁移 017）。
  // 兼容期：迁移未执行导致列不存在时，跳过 quote 级去重（message 级去重上面已做），
  // 插入时也不带该列，避免 PGRST204 报错。
  let sourceMessageIdSupported = true;
  if (messageId) {
    const { data: dupQuote, error: dupErr } = await admin
      .from('quotes')
      .select('id')
      .eq('source_message_id', messageId)
      .maybeSingle();
    if (dupErr) {
      sourceMessageIdSupported = false;
      console.warn('[inbound] source_message_id dedupe skipped (migration 017 not applied?):', dupErr.code);
    } else if (dupQuote) {
      await traceWrite('duplicate_quote', 'source_message_id exists, quote=' + dupQuote.id);
      return NextResponse.json({ ok: true, duplicate: true, quote_id: dupQuote.id });
    }
  }

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
      ...(sourceMessageIdSupported && messageId ? { source_message_id: messageId } : {}),
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

  // 新报价建档 = 同客户有新商机：恢复该客户此前 paused 的报价，继续自动跟进
  const resumed = await resumePausedFollowupsForCustomer(
    admin,
    account.id,
    parsed.customer_email || senderEmail,
    quote.id
  );
  console.log('[inbound] resumed paused followups for customer:', resumed);

  console.log('[inbound] new quote created:', quote.id);
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

  // 防重：回复分支同样受 message_id 唯一约束保护。同 message_id 重复回调时
  // 直接返回 200，不做任何后续处理——避免 messages insert 撞唯一索引报错后
  // 仍继续 autoReply+sendEmail，造成客户收到重复 AI 回复与 OpenAI 双倍成本。
  if (messageId && (await isDuplicateMessage(admin, messageId))) {
    console.log('[inbound] duplicate reply ignored:', messageId);
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const { data: quote } = await admin.from('quotes').select('*').eq('id', quoteId).single();

  if (!quote) {
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

    // --- 新逻辑：检测付款/拒绝关键词，决定状态（先跑，再更新） ---
    // 先剥离否定语义再匹配：旧代码 includes('paid') 子串匹配会把
    // "unpaid"/"not paid"/"未付款" 误判成已付款 → 报价被永久关闭、跟进停发，
    // 老板还以为收到钱了。中文否定（未/不/没/别/莫）同理处理。
    const negated = body
      .toLowerCase()
      .replace(/\b(?:un|not|never|no)\s*-?\s*paid\b/g, ' ')
      .replace(/\b(?:un|not|never|no)\s*-?\s*payment\b/g, ' ')
      .replace(/(?:未|不|没|别|莫)\s*(?:付款|已付|付完|结清|支付)/g, ' ');
    const PAID_PATTERNS = [/\bpaid\b/, /\binvoice paid\b/, /\bpayment (?:received|complete|completed|done|made)\b/, /\balready paid\b/, /付款/, /已付/, /付完/, /结清/];
    const STOP_PATTERNS = [/\bstop\b/, /\bunsubscribe\b/, /\bnever contact\b/, /\bdo not contact\b/, /\bremove me\b/, /\bopt out\b/, /别再发/, /不要再发/, /停止/, /退订/];
    const REFUSAL_PATTERNS = [/\bnot interested\b/, /\bno thanks\b/, /\bno thank you\b/, /\bgo away\b/, /\bleave me alone\b/, /\bdispute\b/, /争议/, /不需要/, /没兴趣/];

    const isPaid = PAID_PATTERNS.some(p => p.test(negated));
    const isStop = STOP_PATTERNS.some(p => p.test(negated));
    const isRefusal = REFUSAL_PATTERNS.some(p => p.test(negated));

    let newStatus: 'paused' | 'closed';
    let notificationText: string;

    if (isPaid || isStop || isRefusal) {
      newStatus = 'closed';
      notificationText = isPaid
        ? `✅ Client ${quote.customer_name || senderEmail} confirmed PAYMENT for quote (${quote.service_type || 'service'}, $${quote.amount ?? 'n/a'}). 🏁 Follow-ups CLOSED — payment received.`
        : `🛑 Client ${quote.customer_name || senderEmail} requested to stop contact (${quote.service_type || 'service'}, $${quote.amount ?? 'n/a'}). 🏁 Follow-ups CLOSED — explicit refusal.`;
    } else {
      newStatus = 'paused';
      notificationText = `✅ Client ${quote.customer_name || senderEmail} replied to your quote (${quote.service_type || 'service'}, $${quote.amount ?? 'n/a'}). ⏸ Follow-ups PAUSED — auto-resume on next quote/invoice.`;
    }

    // 更新状态
    const updateResult = await admin
      .from('quotes')
      .update({ status: newStatus, next_followup_at: null })
      .eq('id', quoteId);
    console.log('[inbound] quote status updated to:', newStatus);

    try {
      await admin.from('messages').insert({
        quote_id: quoteId,
        direction: 'in',
        subject,
        body: body.slice(0, 5000),
        raw_mime: rawMimeB64.slice(0, 50000),
        message_id: messageId,
        in_reply_to: '',
      });
    } catch (e: any) {
      // 唯一索引冲突（error code 23505）：并发重复回调兜底，直接返回 200
      if (e?.code === '23505' || e?.details?.includes('messages_message_id_key')) {
        console.log('[inbound] duplicate reply (db conflict) ignored:', messageId);
        return NextResponse.json({ ok: true, duplicate: true });
      }
      throw e;
    }

    const bodyForAI = body || '(客户回复内容为空，请检查原始邮件)';
    const ai = await autoReply(quote.customer_name, bodyForAI, account?.business_info || {});

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

  // Slack 通知：URL 必须是官方 hooks.slack.com（防 SSRF 打内网/云元数据）
  if (account.slack_webhook && isSafeSlackWebhook(account.slack_webhook)) {
    await fetch(account.slack_webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `QuoteFollow: ${text}\n${process.env.NEXT_PUBLIC_APP_URL}/dashboard/quotes/${quoteId}`,
      }),
    }).catch((e) => console.error('[notify] slack failed:', e));
  } else if (account.slack_webhook) {
    console.warn('[notify] slack_webhook rejected (not a hooks.slack.com https URL), skipped');
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
