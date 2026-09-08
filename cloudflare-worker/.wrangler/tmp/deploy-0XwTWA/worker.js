var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var DEFAULT_BACKEND = "https://www.voxalo.top/api/webhooks/inbound";
var MAX_RAW_BYTES = 9e5;
var worker_default = {
  // 邮件处理器：Email Routing 规则触发
  async email(message, env, ctx) {
    const secret = env.INBOUND_SECRET;
    const backend = env.BACKEND_URL || DEFAULT_BACKEND;
    if (!secret) {
      console.error("[worker] INBOUND_SECRET \u672A\u8BBE\u7F6E\uFF0C\u62D2\u6536:", message.to);
      message.setReject("worker not configured: INBOUND_SECRET");
      return;
    }
    const rawBuf = await new Response(message.raw).arrayBuffer();
    const capped = rawBuf.byteLength > MAX_RAW_BYTES ? rawBuf.slice(0, MAX_RAW_BYTES) : rawBuf;
    const rawB64 = bufToB64(capped);
    const text = new TextDecoder().decode(rawBuf);
    const cloudflareTo = (message.to || "").trim();
    const headers = {};
    const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const hdrRe = /^(?![ \t])([^\r\n:]+):\s*(.*?)$/gms;
    let hm;
    while ((hm = hdrRe.exec(normalizedText)) !== null) {
      const key = hm[1].trim().toLowerCase();
      headers[key] = (headers[key] || "") + hm[2].trim() + " ";
    }
    const rawFrom = headers["from"] || "";
    const fromMatch = rawFrom.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || text.match(/From:\s*<?([\w.+-]+@[\w-]+\.[\w.]+)>?/i) || text.match(/^From:\s*(.+)$/m);
    const looseFrom = fromMatch ? (fromMatch[1] || fromMatch[0]).trim() : "";
    const rawTo = headers["to"] || "";
    const toMatch = rawTo.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || text.match(/To:\s*<?([\w.+-]+@[\w-]+\.[\w.]+)>?/i) || text.match(/^To:\s*(.+)$/m);
    const looseTo = cloudflareTo || (toMatch ? (toMatch[1] || toMatch[0]).trim() : "");
    const looseSubject = headers["subject"] || text.match(/Subject:\s*(.+)/i)?.[1]?.trim() || "(no subject)";
    const subject = looseSubject || "(no subject)";
    console.log("[worker] parsed headers:", JSON.stringify({
      from: looseFrom,
      to: looseTo,
      subject: subject.slice(0, 80),
      cloudflareTo,
      rawFromHeader: rawFrom.slice(0, 200),
      rawToHeader: rawTo.slice(0, 200),
      hasMessageId: !!(headers["message-id"] || ""),
      hasInReplyTo: !!(headers["in-reply-to"] || "")
    }));
    const isMultipart = /multipart/i.test(headers["content-type"] || "");
    const body = isMultipart ? "" : stripHeaders(text);
    try {
      const res = await fetch(backend, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Inbound-Secret": secret
        },
        body: JSON.stringify({
          From: looseFrom,
          To: looseTo,
          Subject: subject,
          text: body,
          raw_mime: rawB64,
          "Message-Id": (headers["message-id"] || "").trim(),
          "In-Reply-To": (headers["in-reply-to"] || "").trim(),
          "References": (headers["references"] || "").trim()
        })
      });
      if (!res.ok) {
        const respText = await res.text().catch(() => "");
        console.error("[worker] backend rejected:", res.status, respText.slice(0, 300));
        message.setReject("backend rejected: " + res.status);
      } else {
        console.log("[worker] forwarded ok:", subject.slice(0, 60));
      }
    } catch (e) {
      console.error("[worker] fetch backend failed:", e && e.message ? e.message : e);
      message.setReject("backend unreachable");
    }
  },
  // HTTP 处理器：放在对象内部（不遮蔽全局 fetch），预览访问不再报 "No fetch handler!"
  // 调试入口：访问 /?debug=T7a 会模拟一封邮件 POST 到后端，用于不用真邮件就验证链路
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.searchParams.get("debug") === "T7a") {
      if (!env.INBOUND_SECRET) {
        return new Response("debug: INBOUND_SECRET not set on worker", { status: 500 });
      }
      const backend = env.BACKEND_URL || DEFAULT_BACKEND;
      try {
        const res = await fetch(backend, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Inbound-Secret": env.INBOUND_SECRET
          },
          body: JSON.stringify({
            From: "debug@voxalo.top",
            To: "debug@voxalo.top",
            Subject: "debug ping",
            text: "debug",
            "Message-Id": "<debug-" + Date.now() + "@voxalo.top>",
            "In-Reply-To": "",
            References: ""
          })
        });
        const body = await res.text();
        return new Response("debug status=" + res.status + " body=" + body.slice(0, 200), {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      } catch (e) {
        return new Response("debug error: " + (e && e.message ? e.message : String(e)), { status: 200 });
      }
    }
    return new Response("QuoteFollow email worker is running. This endpoint only handles email events.", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
};
function stripHeaders(raw) {
  const sep = raw.indexOf("\r\n\r\n");
  return sep === -1 ? raw : raw.slice(sep + 4);
}
__name(stripHeaders, "stripHeaders");
function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  const CHUNK = 8192;
  const parts = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.subarray(i, i + CHUNK);
    let bin = "";
    for (let j = 0; j < chunk.length; j++) {
      bin += String.fromCharCode(chunk[j]);
    }
    parts.push(bin);
  }
  return btoa(parts.join(""));
}
__name(bufToB64, "bufToB64");
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
