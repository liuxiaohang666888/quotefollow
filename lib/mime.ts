export interface ParsedMime {
  headers: Record<string, string>;
  text: string;
  html: string;
  parse_failed?: boolean;
}

interface MimePart {
  headers: Record<string, string>;
  body: string;
}

const decoderCache = new Map<string, TextDecoder>();

function normalizeCharset(cs: string): string {
  const c = cs.toLowerCase().trim().replace(/["']/g, '');
  if (['gb2312', 'gbk', 'gb18030', 'csgb2312', 'cp936', 'gb_2312-80', 'hz-gb-2312'].includes(c)) {
    return 'gb18030';
  }
  if (['big5', 'big5-hkscs', 'cn-big5', 'x-big5'].includes(c)) return 'big5';
  if (['ks_c_5601-1987', 'euc-kr', 'ksc5601'].includes(c)) return 'euc-kr';
  if (['shift-jis', 'shift_jis', 'sjis', 'cp932', 'ms932'].includes(c)) return 'shift-jis';
  if (['iso-8859-1', 'latin1', 'windows-1252', 'cp1252', 'iso8859-1'].includes(c)) {
    return 'windows-1252';
  }
  if (c === 'utf8') return 'utf-8';
  return c;
}

function decodeCharset(bytes: Buffer, charset: string): string {
  const label = normalizeCharset(charset || 'utf-8');
  try {
    let dec = decoderCache.get(label);
    if (!dec) {
      dec = new TextDecoder(label, { fatal: false });
      decoderCache.set(label, dec);
    }
    return dec.decode(bytes);
  } catch {
    return bytes.toString('utf8');
  }
}

function decodeQpBytes(s: string): Buffer {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '=') {
      if (s[i + 1] === '\r' && s[i + 2] === '\n') {
        i += 2;
        continue;
      }
      if (s[i + 1] === '\n') {
        i += 1;
        continue;
      }
      const hex = s.slice(i + 1, i + 3);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        out.push(parseInt(hex, 16));
        i += 2;
      } else {
        out.push(s.charCodeAt(i) & 0xff);
      }
    } else {
      out.push(s.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(out);
}

export function decodeRfc2047(input: string): string {
  if (!input || input.indexOf('=?') === -1) return input;
  const merged = input.replace(/(\?=)[ \t\r\n]+(=\?)/g, '$1$2');
  return merged.replace(
    /=\?([^?\s]+)\?([bBqQ])\?([^?\s]*)\?=/g,
    (all, cs: string, enc: string, data: string) => {
      try {
        let bytes: Buffer;
        if (enc.toLowerCase() === 'b') {
          bytes = Buffer.from(data, 'base64');
        } else {
          bytes = decodeQpBytes(data.replace(/_/g, ' '));
        }
        return decodeCharset(bytes, cs);
      } catch {
        return all;
      }
    }
  );
}

function parseHeaderBlock(block: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const unfolded = block.replace(/\r?\n[ \t]+/g, ' ');
  for (const line of unfolded.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    if (!/^[\x21-\x39\x3b-\x7e]+$/.test(key)) continue;
    const val = line.slice(idx + 1).trim();
    headers[key] = headers[key] ? headers[key] + ' ' + val : val;
  }
  return headers;
}

function splitHeaders(raw: string): { headers: Record<string, string>; body: string } {
  let sep = raw.indexOf('\r\n\r\n');
  let sepLen = 4;
  const sep2 = raw.indexOf('\n\n');
  if (sep === -1 || (sep2 !== -1 && sep2 < sep)) {
    sep = sep2;
    sepLen = 2;
  }
  if (sep === -1) {
    return { headers: parseHeaderBlock(raw), body: '' };
  }
  return {
    headers: parseHeaderBlock(raw.slice(0, sep)),
    body: raw.slice(sep + sepLen),
  };
}

function splitByBoundary(body: string, boundary: string): string[] {
  const delim = '--' + boundary;
  const closing = delim + '--';
  const parts: string[] = [];
  let cur: string[] | null = null;
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trimEnd();
    if (trimmed === delim || trimmed.startsWith(closing)) {
      if (cur) parts.push(cur.join('\n'));
      cur = null;
      if (trimmed.startsWith(closing)) break;
      cur = [];
      continue;
    }
    if (cur) cur.push(line);
  }
  if (cur && cur.length) parts.push(cur.join('\n'));
  return parts;
}

function collectParts(headers: Record<string, string>, body: string, out: MimePart[], depth: number) {
  const ctRaw = headers['content-type'] || '';
  const ct = ctRaw.toLowerCase();
  const bm = ctRaw.match(/boundary\s*=\s*"([^"]+)"|boundary\s*=\s*([^;\s]+)/i);
  if (ct.startsWith('multipart/') && bm && depth < 10) {
    const boundary = (bm[1] || bm[2] || '').trim();
    if (!boundary) {
      out.push({ headers, body });
      return;
    }
    const chunks = splitByBoundary(body, boundary);
    for (const ch of chunks) {
      const { headers: h, body: b } = splitHeaders(ch);
      collectParts(h, b, out, depth + 1);
    }
  } else {
    out.push({ headers, body });
  }
}

