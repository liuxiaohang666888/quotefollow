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
