// 测试 QQ邮箱回复邮件的 MIME 解析
// 模拟 QQ邮箱 iPhone客户端回复短内容 "mj" 时的典型 MIME 结构
const { parseMimeMessage } = require('../lib/mime.ts');

// QQ邮箱手机回复的典型结构：quoted-printable + base64 混合，quoted 原文在下面
const sampleQQReply = `Received: from mail.qq.com
Message-ID: <test-qq-reply-001@qq.com>
In-Reply-To: <cb7a8c9b.67890@voxalo.top>
From: =?utf-8?B?5bCP5byg5Y2a5aW955S15L2q?= <liuxiaohang529@qq.com>
To: follow@voxalo.top
Subject: =?utf-8?B?UmU6IFF1b3RlOiBtaiBmb3IgbGl1c2hvYQ==?=
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="----=_Part_123_456"

------=_Part_123_456
Content-Type: text/plain; charset=utf-8
Content-Transfer-Encoding: base64

bWoNCg0K
------=_Part_123_456
Content-Type: text/html; charset=utf-8
Content-Transfer-Encoding: base64

PGRpdj5tajwvZGl2PjxkaXY+PGJyPjwvZGl2PjxkaXY+PGRpdj7lsI/ln7rnuqTkvos6PC9kaXY+
PC9kaXY+
------=_Part_123_456--
`;

console.log('=== 测试1: base64编码的QQ邮箱回复 "mj" ===');
const r1 = parseMimeMessage(sampleQQReply);
console.log('text:', JSON.stringify(r1.text));
console.log('html:', JSON.stringify(r1.html?.slice(0, 200)));
console.log('parse_failed:', r1.parse_failed);
console.log('in-reply-to:', r1.headers['in-reply-to']);
console.log('');

// 测试2: quoted-printable 编码
const sampleQP = `Message-ID: <test-qp-002@qq.com>
From: test@qq.com
To: follow@voxalo.top
Subject: Re: Quote mj
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8
Content-Transfer-Encoding: quoted-printable

mj=E4=BD=A0=E5=A5=BD
`;
console.log('=== 测试2: quoted-printable 编码 ===');
const r2 = parseMimeMessage(sampleQP);
console.log('text:', JSON.stringify(r2.text));
console.log('parse_failed:', r2.parse_failed);
console.log('');

// 测试3: plain utf-8
const samplePlain = `Message-ID: <test-plain-003@qq.com>
From: test@qq.com
To: follow@voxalo.top
Subject: Re: Quote mj
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8

mj 这是我的回复
`;
console.log('=== 测试3: plain utf-8 ===');
const r3 = parseMimeMessage(samplePlain);
console.log('text:', JSON.stringify(r3.text));
console.log('parse_failed:', r3.parse_failed);
