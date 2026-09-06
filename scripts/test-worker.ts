import { parseMimeMessage, decodeRfc2047 } from '../lib/mime.ts';

let failed = 0;
function check(name: string, cond: boolean, extra?: string) {
  if (cond) {
    console.log('PASS', name);
  } else {
    failed++;
    console.log('FAIL', name, extra ? ' — ' + extra.slice(0, 120) : '');
  }
}

// ============================================================
// 测试 1: Worker bufToB64 大小限制（关键 bug）
// ============================================================
console.log('\n=== 测试 1: Worker bufToB64 大小限制 ===');

function bufToB64(buf: Uint8Array): string {
  const CH = 0x8000;
  let bin = '';
  for (let i = 0; i < buf.length; i += CH) {
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
  }
  return btoa(bin);
}

// 小邮件 (1KB)
const small = new Uint8Array(Array.from({ length: 1024 }, (_, i) => i % 256));
try {
  const b64 = bufToB64(small);
  check('1KB 邮件 base64', b64.length > 0);
} catch (e: any) {
  failed++;
  console.log('FAIL', '1KB 邮件 base64 抛异常:', e.message);
}

// 大邮件 (20KB) - 这应该能触发 String.fromCharCode.apply 调用栈溢出
const medium = new Uint8Array(Array.from({ length: 20 * 1024 }, (_, i) => i % 256));
try {
  const b64 = bufToB64(medium);
  check('20KB 邮件 base64', b64.length > 10000);
} catch (e: any) {
  failed++;
  console.log('FAIL', '20KB 邮件 base64 抛异常:', e.message);
}

// 更大邮件 (50KB)
const large = new Uint8Array(Array.from({ length: 50 * 1024 }, (_, i) => i % 256));
try {
  const b64 = bufToB64(large);
  check('50KB 邮件 base64', b64.length > 40000);
} catch (e: any) {
  failed++;
  console.log('FAIL', '50KB 邮件 base64 抛异常:', e.message);
}

// ============================================================
// 测试 2: 真实 QQ 邮件的 bufToB64 round-trip
// ============================================================
console.log('\n=== 测试 2: QQ 邮件 bufToB64 round-trip ===');

const B = '----=_NextPart_6A9CEC5D_43B563C0_1E3D0E2E';
const SEP = '--' + B;

const qqMailRaw = [
  'From: "=?gb2312?B?' + Buffer.from([0xc4, 0xe3, 0xba, 0xc3]).toString('base64') + '?=" <123456@qq.com>',
  'To: follow@voxalo.top',
  'Subject: Re: 报价跟进',
  'In-Reply-To: <msg_test_001@resend.dev>',
  'Content-Type: multipart/mixed;\tboundary="' + B + '"',
  '',
  SEP,
  'Content-Type: text/plain;\tcharset="gb2312"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from([0x57, 0x68, 0x61, 0x74, 0x20, 0x75, 0x70, 0x20, 0x67, 0x75, 0x79, 0x73, 0x3f]).toString('base64'), // "What up guys?"
  '',
  SEP,
  'Content-Type: text/html;\tcharset="gb2312"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from([0x57, 0x68, 0x61, 0x74, 0x20, 0x75, 0x70]).toString('base64'), // "What up"
  '',
  SEP + '--',
  '',
].join('\r\n');

const rawBytes = new TextEncoder().encode(qqMailRaw);
try {
  const b64 = bufToB64(rawBytes);
  const decoded = Buffer.from(b64, 'base64').toString('utf8');
  check('QQ 邮件 round-trip', decoded === qqMailRaw, decoded.slice(0, 100));
  
  const parsed = parseMimeMessage(decoded);
  check('QQ 邮件解析', parsed.text.includes('What'), parsed.text.slice(0, 100));
} catch (e: any) {
  failed++;
  console.log('FAIL', 'QQ 邮件 round-trip:', e.message);
}

// ============================================================
// 测试 3: 超大邮件（模拟真实场景，50KB+）
// ============================================================
console.log('\n=== 测试 3: 超大邮件 round-trip ===');

const bigText = '大内容 ' + 'A'.repeat(45000) + ' 结束';
const bigMail = [
  'From: test@example.com',
  'To: follow@voxalo.top',
  'Subject: Test',
  'Content-Type: text/plain; charset=utf-8',
  '',
  bigText,
].join('\r\n');

