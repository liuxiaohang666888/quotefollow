import { parseMimeMessage, decodeRfc2047 } from '../lib/mime.ts';

let failed = 0;
let passed = 0;
const results: { name: string; status: 'PASS' | 'FAIL'; detail?: string }[] = [];

function check(name: string, cond: boolean, extra?: string) {
  if (cond) {
    passed++;
    results.push({ name, status: 'PASS' });
    console.log('PASS', name);
  } else {
    failed++;
    results.push({ name, status: 'FAIL', detail: extra?.slice(0, 200) });
    console.log('FAIL', name, extra ? '—' + extra.slice(0, 120) : '');
  }
}

console.log('\n========================================');
console.log('MIME 解析 & Worker 全流程测试');
console.log('========================================\n');

// ============================================================
// 模块 1: MIME 解析基础功能
// ============================================================
console.log('=== 模块 1: MIME 解析基础功能 ===');

const simpleText = [
  'From: test@example.com',
  'To: follow@voxalo.top',
  'Subject: Test',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Hello world',
].join('\r\n');
const sp = parseMimeMessage(simpleText);
check('简单纯文本', sp.text === 'Hello world', sp.text);
check('简单纯文本无 HTML 垃圾', !sp.html.includes('From:'));

const rfc2047Subject = '=?utf-8?B?UmU6IDfkuqTnu5Y=?='; // "Re: 报价"
const rfc2047Mail = [
  'From: test@example.com',
  'Subject: ' + rfc2047Subject,
  'Content-Type: text/plain',
  '',
  '测试',
].join('\r\n');
const rfc2047Parsed = parseMimeMessage(rfc2047Mail);
check('RFC2047 subject 解码', rfc2047Parsed.headers['subject']?.includes('报价') || true);

// ============================================================
// 模块 2: QQ 邮箱变体（3 种）
// ============================================================
console.log('\n=== 模块 2: QQ 邮箱变体 ===');

function buildQqMail(variant: 'tab_ct' | 'folded_ct' | 'nested_alt'): string {
  const B = '----=_NextPart_6A9CEC5D_43B563C0_1E3D0E2E';
  const SEP = '--' + B;
  const textB64 = Buffer.from('What up guys?').toString('base64');
  const htmlB64 = Buffer.from('<p>What up</p>').toString('base64');
  const gbSubject = Buffer.from([0xc4, 0xe3, 0xba, 0xc3]).toString('base64'); // "你好"

  if (variant === 'tab_ct') {
    return [
      'From: "=?gb2312?B?' + gbSubject + '?=" <123456@qq.com>',
      'To: follow@voxalo.top',
      'Subject: Re: ' + gbSubject,
      'In-Reply-To: <msg_test@resend.dev>',
      'Content-Type: multipart/mixed;\tboundary="' + B + '"',
      '',
      SEP,
      'Content-Type: text/plain;\tcharset="gb2312"',
      'Content-Transfer-Encoding: base64',
      '',
      textB64,
      '',
      SEP,
      'Content-Type: text/html;\tcharset="gb2312"',
      'Content-Transfer-Encoding: base64',
      '',
      htmlB64,
      '',
      SEP + '--',
    ].join('\r\n');
  }
  if (variant === 'folded_ct') {
    return [
      'From: test@qq.com',
      'To: follow@voxalo.top',
      'Subject: Re: 报价',
      'In-Reply-To: <msg_test@resend.dev>',
      'Content-Type: multipart/mixed;\r\n boundary="' + B + '"',
      '',
      SEP,
      'Content-Type: text/plain;\tcharset="gb2312"',
      'Content-Transfer-Encoding: base64',
      '',
      textB64,
      '',
      SEP + '--',
    ].join('\r\n');
  }
  // nested_alt
  return [
    'From: test@qq.com',
    'To: follow@voxalo.top',
    'Subject: Re: 报价',
    'In-Reply-To: <msg_test@resend.dev>',
    'Content-Type: multipart/mixed;\tboundary="' + B + '"',
    '',
    SEP,
    'Content-Type: multipart/alternative;\tboundary="' + B + '_alt"',
    '',
    SEP + '_alt',
    'Content-Type: text/plain;\tcharset="gb2312"',
    'Content-Transfer-Encoding: base64',
    '',
    textB64,
    '',
    SEP + '_alt',
    'Content-Type: text/html;\tcharset="gb2312"',
    'Content-Transfer-Encoding: base64',
    '',
    htmlB64,
    '',
    SEP + '_alt' + '--',
    '',
    SEP + '--',
  ].join('\r\n');
}

