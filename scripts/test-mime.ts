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

const helloGb = Buffer.from([0xc4, 0xe3, 0xba, 0xc3]);
const helloExpected = new TextDecoder('gb18030').decode(helloGb);
check('sanity: gb bytes are 你好', helloExpected === '你好', helloExpected);

const subjectRaw =
  '=?utf-8?B?' + Buffer.from('Re: ', 'utf8').toString('base64') + '?=\n =?utf-8?B?' +
  Buffer.from('你好', 'utf8').toString('base64') + '?=';
const fromRaw =
  '"=?utf-8?B?' + Buffer.from('张三', 'utf8').toString('base64') + '?=" <liuxiaohang529@qq.com>';

const textB64 = helloGb.toString('base64');
const htmlB64 = Buffer.concat([helloGb, Buffer.from(' <b>hi</b>', 'ascii')]).toString('base64');
const attachB64 = Buffer.from('ATTACHMENT-DATA', 'ascii').toString('base64');

const raw = [
  'Received: from mx.qq.com by voxalo.top; Fri, 05 Sep 2026 12:00:00 +0000',
  'From: ' + fromRaw,
  'To: follow@voxalo.top',
  'Subject: ' + subjectRaw,
  'Date: Fri, 5 Sep 2026 20:00:00 +0800',
  'MIME-Version: 1.0',
  'Message-ID: <tencent_abc123@qq.com>',
  'In-Reply-To: <re_xyz@resend.dev>',
  'Content-Type: multipart/mixed; boundary="----=_Outer_001"',
  '',
  'This is a multi-part message in MIME format.',
  '',
  '------=_Outer_001',
  'Content-Type: multipart/alternative; boundary="----=_Inner_002"',
  '',
  '------=_Inner_002',
  'Content-Type: text/plain; charset="gb2312"',
  'Content-Transfer-Encoding: base64',
  '',
  textB64,
  '',
  '------=_Inner_002',
  'Content-Type: text/html; charset="gb2312"',
  'Content-Transfer-Encoding: base64',
  '',
  htmlB64,
  '',
  '------=_Inner_002--',
  '',
  '------=_Outer_001',
  'Content-Type: application/octet-stream; name="a.bin"',
  'Content-Transfer-Encoding: base64',
  'Content-Disposition: attachment; filename="a.bin"',
  '',
  attachB64,
  '',
  '------=_Outer_001--',
  '',
].join('\r\n');

const parsed = parseMimeMessage(Buffer.from(raw, 'ascii').toString('latin1'));

console.log('--- subject:', parsed.headers['subject']);
console.log('--- decoded subject:', decodeRfc2047(parsed.headers['subject'] || ''));
console.log('--- from:', parsed.headers['from']);
console.log('--- text:', JSON.stringify(parsed.text));
console.log('--- html:', JSON.stringify(parsed.html));

check('subject rfc2047 decoded', decodeRfc2047(parsed.headers['subject'] || '').includes('Re: 你好'));
check('from keeps email', (parsed.headers['from'] || '').includes('liuxiaohang529@qq.com'));
check('message-id', (parsed.headers['message-id'] || '').includes('tencent_abc123@qq.com'));
check('in-reply-to', (parsed.headers['in-reply-to'] || '').includes('re_xyz@resend.dev'));
check('text/plain gb2312 base64 decoded', parsed.text.includes('你好'), parsed.text);
check('html captured', parsed.html.includes('hi'));

const bodyPipeline = parsed.text
  .replace(/\r\n/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();
check('route body pipeline keeps 你好', bodyPipeline.includes('你好'), bodyPipeline);
check('route body has no base64 junk', !/[A-Za-z0-9+/]{40,}/.test(bodyPipeline));

const qpRaw = [
  'From: a@b.com',
  'To: c@d.com',
  'Subject: plain subject',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'caf=C3=A9 price=$10=\r\nnext line',
  '',
].join('\r\n');
const qpParsed = parseMimeMessage(Buffer.from(qpRaw, 'ascii').toString('latin1'));
console.log('--- qp text:', JSON.stringify(qpParsed.text));
check('quoted-printable decoded', qpParsed.text.includes('café'));
check('qp soft break joined', qpParsed.text.includes('$10next') || qpParsed.text.includes('$10 next'));

const plainRaw = [
  'From: a@b.com',
  'Subject: hello',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'just a plain body',
].join('\r\n');
const plainParsed = parseMimeMessage(Buffer.from(plainRaw, 'ascii').toString('latin1'));
check('simple message parsed', plainParsed.text === 'just a plain body', JSON.stringify(plainParsed.text));

console.log(failed === 0 ? 'ALL OK' : failed + ' FAILED');
process.exit(failed === 0 ? 0 : 1);
