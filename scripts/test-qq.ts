import { parseMimeMessage, decodeRfc2047 } from '../lib/mime.ts';

let failed = 0;
function check(name: string, cond: boolean, extra?: string) {
  if (cond) {
    console.log('PASS', name);
  } else {
    failed++;
    console.log('FAIL', name, extra || '');
  }
}

const B = '----=_NextPart_6A9CEC5D_43B563C0_1E3D0E2E';
const SEP = '--' + B;

const replyText =
  'What up guys?\r\n' +
  '\r\n' +
  '\r\n' +
  '\r\n' +
  '---Original---\r\n' +
  'From: "QuoteFollow" <follow@voxalo.top>\r\n' +
  'To: 123456@qq.com\r\n' +
  'Subject: =?utf-8?B?' + Buffer.from(' Patio deck repair', 'utf8').toString('base64') + '?=\r\n' +
  'Date: Sun, 6 Sep 2026 04:00:00 +0000\r\n' +
  '\r\n' +
  'Hi John,\r\n' +
  '\r\n' +
  'Just following up on the quote I sent last week. Are you still interested in the patio repair?\r\n' +
  '\r\n' +
  'Best,\r\n' +
  'QuoteFollow';

const replyHtml =
  '<html><body>What up guys?<br><br><br>---Original---<br>From: "QuoteFollow" &lt;follow@voxalo.top&gt;<br><br>Just following up on the quote...</body></html>';

function wrapB64(s: string): string {
  const raw = Buffer.from(s, 'utf8').toString('base64');
  const lines: string[] = [];
  for (let i = 0; i < raw.length; i += 60) lines.push(raw.slice(i, i + 60));
  return lines.join('\r\n');
}

function buildQQ(opts: { foldTopCt: boolean; nestedAlt: boolean }): string {
  const gbHello = Buffer.from([0xc4, 0xe3, 0xba, 0xc3]);
  const textPart =
    SEP + '\r\n' +
    'Content-Type: text/plain;\tcharset="gb2312"\r\n' +
    'Content-Transfer-Encoding: base64\r\n' +
    '\r\n' +
    wrapB64(replyText) + '\r\n' +
    '\r\n';

  const htmlPart =
    SEP + '\r\n' +
    'Content-Type: text/html;\tcharset="gb2312"\r\n' +
    'Content-Transfer-Encoding: base64\r\n' +
    '\r\n' +
    wrapB64(replyHtml) + '\r\n' +
    '\r\n';

  let bodyParts: string;
  if (opts.nestedAlt) {
    bodyParts =
      'This is a multi-part message in MIME format.\r\n' +
      '\r\n' +
      SEP + '\r\n' +
      'Content-Type: multipart/alternative;\tboundary="----=_InnerAlt_777"\r\n' +
      '\r\n' +
      textPart +
      htmlPart +
      SEP + '--\r\n' +
      '\r\n';
  } else {
    bodyParts =
      'This is a multi-part message in MIME format.\r\n' +
      '\r\n' +
      textPart +
      htmlPart +
      SEP + '--\r\n' +
      '\r\n';
  }

  const topCt = opts.foldTopCt
    ? 'Content-Type: multipart/mixed;\r\n boundary="' + B + '"'
    : 'Content-Type: multipart/mixed;\tboundary="' + B + '"';

  return [
    'Received: from smtp.qq.com by mx.voxalo.top; Sun, 06 Sep 2026 04:30:11 +0000',
    'X-QQ-mid: qmailtest',
    'From: "=?gb2312?B?' + Buffer.from(gbHello).toString('base64') + '?=" <123456@qq.com>',
    'To: follow@voxalo.top',
    'Subject: =?gb2312?B?' + Buffer.from('Re: ', 'latin1').toString('base64') + '?= =?gb2312?B?' + Buffer.from([0xd7, 0xd4, 0xd2, 0xd1, 0xb6, 0xa8, 0xd6, 0xc6], 'binary').toString('base64') + '?=',
    'Date: Sun, 6 Sep 2026 12:30:11 +0800',
    'Message-ID: <tencent_6A9CEC5D_43B563C0@qq.com>',
    'In-Reply-To: <msg_test_001@resend.dev>',
    'MIME-Version: 1.0',
    topCt,
    '',
    bodyParts,
  ].join('\r\n');
}

function routeBody(p: { text: string; html: string }): string {
  const plainText = p.text || p.html || '';
  return plainText
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

for (const variant of [
  { name: 'QQ mixed flat (tab-joined CT)', opts: { foldTopCt: false, nestedAlt: false } },
  { name: 'QQ folded top CT (newline+space)', opts: { foldTopCt: true, nestedAlt: false } },
  { name: 'QQ nested alternative', opts: { foldTopCt: false, nestedAlt: true } },
] as const) {
  console.log('\n=== variant:', variant.name, '===');
  const raw = buildQQ(variant.opts);
  const latin1 = Buffer.from(raw, 'latin1').toString('latin1');
  const parsed = parseMimeMessage(latin1);

  console.log('  subject decoded:', JSON.stringify(decodeRfc2047(parsed.headers['subject'] || '')));
  console.log('  from:', JSON.stringify(parsed.headers['from']));
  console.log('  text head:', JSON.stringify((parsed.text || '').slice(0, 80)));
  const body = routeBody(parsed);
  check(variant.name + ' :: text has reply', (parsed.text || '').includes('What up guys?'), JSON.stringify((parsed.text || '').slice(0, 200)));
  check(variant.name + ' :: gb2312 subject ok', decodeRfc2047(parsed.headers['subject'] || '').length > 0);
  check(variant.name + ' :: no NextPart junk', !body.includes('NextPart'), body.slice(0, 200));
  check(variant.name + ' :: no base64 junk', !/[A-Za-z0-9+/]{50,}/.test(body));
  check(variant.name + ' :: message-id', (parsed.headers['message-id'] || '').includes('tencent_6A9CEC5D'));
  check(variant.name + ' :: in-reply-to', (parsed.headers['in-reply-to'] || '').includes('msg_test_001@resend.dev'));
  check(variant.name + ' :: from email kept', (parsed.headers['from'] || '').includes('123456@qq.com'));
}

console.log(failed === 0 ? '\nALL OK' : '\n' + failed + ' FAILED');
process.exit(failed === 0 ? 0 : 1);
