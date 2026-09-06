// Test edge cases that might fail in production
import { parseMimeMessage } from '../lib/mime.ts';

let failed = 0;
function check(name: string, cond: boolean, extra?: string) {
  if (cond) {
    console.log('PASS', name);
  } else {
    failed++;
    console.log('FAIL', name, extra ? ': ' + extra.slice(0, 200) : '');
  }
}

// ============ Edge case 1: Gmail reply with quoted-printable text/plain ============
console.log('\n=== Edge case 1: Gmail multipart/alternative (QP text + base64 html) ===');
const gMailQP = [
  'From: test@gmail.com',
  'To: follow@voxalo.top',
  'Subject: Re: Your quote',
  'Message-ID: < Gmail_msg_123@mail.gmail.com>',
  'In-Reply-To: <abc@api.resend.dev>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/alternative; boundary="000000000000abcd"',
  '',
  '--000000000000abcd',
  'Content-Type: text/plain; charset="UTF-8"',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'This is a test=20 reply.\r\n',
  'We want to proceed=20 with the quote.\r\n',
  '--000000000000abcd',
  'Content-Type: text/html; charset="UTF-8"',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  '<div>This is a test reply.</div><div>We want to proceed with the quote.</div>',
  '--000000000000abcd--',
].join('\r\n');

const r1 = parseMimeMessage(gMailQP);
console.log('  text:', JSON.stringify(r1.text));
console.log('  html:', JSON.stringify(r1.html.slice(0, 100)));
check('QP text extracted', r1.text.includes('test reply'), r1.text);
check('QP soft break decoded', r1.text.includes('proceed'), r1.text);
check('HTML captured', r1.html.includes('div'), r1.html);

// ============ Edge case 2: Google Workspace (Google Apps) - uses BCC and specific headers ============
console.log('\n=== Edge case 2: Google Workspace style reply ===');
const gWorkspace = [
  'From: boss@acme.com',
  'To: follow@voxalo.top',
  'Subject: Re: Quote #12345',
  'Message-ID: <CAAqJwggzLrlAQHU/edit/message123@google.com>',
  'In-Reply-To: <msg789@api.resend.dev>',
  'References: <msg789@api.resend.dev>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/alternative; boundary="000000000000xyz"',
  '',
  '--000000000000xyz',
  'Content-Type: text/plain; charset="UTF-8"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('Hi, I would like to accept the quote for $200.\n\nPlease let me know when you can start.\n\nThanks!').toString('base64'),
  '',
  '--000000000000xyz',
  'Content-Type: text/html; charset="UTF-8"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('<html><body><p>Hi, I would like to accept the quote for $200.</p><p>Please let me know when you can start.</p><p>Thanks!</p></body></html>').toString('base64'),
  '',
  '--000000000000xyz--',
].join('\r\n');

const r2 = parseMimeMessage(gWorkspace);
console.log('  text:', JSON.stringify(r2.text));
console.log('  in-reply-to:', JSON.stringify(r2.headers['in-reply-to']));
check('Workspace text extracted', r2.text.includes('accept the quote'));
check('Workspace in-reply-to preserved', (r2.headers['in-reply-to'] || '').includes('msg789@api.resend.dev'));

// ============ Edge case 3: Empty text part, only HTML part ============
console.log('\n=== Edge case 3: Only HTML part (no text/plain) ===');
const htmlOnly = [
  'From: user@yahoo.com',
  'To: follow@voxalo.top',
  'Subject: Quote reply',
  'Message-ID: <yahoo_msg_001@mail.yahoo.com>',
  'In-Reply-To: <abc123@api.resend.dev>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/alternative; boundary="----=_YAHOO_001"',
  '',
  '------=_YAHOO_001',
  'Content-Type: text/html; charset="UTF-8"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('<p>Great! I want this service.</p>').toString('base64'),
  '',
  '------=_YAHOO_001--',
].join('\r\n');

const r3 = parseMimeMessage(htmlOnly);
console.log('  text:', JSON.stringify(r3.text));
console.log('  html:', JSON.stringify(r3.html));
check('HTML-only: text derived from html', r3.text.includes('Great'), r3.text);
check('HTML-only: html captured', r3.html.includes('p>'), r3.html);

