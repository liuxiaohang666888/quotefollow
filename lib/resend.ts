import { Resend } from 'resend';

let _resend: Resend | null = null;

function client(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  fromName?: string; // 自定义发件人名称，如 "Sparkle Clean Co."
}) {
  // 邮箱格式校验：防止错误邮箱浪费配额或报错
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(opts.to)) {
    console.error('[resend] invalid email format:', opts.to);
    throw new Error('Invalid email format');
  }
  if (opts.replyTo && !emailRegex.test(opts.replyTo)) {
    console.error('[resend] invalid replyTo format:', opts.replyTo);
    throw new Error('Invalid replyTo format');
  }

  const baseFrom = process.env.RESEND_FROM_EMAIL!;
  const from = opts.fromName
    ? `${opts.fromName} <${baseFrom.replace(/.*<(.+)>/, '$1').trim()}>`
    : baseFrom;
  return client().emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    headers: {
      ...(opts.inReplyTo ? { 'In-Reply-To': opts.inReplyTo } : {}),
      ...(opts.references ? { References: opts.references } : {}),
    },
  });
}
