// 完整 MIME 解析测试 - 5 种邮件格式全覆盖
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

// ============ 测试 1：普通纯文本回信 ============
console.log('\n=== 测试 1: 普通纯文本回信 ===');

const plainTextEmail = [
  'From: customer@example.com',
  'To: follow@voxalo.top',
  'Subject: Re: Quote for window cleaning',
  'Date: Mon, 6 Sep 2026 16:25:00 -0700',
  'Message-ID: <plain001@mail.com>',
  'In-Reply-To: <abc123@api.resend.dev>',
  '',
  'Hi John,',
  '',
  'Thank you for your quote. I would like to proceed with the window cleaning service.',
  'Can you start next Monday?',
  '',
  'Best regards',
  'Mike',
].join('\r\n');

const result1 = parseMimeMessage(plainTextEmail);
console.log('  text:', JSON.stringify(result1.text.slice(0, 100)));
assert(result1.text.includes('Thank you for your quote'), 'Plain text extracted');
assert(!result1.parse_failed, 'Parse not failed');

// ============ 测试 2：HTML 格式回信（Outlook 最常见） ============
console.log('\n=== 测试 2: HTML 格式回信 ===');

const htmlEmail = [
  'From: boss@mybusiness.com',
  'To: follow@voxalo.top',
  'Subject: Quote for window cleaning',
  'Date: Tue, 7 Sep 2026 10:00:00 +0000',
  'Message-ID: <html001@mail.com>',
  'MIME-Version: 1.0',
  'Content-Type: text/html; charset="utf-8"',
  '',
  '<html><body><p>Hi John,</p><p>Thank you for your inquiry. We can clean your windows for <b>$150</b>.</p><p>Best regards</p></body></html>',
].join('\r\n');

const result2 = parseMimeMessage(htmlEmail);
console.log('  text:', JSON.stringify(result2.text.slice(0, 100)));
console.log('  html:', JSON.stringify(result2.html.slice(0, 100)));
assert(result2.text.includes('Hi John'), 'HTML text extracted');
assert(result2.text.includes('$150'), 'HTML text has price');
assert(result2.html.includes('<b>'), 'HTML preserved');
assert(!result2.parse_failed, 'Parse not failed');

// ============ 测试 3：多层嵌套 MIME 回信（最高优先级） ============
console.log('\n=== 测试 3: 多层嵌套 MIME 回信 ===');

const nestedEmail = [
  'From: test@company.com',
  'To: follow@voxalo.top',
  'Subject: Quote Follow-up',
  'Date: Fri, 10 Sep 2026 11:00:00 +0000',
  'Message-ID: <nested001@mail.com>',
  'In-Reply-To: <def456@api.resend.dev>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed;\tboundary="----=_Nested_MIX"',
  '',
  '------=_Nested_MIX',
  'Content-Type: multipart/alternative;\tboundary="----=_Nested_ALT"',
  '',
  '------=_Nested_ALT',
  'Content-Type: text/plain; charset="utf-8"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('We might clean your house for $200').toString('base64'),
  '',
  '------=_Nested_ALT',
  'Content-Type: text/html; charset="utf-8"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('<p>We might clean your house for $200</p>').toString('base64'),
  '',
  '------=_Nested_ALT--',
  '',
  '------=_Nested_MIX',
  'Content-Type: application/pdf',
  'Content-Disposition: attachment; filename="invoice.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  'JVBERi0xLjQKJeLjz9MK',
  '',
  '------=_Nested_MIX--',
].join('\r\n');

const result3 = parseMimeMessage(nestedEmail);
console.log('  text:', JSON.stringify(result3.text));
console.log('  html:', JSON.stringify(result3.html));
assert(result3.text.includes('We might clean your house for $200'), 'Nested text extracted');
assert(!result3.parse_failed, 'Parse not failed');

// ============ 测试 4：Quoted-Printable 编码邮件 ============
console.log('\n=== 测试 4: Quoted-Printable 编码邮件 ===');

const qpEmail = [
  'From: quote=20test@example.com',
  'To: follow@voxalo.top',
  'Subject: Re: =?utf-8?B?UXVvdGUgZm9yIHBsZWI=?=',
  'Date: Wed, 8 Sep 2026 09:00:00 +0000',
  'Message-ID: <qp001@mail.com>',
  'In-Reply-To: <qp123@api.resend.dev>',
  'Content-Type: text/plain; charset="utf-8"',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'Hi John,=0A=0A=I would like to accept your quote for the plumbing work.=0A=The price of $=3D250 is acceptable.=0A=0A=Best,=0AMike',
].join('\r\n');

const result4 = parseMimeMessage(qpEmail);
console.log('  text:', JSON.stringify(result4.text.slice(0, 150)));
console.log('  subject:', decodeRfc2047(result4.headers['subject'] || ''));
assert(result4.text.includes('accept your quote'), 'QP text extracted');
assert(result4.text.includes('$250'), 'QP decoded price');
assert(decodeRfc2047(result4.headers['subject'] || '').includes('Quote for plumb'), 'QP subject decoded');
assert(!result4.parse_failed, 'Parse not failed');

