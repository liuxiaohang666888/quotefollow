import OpenAI from 'openai';

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    // 硬超时 15s：AI 供应商挂死/排队（免费档低并发）时快速失败，
    // 抛出的超时错误会被各调用点的 catch 捕获，走既有降级路径（正则解析/转人工/模板兜底）
    timeout: 15000,
    // 不自动重试：所有调用点都有降级兜底，快速失败比排队重试更稳
    maxRetries: 0,
  });
}

export interface ParsedQuote {
  customer_email: string;
  customer_name: string;
  amount: number | null;
  service_type: string;
  quote_date: string; // YYYY-MM-DD
}

const PARSE_SYSTEM = `You extract quote details from an email a small business owner forwarded to an AI assistant.
The email may be an original quote the owner sent to a customer, OR a forwarded chain containing it.
Output JSON only with exactly these keys:
- customer_email: the customer's email address (if the email is TO the owner, the customer email may be in the signature or absent — use best guess, or "" if unknown)
- customer_name: the customer's name ("" if unknown)
- amount: the quoted price as a number, or null if no price mentioned
- service_type: one short phrase describing the service (e.g. "house cleaning", "moving", "lawn mowing")
- quote_date: the date the quote was sent, as YYYY-MM-DD (use today's date if not stated)
Never invent an email address. If you cannot determine customer email, return "" for it.`;

// AI 不可用时的正则兜底解析：保证 AI 挂了也能把报价建上档（字段不全总比丢邮件强）
function fallbackParse(subject: string, body: string): ParsedQuote {
  const email = body.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] || '';
  const amountMatch = body.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;
  return {
    customer_email: email,
    customer_name: '',
    amount: amount && amount > 0 ? amount : null,
    service_type: subject.replace(/^re:\s*/i, '').replace(/\bquote\b/gi, '').trim().slice(0, 60),
    quote_date: new Date().toISOString().slice(0, 10),
  };
}

export async function parseQuoteEmail(
  subject: string,
  body: string
): Promise<ParsedQuote> {
  const client = getClient();
  let raw = '';
  try {
    const res = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PARSE_SYSTEM },
        {
          role: 'user',
          content: `Subject: ${subject}\n\nBody:\n${body.slice(0, 12000)}`,
        },
      ],
    });
    raw = res.choices[0]?.message?.content || '';
  } catch (e) {
    // AI 服务挂掉/超时/欠费：不能让整条建档链路崩掉，降级到正则解析
    console.error('[ai] parseQuoteEmail API failed, using regex fallback:', e);
    return fallbackParse(subject, body);
  }

  try {
    const p = JSON.parse(raw) as ParsedQuote;
    return {
      customer_email: (p.customer_email || '').trim(),
      customer_name: (p.customer_name || '').trim(),
      amount: typeof p.amount === 'number' && p.amount > 0 ? p.amount : null,
      service_type: (p.service_type || '').trim(),
      quote_date: p.quote_date || new Date().toISOString().slice(0, 10),
    };
  } catch {
    return fallbackParse(subject, body);
  }
}

// ============ 自动回复 / 热单判断 ============

export interface AutoReplyResult {
  should_reply: boolean;
  reply_body: string;
  is_hot: boolean; // 客户回复积极 = 热单
  needs_human: boolean; // 答不了，转人工
}

const REPLY_SYSTEM = `You are the friendly AI assistant of a small service business (cleaning, moving, lawn care, handyman, etc.).
A customer replied to a quote. Decide what to do.
Business facts (use them when answering): {{BUSINESS_INFO}}

Rules:
- If the customer is asking a common question (availability/schedule, deposit, timeline/how long it takes, what's included), answer it helpfully and briefly using the business facts. Set should_reply=true, is_hot=false, needs_human=false.
- If the customer sounds ready to book or very interested ("let's do it", "yes please", "when can you start"), reply enthusiastically to confirm next steps, set should_reply=true, is_hot=true, needs_human=false.
- If you cannot answer confidently (unusual question, complaint, or business facts are empty), set should_reply=false, needs_human=true.
- NEVER invent facts (prices, availability) that are not in the business facts. If facts are missing, reply that you'll have the owner confirm.
Output JSON only with keys: should_reply (bool), reply_body (string, the email reply text, plain text, max 120 words), is_hot (bool), needs_human (bool).`;

