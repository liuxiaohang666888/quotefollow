import { Resend } from 'resend';

let _resend: Resend | null = null;

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');
  if (!_resend) _resend = new Resend(apiKey);
  return _resend;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  fromName?: string;
}) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(opts.to)) {
    console.error('[resend] invalid email format:', opts.to);
    throw new Error('Invalid email format');
  }
  if (opts.replyTo && !emailRegex.test(opts.replyTo)) {
    console.error('[resend] invalid replyTo format:', opts.replyTo);
    throw new Error('Invalid replyTo format');
  }

  const baseFrom = process.env.RESEND_FROM_EMAIL;
  if (!baseFrom) throw new Error('RESEND_FROM_EMAIL is not set');
  const fromAddr = baseFrom.replace(/.*<(.+)>/, '$1').trim() || baseFrom;
  const from = opts.fromName ? `${opts.fromName} <${fromAddr}>` : baseFrom;

  return getClient().emails.send({
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