function htmlToText(html: string): string {
  if (!html) return '';
  try {
    let text = html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
      .replace(/<img[^>]*src=["']?[^"'>]*javascript:[^"'>]*["']?[^>]*>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|h\d|li|td|th)>/gi, '\n')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
      .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    let inTag = false;
    const result: string[] = [];
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '<') {
        inTag = true;
        continue;
      }
      if (c === '>') {
        inTag = false;
        continue;
      }
      if (!inTag) {
        result.push(c);
      }
    }
    text = result.join('');
    text = text.replace(/[ \t]+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return text;
  } catch {
    return '';
  }
}

export function sanitizeMimeNoise(input: string): string {
  if (!input) return input || '';
  if (
    !/NextPart|mimepart/i.test(input) &&
    !/^Content-[\w-]+\s*:/im.test(input) &&
    !/MIME-Version\s*:/i.test(input)
  ) {
    return input;
  }
  const B64_LINE = /^[A-Za-z0-9+/]{30,}=*\s*$/;
  const B64_FRAG = /^[A-Za-z0-9+/=]+\s*$/;
  const out: string[] = [];
  let b64Run = 0;
  for (const raw of input.split(/\r?\n/)) {
    const t = raw.trim();
    if (/^-{2,}=?_?(NextPart|mimepart|Part)_/i.test(t)) {
      b64Run = 0;
      continue;
    }
    if (/^-{5,}[A-Za-z0-9_.=+-]{10,}$/.test(t)) {
      b64Run = 0;
      continue;
    }
    if (/^(Content-[\w-]+|MIME-Version)\s*:/i.test(t)) continue;
    if (/^This is a multi-part message in MIME format\.?$/i.test(t)) continue;
    if (B64_LINE.test(t)) {
      b64Run++;
      continue;
    }
    if (b64Run > 0 && B64_FRAG.test(t)) continue;
    b64Run = 0;
    out.push(raw);
  }
  return out.join('\n');
}

function tryDecodePart(p: MimePart): string | null {
  const ctHeader = p.headers['content-type'] || 'text/plain';
  const ct = ctHeader.toLowerCase();
  const cte = (p.headers['content-transfer-encoding'] || '').toLowerCase().trim();
  const csMatch = ctHeader.match(/charset\s*=\s*"?([^";\s]+)"?/i);
  const charset = csMatch ? csMatch[1] : 'utf-8';

  if (!ct.startsWith('text/') && !ct.startsWith('message/')) return null;
  if (ct.startsWith('text/') && ct.includes('calendar')) return null;

  try {
    let bytes: Buffer;
    if (cte.includes('base64')) {
      const cleaned = p.body.replace(/[^A-Za-z0-9+/=\n\r]/g, '');
      if (cleaned.length === 0) return null;
      bytes = Buffer.from(cleaned, 'base64');
    } else if (cte.includes('quoted-printable')) {
      bytes = decodeQpBytes(p.body);
    } else {
      bytes = Buffer.from(p.body, 'latin1');
    }
    const decoded = decodeCharset(bytes, charset);
    const trimmed = decoded.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

export function parseMimeMessage(rawLatin1: string): ParsedMime {
  const { headers, body } = splitHeaders(rawLatin1);
  const parts: MimePart[] = [];
  collectParts(headers, body, parts, 0);

  let text = '';
  let html = '';
  let parseFailed = false;

  for (const p of parts) {
    const decoded = tryDecodePart(p);
    if (!decoded) continue;

    const ct = (p.headers['content-type'] || '').toLowerCase();
    if (ct.startsWith('text/html')) {
      if (!html) html = decoded;
    } else if (!text) {
      text = decoded;
    }
    if (text && html) break;
  }

  if (!text && html) {
    text = htmlToText(html);
  }

  if (!text && !html && parts.length > 0) {
    parseFailed = true;
    text = '(解析失败：无法从邮件中提取文本内容)';
    html = rawLatin1.slice(0, 5000);
  }

  return { headers, text: text.trim(), html, parse_failed: parseFailed };
}
