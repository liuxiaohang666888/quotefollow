import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidPaypalSubscriptionId } from '@/lib/paypal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PayPal Webhook 接收端（P0）
// 签名验证采用 PayPal 官方机制（不引入 SDK，手写等价流程）：
//   1) 校验必需头 + 仅允许 PayPal 官方证书地址拉取 X.509 证书（防 SSRF）
//   2) 校验串 = transmission_id | transmission_time | webhook_id | crc32(raw_body)
//   3) RSA-SHA256(PKCS1 v1.5) 验签，失败返回 400（PayPal 不会重试，需在后台排查）
// 事件处理：
//   BILLING.SUBSCRIPTION.CANCELLED → resource.id 置空对应账号订阅（回免费/试用态）
//   PAYMENT.SALE.COMPLETED        → resource.billing_agreement_id 确认激活（幂等）
//   PAYMENT.SALE.DENIED           → resource.billing_agreement_id 置无效（清空订阅 ID）

// PayPal 证书地址白名单（仅允许官方域名，防 SSRF）
const CERT_CACHE = new Map<string, { pem: string; fetchedAt: number }>();
const CERT_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 小时
// 防重放窗口：PayPal 重试的 transmission time 是原始时间，放宽到 1 小时避免误杀合法重试
const MAX_TRANSMISSION_AGE_MS = 60 * 60 * 1000;

// CRC-32 (IEEE 802.3)，PayPal 校验串中为十进制无符号整数
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const b of buf) crc = CRC32_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function fetchCertPem(certUrl: string): Promise<string> {
  const now = Date.now();
  const cached = CERT_CACHE.get(certUrl);
  if (cached && now - cached.fetchedAt < CERT_CACHE_TTL_MS) return cached.pem;

  const certRes = await fetch(certUrl, {
    headers: { Accept: 'application/x-pem-file' },
  });
  if (!certRes.ok) throw new Error(`cert fetch failed (http ${certRes.status})`);
  const pem = await certRes.text();
  if (!pem.includes('-----BEGIN')) throw new Error('cert payload is not PEM');
  CERT_CACHE.set(certUrl, { pem, fetchedAt: now });
  return pem;
}

async function verifyPaypalWebhook(req: NextRequest, rawBody: string): Promise<{ ok: boolean; error?: string }> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return { ok: false, error: 'PAYPAL_WEBHOOK_ID not configured' };

  const transmissionId = req.headers.get('paypal-transmission-id');
  const transmissionTime = req.headers.get('paypal-transmission-time');
  const transmissionSig = req.headers.get('paypal-transmission-sig');
  const certUrl = req.headers.get('paypal-cert-url');
  const authAlgo = req.headers.get('paypal-auth-algo');

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return { ok: false, error: 'missing webhook verification headers' };
  }
  if (!/^[A-Za-z0-9\-_.]+$/.test(transmissionId)) return { ok: false, error: 'bad transmission id' };
  if (authAlgo !== 'SHA256withRSA') return { ok: false, error: `unsupported auth algo: ${authAlgo}` };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(transmissionTime)) {
    return { ok: false, error: 'bad transmission time format' };
  }
  const transmissionTs = Date.parse(transmissionTime);
  if (Number.isNaN(transmissionTs) || Math.abs(Date.now() - transmissionTs) > MAX_TRANSMISSION_AGE_MS) {
    return { ok: false, error: 'stale transmission time' };
  }

  let certPem: string;
  try {
    const u = new URL(certUrl);
    if (u.protocol !== 'https:' || !u.hostname.endsWith('.paypal.com')) {
      return { ok: false, error: 'cert url not from paypal' };
    }
    certPem = await fetchCertPem(certUrl);
  } catch (e: any) {
    return { ok: false, error: `cert error: ${e?.message || e}` };
  }

  const verifySource = `${transmissionId}|${transmissionTime}|${webhookId}|${crc32(Buffer.from(rawBody, 'utf8'))}`;
  try {
    const publicKey = crypto.createPublicKey(certPem); // 自动从 X.509 证书提取公钥
    const sig = Buffer.from(transmissionSig, 'base64');
    const valid = crypto.verify('RSA-SHA256', Buffer.from(verifySource, 'utf8'), publicKey, sig);
    if (!valid) return { ok: false, error: 'signature mismatch' };
  } catch (e: any) {
    return { ok: false, error: `verify error: ${e?.message || e}` };
  }
  return { ok: true };
}