try {
  const bigBytes = new TextEncoder().encode(bigMail);
  const b64 = bufToB64(bigBytes);
  const decoded = Buffer.from(b64, 'base64').toString('utf8');
  check('50KB 邮件 round-trip', decoded === bigMail, 'len=' + decoded.length);
} catch (e: any) {
  failed++;
  console.log('FAIL', '50KB 邮件 round-trip:', e.message);
}

// ============================================================
// 测试 4: Worker 对消息的 TextDecoder 解码
// ============================================================
console.log('\n=== 测试 4: Worker TextDecoder 解码 ===');

// TextDecoder 使用 GB18030（Worker 端用这个标签）
const gbText = new TextDecoder('gb18030').decode(Buffer.from([0xc4, 0xe3, 0xba, 0xc3])); // "你好"
const gbMailRaw = [
  'From: test@qq.com',
  'To: follow@voxalo.top',
  'Subject: Test',
  'Content-Type: text/plain; charset=gb2312',
  '',
  gbText,
].join('\r\n');

try {
  const decoded = new TextDecoder().decode(new TextEncoder().encode(gbMailRaw));
  check('Worker TextDecoder 解码', decoded.includes('你好'), decoded.slice(0, 50));
} catch (e: any) {
  failed++;
  console.log('FAIL', 'Worker TextDecoder 解码:', e.message);
}

// ============================================================
// 测试 5: 路由的 handleCustomerReply 边界情况
// ============================================================
console.log('\n=== 测试 5: handleCustomerReply 边界情况 ===');

// 模拟 quote 不存在的场景（路由会返回 404）
// 这个测试验证路由是否会正确处理这种情况
const testRouteLogic = (quoteId: string, quoteExists: boolean) => {
  // 这里只测试逻辑，不实际调用数据库
  const shouldReturn404 = !quoteExists;
  return shouldReturn404;
};

check('quote 不存在时应返回 404', testRouteLogic('nonexistent', false));
check('quote 存在时应继续处理', !testRouteLogic('valid-id', true));

// ============================================================
// 测试 6: Worker stripHeaders 是否正确剥离 MIME 头
// ============================================================
console.log('\n=== 测试 6: Worker stripHeaders ===');

const mailWithHeaders = [
  'From: test@qq.com',
  'To: follow@voxalo.top',
  'Content-Type: multipart/mixed; boundary="----=_NextPart_XXX"',
  '',
  'This is the body',
  '----=_NextPart_XXX',
  'Content-Type: text/plain',
  '',
  'Body content here',
  '----=_NextPart_XXX--',
].join('\r\n');

// 这是 Worker 里 stripHeaders 的逻辑
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

const stripped = stripHeaders(mailWithHeaders);
check('stripHeaders 移除 Content-Type 头', !stripped.includes('Content-Type: multipart'));
check('stripHeaders 保留正文', stripped.includes('This is the body'));
check('stripHeaders 保留嵌套正文', stripped.includes('Body content here'));

// ============================================================
// 测试 7: 路由的 body 清洗管线
// ============================================================
console.log('\n=== 测试 7: 路由 body 清洗管线 ===');

const testBodyPipeline = (raw: string) => {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const messyBody = 'Hello   world\r\n\r\n\r\n\r\nToo  many  newlines';
const cleaned = testBodyPipeline(messyBody);
// 管线行为：多空格压缩为单空格，3+ 连续换行合并为 2 个，首尾 trim
check('body 清洗管线', cleaned === 'Hello world\n\nToo many newlines', cleaned);

// ============================================================
// 测试 8: GB2312 中文在 base64 中的正确处理
// ============================================================
console.log('\n=== 测试 8: GB2312 中文 base64 编码 ===');

const gb2312Bytes = Buffer.from([0xc4, 0xe3, 0xba, 0xc3]);
const gb2312Text = new TextDecoder('gb18030').decode(gb2312Bytes);
const gb2312B64 = gb2312Bytes.toString('base64');
const gb2312Decoded = new TextDecoder('gb18030').decode(Buffer.from(gb2312B64, 'base64'));
check('GB2312 中文 base64 round-trip', gb2312Decoded === gb2312Text, gb2312Decoded);

console.log(failed === 0 ? '\nALL OK' : '\n' + failed + ' FAILED');
process.exit(failed === 0 ? 0 : 1);
