// 真实 Gmail multipart/mixed 测试 - 模拟用户截图格式
import { parseMimeMessage, decodeRfc2047, sanitizeMimeNoise } from '../lib/mime.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  PASS ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}`);
  }
}

// ============ 测试 1：真实 Gmail multipart/mixed 格式 ============
console.log('\n=== 测试 1: 真实 Gmail multipart/mixed (base64 body) ===');

// 模拟截图中的格式：NextPart boundary + base64 body
const realGmailMime = [
  'From: customer@gmail.com',
  'To: follow@voxalo.top',
  'Subject: Re: Quote for window cleaning',
  'Date: Mon, 6 Sep 2026 16:25:00 -0700',
  'Message-ID: <CABc123xyz@mail.gmail.com>',
  'In-Reply-To: <abc123@api.resend.dev>',
  'References: <abc123@api.resend.dev>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed;\tboundary="----=_NextPart_69D235F_43C6A0A0_1807FF1B"',
  '',
  '------=_NextPart_69D235F_43C6A0A0_1807FF1B',
  'Content-Type: text/plain; charset="utf-8"',
  'Content-Transfer-Encoding: base64',
  '',
  'VGhpcyBpcyBhIG11bHRpLXBhcnQgbWVzc2FnZSBpbiBNSU1FIGZvcm1hdC4K',
  '------=_NextPart_69D235F_43C6A0A0_1807FF1B--',
].join('\r\n');

const result1 = parseMimeMessage(realGmailMime);
console.log('  headers keys:', Object.keys(result1.headers).join(', '));
console.log('  text:', JSON.stringify(result1.text));
console.log('  html:', JSON.stringify(result1.html));
console.log('  in-reply-to raw:', JSON.stringify(result1.headers['in-reply-to']));
console.log('  message-id raw:', JSON.stringify(result1.headers['message-id']));
assert(result1.text.includes('multi-part message in MIME format'), 'Text extracted correctly');
assert(!result1.text.includes('------=_NextPart'), 'No boundary in text');
assert(!result1.text.includes('VGhpcyBpc'), 'No base64 in text');
assert(result1.headers['in-reply-to']?.includes('abc123@api.resend.dev'), 'In-Reply-To preserved');
assert(result1.headers['message-id'] === '<CABc123xyz@mail.gmail.com>', 'Message-ID preserved');

// ============ 测试 2：Gmail multipart/alternative (text + HTML) ============
console.log('\n=== 测试 2: Gmail multipart/alternative ===');

const textBody = 'Hi John,\n\nThank you for your inquiry. We can clean your windows for $150.\n\nBest regards';
const htmlBody = '<b>Hi John,</b><br><b>Thank you</b> for your inquiry. We can clean your windows for <b>$150</b>.<br><b>Best regards</b>';

const realGmailAlt = [
  'From: boss@mybusiness.com',
  'To: follow@voxalo.top',
  'Subject: Quote for window cleaning',
  'Date: Tue, 7 Sep 2026 10:00:00 +0000',
  'Message-ID: <def456@api.resend.dev>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/alternative;\tboundary="----=_NextPart_ALT_123"',
  '',
  '------=_NextPart_ALT_123',
  'Content-Type: text/plain; charset="utf-8"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from(textBody).toString('base64'),
  '',
  '------=_NextPart_ALT_123',
  'Content-Type: text/html; charset="utf-8"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from(htmlBody).toString('base64'),
  '',
  '------=_NextPart_ALT_123--',
].join('\r\n');

const result2 = parseMimeMessage(realGmailAlt);
console.log('  text:', JSON.stringify(result2.text.slice(0, 100)));
console.log('  html:', JSON.stringify(result2.html.slice(0, 100)));
assert(result2.text.includes('Hi John'), 'Text extracted');
assert(result2.html.includes('Hi John'), 'HTML extracted');
assert(result2.html.includes('<b>'), 'HTML tags preserved');
assert(!result2.text.includes('------=_NextPart'), 'No boundary in text');

// ============ 测试 3：Outlook gb2312 编码 ============
console.log('\n=== 测试 3: Outlook multipart with gb2312 ===');

const gbkText = '你好';
const outlookMixed = [
  'From: 客户@test.com',
  'To: follow@voxalo.top',
  'Subject: =?gb2312?B?' + Buffer.from('关于报价的回复', 'utf8').toString('base64') + '?=',
  'Date: Thu, 9 Sep 2026 14:00:00 +0800',
  'Message-ID: <outlook123@outlook.com>',
  'In-Reply-To: <def789@api.resend.dev>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed;\tboundary="----=_NextPart_OUT_789"',
  '',
  '------=_NextPart_OUT_789',
  'Content-Type: text/plain; charset="gb2312"',
  'Content-Transfer-Encoding: base64',
  '',
  // "你好" 的真实 gb2312 字节 C4 E3 BA C3 → base64（Buffer 不支持 gb2312，手写正确值）
  'xOO6ww==',
  '',
  '------=_NextPart_OUT_789--',
].join('\r\n');

const result3 = parseMimeMessage(outlookMixed);
console.log('  text:', JSON.stringify(result3.text));
assert(result3.text.includes('你好'), 'Text decoded (gb2312)');

// ============ 测试 4：嵌套 multipart (multipart/related inside multipart/mixed) ============
console.log('\n=== 测试 4: Nested multipart ===');