type HandleResult = { handled: boolean; reason?: string; action?: string; email?: string };

// 按订阅 ID 定位账号并清空订阅（service_role 绕过 RLS 敏感字段触发器）
async function downgradeBySubId(
  admin: ReturnType<typeof createAdminClient>,
  subId: string,
  eventName: string
): Promise<HandleResult> {
  const { data: account } = await admin
    .from('accounts')
    .select('id, email')
    .eq('paypal_subscription_id', subId)
    .maybeSingle();

  if (!account) {
    console.warn(`[webhook/paypal] ${eventName}: no account with sub ${subId} (already free?)`);
    return { handled: true, action: `${eventName.toLowerCase()}_none` };
  }

  const { error: upErr } = await admin
    .from('accounts')
    .update({ paypal_subscription_id: null })
    .eq('id', account.id);
  if (upErr) throw upErr;

  console.log(`[webhook/paypal] ${eventName}: downgraded ${account.email} to free (sub=${subId})`);
  return { handled: true, action: eventName.toLowerCase(), email: account.email };
}

async function handlePaypalEvent(
  admin: ReturnType<typeof createAdminClient>,
  event: Record<string, any>
): Promise<HandleResult> {
  const eventType = String(event?.event_type || '');
  const resource = (event?.resource || {}) as Record<string, any>;

  switch (eventType) {
    case 'BILLING.SUBSCRIPTION.CANCELLED': {
      const subId = resource?.id;
      if (!subId || !isValidPaypalSubscriptionId(subId)) {
        return { handled: false, reason: 'CANCELLED event missing/invalid resource.id' };
      }
      return downgradeBySubId(admin, subId, 'CANCELLED');
    }

    case 'PAYMENT.SALE.COMPLETED': {
      const subId = resource?.billing_agreement_id;
      if (!subId || !isValidPaypalSubscriptionId(subId)) {
        return { handled: false, reason: 'COMPLETED event missing/invalid billing_agreement_id' };
      }
      // 幂等确认：订阅已登记即视为激活，无需重复写
      const { data: account } = await admin
        .from('accounts')
        .select('id, email')
        .eq('paypal_subscription_id', subId)
        .maybeSingle();
      if (account) {
        console.log(`[webhook/paypal] COMPLETED: sub ${subId} already active for ${account.email}`);
        return { handled: true, action: 'completed_already_active', email: account.email };
      }
      // 库内无此订阅 ID：无法反查账号归属（webhook 不含 account 标识），订阅激活仍以 signup 写入为准
      console.warn(`[webhook/paypal] COMPLETED: no account with sub ${subId} — cannot backfill, skip`);
      return { handled: true, action: 'completed_no_account' };
    }

    case 'PAYMENT.SALE.DENIED': {
      const subId = resource?.billing_agreement_id;
      if (!subId || !isValidPaypalSubscriptionId(subId)) {
        return { handled: false, reason: 'DENIED event missing/invalid billing_agreement_id' };
      }
      return downgradeBySubId(admin, subId, 'DENIED');
    }

    default:
      console.log(`[webhook/paypal] unhandled event type: ${eventType}`);
      return { handled: true, action: 'ignored' };
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!rawBody) {
    return NextResponse.json({ ok: false, error: 'empty body' }, { status: 400 });
  }

  let event: Record<string, any>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 });
  }

  const verify = await verifyPaypalWebhook(req, rawBody);
  if (!verify.ok) {
    console.warn(`[webhook/paypal] signature verification FAILED: ${verify.error} (event_id=${event?.id || '?'})`);
    return NextResponse.json({ ok: false, error: 'verification failed' }, { status: 400 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e: any) {
    console.error('[webhook/paypal] admin client error:', e?.message || e);
    return NextResponse.json({ ok: false, error: 'server config error' }, { status: 500 });
  }

  // 业务处理失败不抛 500：PayPal 对连续 5xx 会禁用 webhook，且处理逻辑幂等，
  // 事件丢失风险低于无限重试风险；失败详情进日志供人工排查
  try {
    const result = await handlePaypalEvent(admin, event);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error('[webhook/paypal] event handling error:', e?.message || e);
    return NextResponse.json({ ok: true, handled: false, error: 'event handling failed' });
  }
}