export async function autoReply(
  customerName: string,
  customerReply: string,
  businessInfo: Record<string, unknown>
): Promise<AutoReplyResult> {
  const client = getClient();
  const biz = Object.entries(businessInfo)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n') || '(empty — do not invent facts)';

  let raw = '';
  try {
    const res = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: REPLY_SYSTEM.replace('{{BUSINESS_INFO}}', biz) },
        {
          role: 'user',
          content: `Customer: ${customerName || 'there'}\n\nCustomer's reply:\n${customerReply.slice(0, 4000)}`,
        },
      ],
    });
    raw = res.choices[0]?.message?.content || '';
  } catch (e) {
    // AI 挂了：不敢瞎回客户，转人工处理
    console.error('[ai] autoReply API failed, escalating to human:', e);
    return { should_reply: false, reply_body: '', is_hot: false, needs_human: true };
  }

  try {
    const r = JSON.parse(raw) as AutoReplyResult;
    return {
      should_reply: !!r.should_reply,
      reply_body: (r.reply_body || '').trim(),
      is_hot: !!r.is_hot,
      needs_human: !!r.needs_human,
    };
  } catch {
    return { should_reply: false, reply_body: '', is_hot: false, needs_human: true };
  }
}

// ============ 跟进邮件正文生成 ============

const FOLLOWUP_SYSTEM = `You write short, warm, plain-text follow-up emails for a small service business following up on a sent quote.
Customer has NOT replied yet. Keep it 3-4 sentences max, no fluff, no hard-sell, friendly and professional.
Vary slightly by followup number:
- Followup 1 (1 day after quote): gentle check-in, "just making sure you got it".
- Followup 2 (3 days): add a small value line or common question answer.
- Followup 3 (7 days): soft closing, "quote stays valid / happy to adjust".
Sign off with: {{SIGNATURE}}`;

export async function generateFollowupBody(
  followupNumber: 1 | 2 | 3,
  customerName: string,
  serviceType: string,
  amount: number | null,
  businessName: string,
  businessInfo: Record<string, unknown>
): Promise<string> {
  const client = getClient();
  const biz = Object.entries(businessInfo)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n') || '(none)';

  const fromEmail = (process.env.RESEND_FROM_EMAIL || '').match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] || '';
  const signature = `${businessName || 'Your team'}\n(${fromEmail})`;

  let raw = '';
  try {
    const res = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        { role: 'system', content: FOLLOWUP_SYSTEM.replace('{{SIGNATURE}}', signature) },
        {
          role: 'user',
          content: `Followup #${followupNumber}. Customer: ${customerName || 'there'}. Service: ${serviceType || 'our service'}. Quoted amount: ${amount ? '$' + amount : 'not specified'}.\nBusiness facts: ${biz}`,
        },
      ],
    });
    raw = res.choices[0]?.message?.content || '';
  } catch (e) {
    // AI 挂了：用模板兜底，跟进邮件照发（cron 每天跑，不能因 AI 抖动整体崩掉）
    console.error('[ai] generateFollowupBody API failed, using template:', e);
    return defaultFollowup(followupNumber, customerName, businessName);
  }

  return raw.trim() || defaultFollowup(followupNumber, customerName, businessName);
}

function defaultFollowup(n: 1 | 2 | 3, name: string, businessName: string): string {
  const greeting = `Hi ${name || 'there'},`;
  const lines: Record<number, string[]> = {
    1: [greeting, 'Just checking in — did you get a chance to look at the quote I sent? Happy to answer any questions.', 'Thanks!'],
    2: [greeting, 'Following up once more on my quote. If timing or scope is a concern, I\'m happy to adjust — just let me know.', 'Thanks!'],
    3: [greeting, 'One last note on my quote — it\'s still valid if you\'d like to move forward. If not, no worries at all.', 'Thanks!'],
  };
  return lines[n].join('\n\n') + `\n\n${businessName || '—'}`;
}
