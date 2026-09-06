// Cloudflare Email Routing → Worker
// 作用：收到发往 follow@voxalo.top 的邮件后，转成 webhook POST 到你的 QuoteFollow 后端。
// 部署：Cloudflare Dashboard → Email → Email Routing → 路由规则 → 发送到 Worker。
// 需要把该域名接入 Cloudflare（DNS 托管），Email Routing 免费。
// 注意：密钥从环境变量 INBOUND_SECRET 读取，须与 Vercel 的 INBOUND_WEBHOOK_SECRET 完全一致。
// BACKEND_URL 从 wrangler.toml [vars] 注入，请勿在此修改。

const MAX_RAW_BYTES = 900000;

export default {
  async email(message, env, ctx) {
    const INBOUND_SECRET = env.INBOUND_SECRET;
    if (!INBOUND_SECRET) {
      console.error('INBOUND_SECRET 未在 Worker 环境变量中设置');
      return;
    }

    const rawBuf = await new Response(message.raw).arrayBuffer();
    const capped = rawBuf.byteLength > MAX_RAW_BYTES ? rawBuf.slice(0, MAX_RAW_BYTES) : rawBuf;
    const rawB64 = bufToB64(capped);

    const text = new TextDecoder().decode(rawBuf);

    // 简单解析原始邮件：拿 From / To / Subject / Message-ID / In-Reply-To
    const headers = {};
    const hdrRe = /^([!-9;-~]+):[ \t]*(.*)$/gm;
    let m;
    while ((m = hdrRe.exec(text)) !== null) {
      headers[m[1].toLowerCase()] = (headers[m[1].toLowerCase()] || '') + m[2] + ' ';
    }

    const subject = (headers['subject'] || '').trim() || '(no subject)';

    // multipart 邮件无法在 Worker 里可靠解析成纯文本：
    // 简单 strip 只会留下 boundary / base64 噪声。正文交给后端解析 raw_mime，
    // 因此 multipart 时 text 发空；纯 text/plain 邮件才输出可读文本。
    const isMultipart = /multipart/i.test(headers['content-type'] || '');
    const body = isMultipart ? '' : stripHeaders(text);

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
        raw_mime: rawB64,
        'Message-Id': (headers['message-id'] || '').trim(),
        'In-Reply-To': (headers['in-reply-to'] || '').trim(),
        References: (headers['references'] || '').trim(),
      }),
    });
  },
};

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  const CHUNK = 8192;
  const parts = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.subarray(i, i + CHUNK);
    let bin = '';
    for (let j = 0; j < chunk.length; j++) {
      bin += String.fromCharCode(chunk[j]);
    }
    parts.push(bin);
  }
  return btoa(parts.join(''));
}