const nestedMime = [
  'From: test@company.com',
  'To: follow@voxalo.top',
  'Subject: Quote Follow-up',
  'Date: Fri, 10 Sep 2026 11:00:00 +0000',
  'Message-ID: <nested001@mail.com>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed;\tboundary="----=_Nested_MIX"',
  '',
  '------=_Nested_MIX',
  'Content-Type: multipart/related;\tboundary="----=_Nested_REL"',
  '',
  '------=_Nested_REL',
  'Content-Type: text/plain; charset="utf-8"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('We might clean your house for $200').toString('base64'),
  '',
  '------=_Nested_REL--',
  '',
  '------=_Nested_MIX',
  'Content-Type: text/html; charset="utf-8"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('<p>We might clean your house for $200</p>').toString('base64'),
  '',
  '------=_Nested_MIX--',
].join('\r\n');

const result4 = parseMimeMessage(nestedMime);
console.log('  text:', JSON.stringify(result4.text));
console.log('  html:', JSON.stringify(result4.html));
assert(result4.text.includes('We might clean your house for $200'), 'Nested text extracted');
assert(result4.html.includes('<p>We might clean your house for $200</p>'), 'Nested HTML captured');

// ============ 测试 5：混合场景 - multipart/mixed with text + attachment ============
console.log('\n=== 测试 5: Mixed with attachment placeholder ===');

const mixedWithAttach = [
  'From: happycustomer@yahoo.com',
  'To: follow@voxalo.top',
  'Subject: I accept your quote!',
  'Date: Wed, 8 Sep 2026 09:00:00 -0400',
  'Message-ID: <XYZ789@mail.yahoo.com>',
  'In-Reply-To: <abc999@api.resend.dev>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed;\tboundary="----=_NextPart_MIX_456"',
  '',
  '------=_NextPart_MIX_456',
  'Content-Type: text/plain; charset="utf-8"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('I accept your quote ! When can you start?').toString('base64'),
  '',
  '------=_NextPart_MIX_456',
  'Content-Type: application/pdf',
  'Content-Disposition: attachment; filename="invoice.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoK',
  '',
  '------=_NextPart_MIX_456--',
].join('\r\n');

const result5 = parseMimeMessage(mixedWithAttach);
console.log('  text:', JSON.stringify(result5.text));
assert(result5.text.includes('I accept your quote'), 'Mixed text extracted');
assert(!result5.text.includes('application/pdf'), 'No PDF header in text');
assert(!result5.text.includes('JVBERi0x'), 'No PDF base64 in text');

// ============ 测试 6：老版 Worker 降级路径（生产事故复现） ============
// 场景：Cloudflare 上跑的是老版 Worker，未传 raw_mime，text 字段是 stripHeaders
// 输出的原始 MIME 垃圾（用户截图中老板通知邮件的内容）。后端必须清洗干净。
console.log('\n=== 测试 6: 老 Worker 垃圾 fallback → sanitizeMimeNoise ===');

// 截图 1 里的真实噪声样本（boundary + base64 中文）
const junkFromScreenshot = [
  'This is a multi-part message in MIME format.',
  '',
  '-------=_NextPart_6A9D3DE5_3FB1C780_492E3E3C',
  '5pON5L2g5aal77yM6IO95LiN6IO95Yir5p',
  'Ce5LqGYnJv77yfDQoNCi0tLU9yaWdpbmFs',
  'LSo',
  '',
  '-------=_NextPart_6A9D3DE5_3FB1C780_492E3E3C',
  'Content-Type: text/html; charset="utf-8"',
  '',
  'PGJyPjxkaXY+PGJyPjxkaXY+5L2g5aW96KGo56CB5q2l5L2c6L+95Yqg',
  '5rWL6K+V6YCJ5oup5oql5ZGK77yM6L+Z5Lus6L+Y5pyN6YCB5L2O6LWk',
  '-------=_NextPart_6A9D3DE5_3FB1C780_492E3E3C--',
].join('\n');

const cleaned = sanitizeMimeNoise(junkFromScreenshot);
console.log('  cleaned:', JSON.stringify(cleaned.slice(0, 120)));
assert(!cleaned.includes('NextPart'), 'No boundary marker in cleaned text');
assert(!cleaned.includes('Content-Type:'), 'No MIME header in cleaned text');
assert(!cleaned.includes('multi-part message in MIME format'), 'No preamble in cleaned text');
assert(!/^[A-Za-z0-9+/]{30,}=*\s*$/m.test(cleaned), 'No base64 junk line in cleaned text');

// 干净的普通文本必须原样通过（不能误伤正常邮件内容）
const normalText = 'Hi John,\n\nThank you for your quote! $150 for window cleaning sounds good.\n\nBest regards, Mike';
assert(sanitizeMimeNoise(normalText) === normalText, 'Normal text passes through untouched');

// 正常邮件里的长 URL / 带空格的长行不能被误删
const withUrl = 'You can view details at https://example.com/some/very/long/path/with/many/segments here';
assert(sanitizeMimeNoise(withUrl).includes('https://example.com'), 'URLs preserved');

// 决策逻辑复刻：mime 为 null 时 fallback 清洗后为空 → body 为空字符串（不把垃圾入库）
const fallbackText = junkFromScreenshot;
const plainTextFallback = fallbackText;
const bodySim = sanitizeMimeNoise(plainTextFallback).replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
assert(bodySim === '', 'Old-worker junk text sanitizes to empty body');

// mime 有正常解析结果时不受影响
const mimeTextNormal = 'Hi John,\n\nThanks for the quote! I accept.\n\nMike';
const bodyNormal = sanitizeMimeNoise(mimeTextNormal).replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
assert(bodyNormal.includes('Thanks for the quote!'), 'Normal mime text survives final sanitize');

// ============ 汇总 ============
console.log('\n========================================');
console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
if (failed > 0) {
  console.log('有失败！需要修复代码');
  process.exit(1);
} else {
  console.log('ALL OK - MIME parser handles Gmail/Outlook multipart correctly');
}
