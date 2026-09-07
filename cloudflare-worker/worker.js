// Cloudflare Email Routing → Worker
// 作用：收到发往 follow@voxalo.top 的邮件后，转成 webhook POST 到 QuoteFollow 后端。
//
// 关键设计（2026-09-07 排查定稿）：
// 1. 环境变量通过 Cloudflare 面板 Settings → Variables and Secrets 配置（网页部署时 wrangler.toml 不生效）：
//    - BACKEND_URL = https://www.voxalo.top/api/webhooks/inbound   （必须带 www，否则 308 跳转剥密钥）
//    - INBOUND_SECRET = 与 Vercel 的 INBOUND_WEBHOOK_SECRET 完全一致
// 2. 不在代码里写死密钥，全部从 env 读，缺了就报错返回（fail-closed）。
// 3. multipart 邮件在 Worker 里不做正文提取，只发完整 raw_mime，后端负责解析。

const MAX_RAW_BYTES = 900000;

// 邮件处理器：Email Routing 规则触发
export default {
  async email(message, env, ctx) {
    const secret = env.INBOUND_SECRET;
    const backend = env.BACKEND_URL;

    // 两个变量缺任何一个都直接报错返回，避免带错数据白跑
    if (!secret) {
      console.error('[worker] INBOUND_SECRET 未设置，丢弃邮件:', message.to);
      message.setReject('worker not configured: INBOUND_SECRET');
      return;
    }
    if (!backend) {
      console.error('[worker] BACKEND_URL 未设置，丢弃邮件:', message.to);
      message.setReject('worker not configured: BACKEND_URL');
      return;
    }

    // 读取完整原始邮件 → Base64（分块编码避免栈溢出）
    const rawBuf = await new Response(message.raw).arrayBuffer();
    const capped = rawBuf.byteLength > MAX_RAW_BYTES ? rawBuf.slice(0, MAX_RAW_BYTES) : rawBuf;
    const rawB64 = bufToB64(capped);

    const text = new TextDecoder().decode(rawBuf);

    // 只解析头部拿 From/To/Subject/Message-Id/In-Reply-To（正文交给后端解析 raw_mime）
    const headers = {};
    const hdrRe = /^([!-9;-~]+):[ \t]*(.*)$/gm;
    let m;
    while ((m = hdrRe.exec(text)) !== null) {
      headers[m[1].toLowerCase()] = (headers[m[1].toLowerCase()] || '') + m[2] + ' ';
    }

    const subject = (headers['subject'] || '').trim() || '(no subject)';
    const isMultipart = /multipart/i.test(headers['content-type'] || '');
    const body = isMultipart ? '' : stripHeaders(text);

    // 发给后端；失败时 setReject 让发件方知道投递失败（可重试），不静默吞掉
    try {
      const res = await fetch(backend, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Inbound-Secret': secret,
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

      if (!res.ok) {
        const respText = await res.text().catch(() => '');
        console.error('[worker] backend rejected:', res.status, respText.slice(0, 300));
        message.setReject('backend rejected: ' + res.status);
      } else {
        console.log('[worker] forwarded ok:', subject.slice(0, 60));
      }
    } catch (e) {
      console.error('[worker] fetch backend failed:', e && e.message ? e.message : e);
      message.setReject('backend unreachable');
    }
  },
};

// HTTP 处理器：让 Worker 有 fetch handler，预览访问不再报 "No fetch handler!"
export async function fetch(request) {
  return new Response('QuoteFollow email worker is running. This endpoint only handles email events.', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

function stripHeaders(raw) {
  const sep = raw.indexOf('\r\n\r\n');
  return sep === -1 ? raw : raw.slice(sep + 4);
}

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