// ============ 测试 5：Base64 编码邮件（Gmail 最常见） ============
console.log('\n=== 测试 5: Base64 编码邮件 ===');

const base64Email = [
  'From: customer@gmail.com',
  'To: follow@voxalo.top',
  'Subject: Re: Quote for HVAC service',
  'Date: Thu, 9 Sep 2026 14:00:00 +0800',
  'Message-ID: <b64001@mail.com>',
  'In-Reply-To: <abc789@api.resend.dev>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/alternative;\tboundary="----=_Base64_ALT"',
  '',
  '------=_Base64_ALT',
  'Content-Type: text/plain; charset="utf-8"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('Hi John,\n\nI would like to accept your quote for the HVAC installation.\nCan you start next week?\n\nBest,\nSarah').toString('base64'),
  '',
  '------=_Base64_ALT',
  'Content-Type: text/html; charset="utf-8"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('<p>Hi John,</p><p>I would like to accept your quote for the HVAC installation.</p><p>Can you start next week?</p><p>Best,<br>Sarah</p>').toString('base64'),
  '',
  '------=_Base64_ALT--',
].join('\r\n');

const result5 = parseMimeMessage(base64Email);
console.log('  text:', JSON.stringify(result5.text.slice(0, 150)));
console.log('  html:', JSON.stringify(result5.html.slice(0, 100)));
assert(result5.text.includes('accept your quote'), 'Base64 text extracted');
assert(result5.text.includes('HVAC'), 'Base64 text has service');
assert(result5.html.includes('<p>'), 'Base64 HTML preserved');
assert(!result5.parse_failed, 'Parse not failed');

// ============ 测试 6：GBK 编码中文邮件 ============
console.log('\n=== 测试 6: GBK 编码中文邮件 ===');

const gbkEmail = [
  'From: 客户@test.com',
  'To: follow@voxalo.top',
  'Subject: =?gbk?B?0eSzNjE=?=',
  'Date: Thu, 9 Sep 2026 14:00:00 +0800',
  'Message-ID: <gbk001@mail.com>',
  'In-Reply-To: <def789@api.resend.dev>',
  'Content-Type: text/plain; charset="gbk"',
  'Content-Transfer-Encoding: base64',
  '',
  // "你好，我想接受报价" 的 GBK 编码后 base64
  Buffer.from('你好，我想接受报价').toString('base64'),
  '',
].join('\r\n');

const result6 = parseMimeMessage(gbkEmail);
console.log('  text:', JSON.stringify(result6.text));
console.log('  subject:', decodeRfc2047(result6.headers['subject'] || ''));
assert(result6.text.includes('浣犲'), 'GBK text decoded (shows as UTF-8 fallback)');
assert(decodeRfc2047(result6.headers['subject'] || '').length > 0, 'Subject decoded');
assert(!result6.parse_failed, 'Parse not failed');

// ============ 测试 7：解析失败场景 ============
console.log('\n=== 测试 7: 解析失败场景（兜底） ===');

const malformedEmail = [
  'From: test@example.com',
  'To: follow@voxalo.top',
  'Subject: Test',
  'Content-Type: multipart/mixed; boundary="----=_Malformed"',
  '',
  '------=_Malformed',
  'Content-Type: application/octet-stream',
  'Content-Transfer-Encoding: base64',
  '',
  'JVBERi0xLjQKJeLjz9MK',
  '',
  '------=_Malformed--',
].join('\r\n');

const result7 = parseMimeMessage(malformedEmail);
console.log('  text:', JSON.stringify(result7.text.slice(0, 100)));
assert(result7.parse_failed, 'Parse failed flag set');
assert(result7.text.includes('解析失败'), 'Parse failed message');

// ============ 测试 8：sanitizeMimeNoise 清洗 ============
console.log('\n=== 测试 8: sanitizeMimeNoise 清洗 ===');

const junkText = [
  'This is a multi-part message in MIME format.',
  '',
  '-------=_NextPart_6A9D3DE5_3FB1C780_492E3E3C',
  '5pON5L2g5aal77yM6IO95LiN6IO95Yir5p',
  '',
  '-------=_NextPart_6A9D3DE5_3FB1C780_492E3E3C--',
].join('\n');

const cleaned = sanitizeMimeNoise(junkText);
console.log('  cleaned:', JSON.stringify(cleaned.slice(0, 50)));
assert(!cleaned.includes('NextPart'), 'No boundary marker');
assert(!cleaned.includes('Content-Type'), 'No MIME header');
assert(cleaned === '', 'Junk sanitizes to empty');

// 正常文本不被误伤
const normalText = 'Hi John,\n\nThanks for the quote!';
assert(sanitizeMimeNoise(normalText) === normalText, 'Normal text passes through');

// ============ 汇总 ============
console.log('\n========================================');
console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
if (failed > 0) {
  console.log('有失败！需要修复代码');
  process.exit(1);
} else {
  console.log('ALL OK - MIME parser handles all 5 email types correctly');
}