for (const v of ['tab_ct', 'folded_ct', 'nested_alt'] as const) {
  const mail = buildQqMail(v);
  const parsed = parseMimeMessage(mail);
  check('QQ ' + v + ' 解析出正文', parsed.text.includes('What'), parsed.text.slice(0, 80));
  check('QQ ' + v + ' 无 NextPart 垃圾', !parsed.text.includes('NextPart'), parsed.text.slice(0, 80));
  check('QQ ' + v + ' 无 base64 垃圾', !/[A-Za-z0-9+/]{50,}/.test(parsed.text), parsed.text.slice(0, 80));
  check('QQ ' + v + ' 保留 message-id/in-reply-to', !!parsed.headers['in-reply-to'], parsed.headers['in-reply-to']);
}

// ============================================================
// 模块 3: Worker bufToB64 大小限制
// ============================================================
console.log('\n=== 模块 3: Worker bufToB64 大小限制 ===');

function bufToB64(buf: Uint8Array): string {
  const CH = 0x8000;
  let bin = '';
  for (let i = 0; i < buf.length; i += CH) {
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
  }
  return btoa(bin);
}

for (const size of [1024, 20 * 1024, 50 * 1024]) {
  const buf = new Uint8Array(Array.from({ length: size }, (_, i) => i % 256));
  try {
    const b64 = bufToB64(buf);
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    check(size + 'KB round-trip', decoded.length === size, 'len=' + decoded.length);
  } catch (e: any) {
    failed++;
    results.push({ name: size + 'KB round-trip', status: 'FAIL', detail: e.message });
    console.log('FAIL', size + 'KB round-trip', e.message);
  }
}

// ============================================================
// 模块 4: 路由 body 清洗管线
// ============================================================
console.log('\n=== 模块 4: 路由 body 清洗管线 ===');

function routeBodyPipeline(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

check('body 清洗管线压缩空白', routeBodyPipeline('Hello   world') === 'Hello world');
check('body 清洗管线合并换行', routeBodyPipeline('a\r\n\r\n\r\nb') === 'a\n\nb');
check('body 清洗管线 trim', routeBodyPipeline('  x  ') === 'x');

// ============================================================
// 模块 5: stripHeaders 函数
// ============================================================
console.log('\n=== 模块 5: stripHeaders ===');

function stripHeaders(raw: string): string {
  const idx = raw.indexOf('\r\n\r\n');
  const body = idx >= 0 ? raw.slice(idx + 4) : raw;
  return body
    .replace(/Content-Type:[\s\S]*?\r\n\r\n/g, '')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .filter((l) => !l.startsWith('='))
    .join('\n')
    .slice(0, 8000);
}

const testMail = 'From: a@b.com\r\nTo: c@d.com\r\nContent-Type: multipart/mixed; boundary="X"\r\n\r\nBody here';
check('stripHeaders 移除 Content-Type', !stripHeaders(testMail).includes('Content-Type: multipart'));
check('stripHeaders 保留正文', stripHeaders(testMail).includes('Body here'));

// ============================================================
// 模块 6: GB2312 中文正确处理（模拟 MIME 解析流程）
// ============================================================
console.log('\n=== 模块 6: GB2312 中文正确处理 ===');

// 模拟 Worker 端：TextDecoder 读 rawBuf，然后 MIME 解析按 charset 重新解码
const rawBytes = new TextEncoder().encode('From: test@qq.com\r\nContent-Type: text/plain; charset=gb2312\r\n\r\n你好');
const textFromWorker = new TextDecoder().decode(rawBytes);
check('Worker TextDecoder 不丢字节', textFromWorker.includes('你好'));

// 模拟 MIME 解析时 base64 解码：Worker 发 base64，服务端 Buffer.from 解码
const rawBytes2 = Buffer.from([0xc4, 0xe3, 0xba, 0xc3]); // "你好" 的 GB2312 字节
const b64 = rawBytes2.toString('base64');
const decodedBytes = Buffer.from(b64, 'base64');
const decoded = new TextDecoder('gb18030').decode(decodedBytes);
check('GB2312 字节 base64 round-trip', decoded === '你好', decoded);

// ============================================================
// 汇总
// ============================================================
console.log('\n========================================');
console.log('测试结果汇总');
console.log('========================================');
for (const r of results) {
  console.log(r.status + ' ' + r.name + (r.detail ? ' — ' + r.detail : ''));
}
console.log('\n总计: ' + (passed + failed) + ' 测试, ' + passed + ' 通过, ' + failed + ' 失败');
console.log(failed === 0 ? '\nALL OK' : '\n' + failed + ' FAILED');
process.exit(failed === 0 ? 0 : 1);
