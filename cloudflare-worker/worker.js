// Cloudflare Email Routing → Worker
// 作用：收到发往 follow@voxalo.top 的邮件后，转成 webhook POST 到你的 QuoteFollow 后端。
// 部署：Cloudflare Dashboard → Email → Email Routing → 路由规则 → 发送到 Worker。
// 需要把该域名接入 Cloudflare（DNS 托管），Email Routing 免费。

const BACKEND_URL = 'https://voxalo.top/api/webhooks/inbound';
const INBOUND_SECRET = '32365fcfa36b01f61a84fa15ebade27229c3604578ecb1c3'; // INBOUND_WEBHOOK_SECRET

export default {
  async email(message, env, ctx) {
    const text = await new Response(message.raw).text();

    // 简单解析原始邮件：拿 From / To / Subject / Message-ID / In-Reply-To
    const headers = {};
    const hdrRe = /^([!-9;-~]+):[ \t]*(.*)$/gm;
    let m;
    while ((m = hdrRe.exec(text)) !== null) {
      headers[m[1].toLowerCase()] = (headers[m[1].toLowerCase()] || '') + m[2] + ' ';
    }

    const subject = (headers['subject'] || '').trim() || '(no subject)';
    const body = stripHeaders(text);

    await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Inbound-Secret': INBOUND_SECRET,
      },
      body: JSON.stringify({
        From: headers['from']?.trim() || '',
        To: headers['to']?.trim() || '',
        Subject: subject,
        text: body,
        'Message-Id': (headers['message-id'] || '').trim(),
        'In-Reply-To': (headers['in-reply-to'] || '').trim(),
        References: (headers['references'] || '').trim(),
      }),
    });
  },
};

function stripHeaders(raw) {
  const idx = raw.indexOf('\r\n\r\n');
  const body = idx >= 0 ? raw.slice(idx + 4) : raw;
  // 去掉 MIME 噪声，保留可读文本
  return body
    .replace(/Content-Type:[\s\S]*?\r\n\r\n/g, '')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .filter((l) => !l.startsWith('='))
    .join('\n')
    .slice(0, 8000);
}