// ============ Edge case 4: Real Outlook/North America with CR LF in base64 body ============
console.log('\n=== Edge case 4: Outlook with CRLF in base64 body ===');
const outlookCrlf = [
  'From: client@microsoft.com',
  'To: follow@voxalo.top',
  'Subject: Re: Quote',
  'Message-ID: <outlook456@outlook.com>',
  'In-Reply-To: <def456@api.resend.dev>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="----=_Outlook_456"',
  '',
  '------=_Outlook_456',
  'Content-Type: text/plain; charset="utf-8"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('Hi there!\r\n\r\nYes, I accept the quote.\r\n\r\nBest').toString('base64'),
  '',
  '------=_Outlook_456--',
].join('\r\n');

const r4 = parseMimeMessage(outlookCrlf);
console.log('  text:', JSON.stringify(r4.text));
check('Outlook CRLF text extracted', r4.text.includes('accept the quote'));

// ============ Edge case 5: Gmail with no In-Reply-To but has References ============
console.log('\n=== Edge case 5: References without In-Reply-To ===');
const refsOnly = [
  'From: user@example.com',
  'To: follow@voxalo.top',
  'Subject: Re: Quote',
  'Message-ID: <ref_msg_001@example.com>',
  'References: <parent_msg@api.resend.dev>',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset="utf-8"',
  '',
  'I want to proceed with the quote.',
].join('\r\n');

const r5 = parseMimeMessage(refsOnly);
console.log('  text:', JSON.stringify(r5.text));
console.log('  message-id:', JSON.stringify(r5.headers['message-id']));
console.log('  references:', JSON.stringify(r5.headers['references']));
check('References preserved', (r5.headers['references'] || '').includes('parent_msg@api.resend.dev'));

// ============ Edge case 6: Very long boundary with special chars ============
console.log('\n=== Edge case 6: Long boundary with special chars ===');
const longBoundary = [
  'From: a@b.com',
  'To: follow@voxalo.top',
  'Subject: Test',
  'Message-ID: <test_msg@mail.com>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="----=_Part_12345678_987654321_AbCdEf"',
  '',
  '------=_Part_12345678_987654321_AbCdEf',
  'Content-Type: text/plain; charset="utf-8"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('Hello world!').toString('base64'),
  '',
  '------=_Part_12345678_987654321_AbCdEf--',
].join('\r\n');

const r6 = parseMimeMessage(longBoundary);
console.log('  text:', JSON.stringify(r6.text));
check('Long boundary text extracted', r6.text.includes('Hello world'));

// ============ Edge case 7: Empty body in text part ============
console.log('\n=== Edge case 7: Empty text part, HTML fallback ===');
const emptyTextHtmlOnly = [
  'From: test@a.com',
  'To: follow@voxalo.top',
  'Subject: Test',
  'Message-ID: <empty_msg@mail.com>',
  'In-Reply-To: <parent@api.resend.dev>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/alternative; boundary="----=_Empty_Test"',
  '',
  '------=_Empty_Test',
  'Content-Type: text/plain; charset="utf-8"',
  'Content-Transfer-Encoding: base64',
  '',
  '',  // empty base64 = empty text
  '------=_Empty_Test',
  'Content-Type: text/html; charset="utf-8"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('<p>Here is my reply</p>').toString('base64'),
  '------=_Empty_Test--',
].join('\r\n');

const r7 = parseMimeMessage(emptyTextHtmlOnly);
console.log('  text:', JSON.stringify(r7.text));
console.log('  html:', JSON.stringify(r7.html));
check('Empty text + HTML: html fallback', r7.html.includes('Here is my reply'), r7.html);
check('Empty text + HTML: text from html', r7.text.includes('reply'), r7.text);

// ============ Edge case 8: Gmail quoted-printable with =20 spaces ============
console.log('\n=== Edge case 8: QP with =3D and =20 ===');
const qpComplex = [
  'From: user@gmail.com',
  'To: follow@voxalo.top',
  'Subject: Reply',
  'Message-ID: <qp_test@mail.gmail.com>',
  'In-Reply-To: <abc123@api.resend.dev>',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset="UTF-8"',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'Subject=3DQuote reply\r\n',
  'Price is $=3D150 for the job\r\n',
  'Please =20 confirm =20 soon.\r\n',
].join('\r\n');

const r8 = parseMimeMessage(qpComplex);
console.log('  text:', JSON.stringify(r8.text));
check('QP =3D decoded to =', r8.text.includes('=3D') || r8.text.includes('='), r8.text);
check('QP =20 decoded to space', r8.text.includes('confirm  soon') || r8.text.includes('confirm soon'), r8.text);

console.log('\n========================================');
console.log(`测试结果: ${8 - failed} 通过, ${failed} 失败`);
if (failed > 0) process.exit(1);
