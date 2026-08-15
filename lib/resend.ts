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
  inReplyTo?: string; // 邮件 threading：客户回复时能对上
  references?: string;
}) {
  return client().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
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
