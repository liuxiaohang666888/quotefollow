// Cloudflare Email Routing → Worker
// 作用：收到发往 follow@voxalo.top 的邮件后，转成 webhook POST 到 QuoteFollow 后端。
//
// ⚠️ 关键修复（2026-09-08）：fetch 处理器必须放在 export default 对象内部！
// 之前写成顶层 `export async function fetch()`，模块级 fetch 会遮蔽全局 fetch，
// 导致 email 处理器里的 fetch(backend,...) 调用的是它自己 → 永远返回 200
// → Worker 以为转发成功，但后端一封邮件都没收到 → 客户永远等不到 AI 报价回复。
//
// 其他设计：
// 1. BACKEND_URL 必须带 www.voxalo.top（不带 www 会 308 跳转剥掉 X-Inbound-Secret → 401）
// 2. INBOUND_SECRET 用 wrangler secret put 配置，与 Vercel 的 INBOUND_WEBHOOK_SECRET 完全一致
// 3. 正文不在 Worker 里解析，只发完整 raw_mime，后端负责解析（乱码的根本修复）

const DEFAULT_BACKEND = 'https://www.voxalo.top/api/webhooks/inbound';
const MAX_RAW_BYTES = 900000;

export default {
  // 邮件处理器：Email Routing 规则触发
  async email(message, env, ctx) {
    const secret = env.INBOUND_SECRET;
    const backend = env.BACKEND_URL || DEFAULT_BACKEND;

    // 密钥缺失直接拒收（fail-closed），避免静默丢信
    if (!secret) {
      console.error('[worker] INBOUND_SECRET 未设置，拒收:', message.to);
      message.setReject('worker not configured: INBOUND_SECRET');
      return;
    }

    // 读取完整原始邮件 → Base64（分块编码避免栈溢出）
    const rawBuf = await new Response(message.raw).arrayBuffer();
    const capped = rawBuf.byteLength > MAX_RAW_BYTES ? rawBuf.slice(0, MAX_RAW_BYTES) : rawBuf;
    const rawB64 = bufToB64(capped);

    const text = new TextDecoder().decode(rawBuf);

    // Cloudflare Email Routing API 直接提供收件人地址
    const cloudflareTo = (message.to || '').trim();

    // 改进的 header 解析：支持 \r\n、\n、\r 换行符，以及被 Cloudflare 修改过的头部格式
    const headers = {};
    // 先统一换行符为 \n
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // 匹配头部行：开头可以是空格/制表符（continuation），然后是非冒号字符 + 冒号 + 值
    const hdrRe = /^(?![ \t])([^\r\n:]+):\s*(.*?)$/gms;
    let hm;
    while ((hm = hdrRe.exec(normalizedText)) !== null) {
      const key = hm[1].trim().toLowerCase();
      headers[key] = (headers[key] || '') + hm[2].trim() + ' ';
    }

    // 提取 From：优先用正则匹配，兜底用 Cloudflare headers（如果有）
    const rawFrom = headers['from'] || '';
    // 更宽松的 From 提取：支持各种编码和前缀
    const fromMatch = rawFrom.match(/[\w.+-]+@[\w-]+\.[\w.]+/) ||
                      text.match(/From:\s*<?([\w.+-]+@[\w-]+\.[\w.]+)>?/i) ||
                      text.match(/^From:\s*(.+)$/m);
    const looseFrom = fromMatch ? (fromMatch[1] || fromMatch[0]).trim() : '';

    // 提取 To：优先用 Cloudflare API 提供的值，兜底用邮件头
    const rawTo = headers['to'] || '';
    const toMatch = rawTo.match(/[\w.+-]+@[\w-]+\.[\w.]+/) ||
                    text.match(/To:\s*<?([\w.+-]+@[\w-]+\.[\w.]+)>?/i) ||
                    text.match(/^To:\s*(.+)$/m);
    const looseTo = cloudflareTo || (toMatch ? (toMatch[1] || toMatch[0]).trim() : '');

    // 提取 Subject
    const looseSubject = headers['subject'] ||
                         text.match(/Subject:\s*(.+)/i)?.[1]?.trim() ||
                         '(no subject)';
    const subject = looseSubject || '(no subject)';

    // 调试日志：打印解析结果
    console.log('[worker] parsed headers:', JSON.stringify({
      from: looseFrom,
      to: looseTo,
      subject: subject.slice(0, 80),
      cloudflareTo: cloudflareTo,
      rawFromHeader: rawFrom.slice(0, 200),
      rawToHeader: rawTo.slice(0, 200),
      hasMessageId: !!(headers['message-id'] || ''),
      hasInReplyTo: !!(headers['in-reply-to'] || ''),
    }));

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
          From: looseFrom,
          To: looseTo,
          Subject: subject,
          text: body,
          raw_mime: rawB64,
          'Message-Id': (headers['message-id'] || '').trim(),
          'In-Reply-To': (headers['in-reply-to'] || '').trim(),
          'References': (headers['references'] || '').trim(),
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

  // HTTP 处理器：放在对象内部（不遮蔽全局 fetch），预览访问不再报 "No fetch handler!"
  // 调试入口：访问 /?debug=T7a 会模拟一封邮件 POST 到后端，用于不用真邮件就验证链路
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.searchParams.get('debug') === 'T7a') {
      if (!env.INBOUND_SECRET) {
        return new Response('debug: INBOUND_SECRET not set on worker', { status: 500 });
      }
      const backend = env.BACKEND_URL || DEFAULT_BACKEND;
      try {
        const res = await fetch(backend, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Inbound-Secret': env.INBOUND_SECRET,
          },
          body: JSON.stringify({
            From: 'debug@voxalo.top',
            To: 'debug@voxalo.top',
            Subject: 'debug ping',
            text: 'debug',
            'Message-Id': '<debug-' + Date.now() + '@voxalo.top>',
            'In-Reply-To': '',
            References: '',
          }),
        });
        const body = await res.text();
        return new Response('debug status=' + res.status + ' body=' + body.slice(0, 200), {
          status: 200,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      } catch (e) {
        return new Response('debug error: ' + (e && e.message ? e.message : String(e)), { status: 200 });
      }
    }
    return new Response('QuoteFollow email worker is running. This endpoint only handles email events.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
};

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
