// Deep trace: simulate what a real Gmail email looks like end-to-end
import { parseMimeMessage } from '../lib/mime.ts';

// Simulate a real Gmail reply exactly as it arrives at the worker
// This is what Cloudflare Email Routing sends
const realGmailReply = `From: john.smith@gmail.com
To: follow@voxalo.top
Subject: Re: Quote for patio deck repair
Date: Mon, 06 Sep 2026 10:30:00 -0700
Message-ID: <CABc123xyz@mail.gmail.com>
In-Reply-To: <abc123@api.resend.dev>
References: <abc123@api.resend.dev>
MIME-Version: 1.0
Content-Type: multipart/alternative;
\tboundary="000000000000abcd1234567890"

--000000000000abcd1234567890
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

Hi there,=20
=20
I would like to accept your quote for the patio deck repair. =20
The price of $200 sounds fair. =20
=20
When can you start?=20
=20
Thanks,=20
John
--000000000000abcd1234567890
Content-Type: text/html; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

<html><body><p>Hi there,</p><p>I would like to accept your quote for the patio deck repair. The price of $200 sounds fair.</p><p>When can you start?</p><p>Thanks,<br>John</p></body></html>
--000000000000abcd1234567890--`;

console.log('=== Simulating real Gmail reply ===');
console.log('Raw length:', realGmailReply.length);

// Step 1: What the worker does
const textDecoder = new TextDecoder();
const rawBuf = Buffer.from(realGmailReply, 'utf8');
const rawB64 = rawBuf.toString('base64');
console.log('Worker: raw_mime b64 length:', rawB64.length);

// Step 2: What backend receives
const mail = {
  From: 'john.smith@gmail.com',
  To: 'follow@voxalo.top',
  Subject: 'Re: Quote for patio deck repair',
  text: '',  // multipart = empty
  raw_mime: rawB64,
  'Message-Id': '<CABc123xyz@mail.gmail.com>',
  'In-Reply-To': '<abc123@api.resend.dev>',
};

// Step 3: Decode in backend
const decoded = Buffer.from(mail.raw_mime, 'base64').toString('latin1');
console.log('Backend: decoded length:', decoded.length);
console.log('Backend: first 200 chars:', decoded.slice(0, 200));

// Step 4: Parse MIME
const mime = parseMimeMessage(decoded);
console.log('Parsed headers keys:', Object.keys(mime.headers).join(', '));
console.log('Parsed text:', JSON.stringify(mime.text));
console.log('Parsed html:', JSON.stringify(mime.html.slice(0, 100)));

// Step 5: Simulate route.ts body extraction
let plainText = '';
if (mime) {
  if (mime.text) {
    plainText = mime.text;
    console.log('Using mime.text, length:', plainText.length);
  } else if (mime.html) {
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
    console.log('Using mime.html, length:', plainText.length);
  }
}
if (!plainText) {
  plainText = mail.text || mail.html || '';
  console.log('Fell back to mail.text/mail.html');
}

// Step 6: sanitize
const sanitizeMimeNoise = (input: string) => {
  if (!input) return input || '';
  if (
    !/NextPart|mimepart/i.test(input) &&
    !/^Content-[\w-]+\s*:/im.test(input) &&
    !/MIME-Version\s*:/i.test(input)
  ) {
    return input;
  }
  const B64_LINE = /^[A-Za-z0-9+/]{30,}=*\s*$/;
  const B64_FRAG = /^[A-Za-z0-9+/=]+\s*$/;
  const out: string[] = [];
  let b64Run = 0;
  for (const raw of input.split(/\r?\n/)) {
    const t = raw.trim();
    if (/^-{2,}=?_?(NextPart|mimepart|Part)_/i.test(t)) { b64Run = 0; continue; }
    if (/^-{5,}[A-Za-z0-9_.=+-]{10,}$/.test(t)) { b64Run = 0; continue; }
    if (/^(Content-[\w-]+|MIME-Version)\s*:/i.test(t)) continue;
    if (/^This is a multi-part message in MIME format\.?$/i.test(t)) continue;
    if (B64_LINE.test(t)) { b64Run++; continue; }
    if (b64Run > 0 && B64_FRAG.test(t)) continue;
    b64Run = 0;
    out.push(raw);
  }
  return out.join('\n');
};

const body = sanitizeMimeNoise(plainText)
  .replace(/\r\n/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

console.log('\n=== FINAL RESULT ===');
console.log('Body length:', body.length);
console.log('Body preview:', body.slice(0, 300));
console.log('Body empty?', body.length === 0);
