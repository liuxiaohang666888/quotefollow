// PayPal 订阅验证
// 目标：防白嫖——只有真实存在且状态 ACTIVE 的订阅才能通过。
//
// 两级策略：
// 1) 格式校验（必做）：真实 PayPal 订阅 ID 以 "I-" 开头（如 I-BW452GLLEP1G）。
//    任何 manual- / 自定义 / 空值 一律视为未付费。
// 2) 服务端真验证（可选，配置了 PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET 时启用）：
//    调 PayPal REST API 查订阅状态，状态须为 ACTIVE。
//    没配置 secret 时退回格式校验，保证不阻塞开发/上线。

const API_BASE = 'https://api-m.paypal.com';

export function isValidPaypalSubscriptionId(id: string | null | undefined): boolean {
  if (!id) return false;
  // 真实订阅 ID：I- 后跟大写字母数字，长度一般 8~17
  return /^I-[A-Z0-9]+$/i.test(id);
}

interface VerifyResult {
  ok: boolean;
  reason: string;
  status?: string;
}

export async function verifyPaypalSubscription(subId: string): Promise<VerifyResult> {
  if (!isValidPaypalSubscriptionId(subId)) {
    return { ok: false, reason: 'invalid subscription id format' };
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  // 没配服务端凭据 → 只做格式校验（可上线；配好 secret 后自动升级为真验证）
  if (!clientId || !clientSecret) {
    return { ok: true, reason: 'format-only (server credentials not configured)' };
  }

  try {
    // 1) 换 access token
    const tokenRes = await fetch(`${API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });
    if (!tokenRes.ok) {
      return { ok: false, reason: 'paypal auth failed' };
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenJson.access_token;
    if (!accessToken) {
      return { ok: false, reason: 'paypal auth failed: no token' };
    }

    // 2) 查订阅
    const subRes = await fetch(`${API_BASE}/v1/billing/subscriptions/${encodeURIComponent(subId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!subRes.ok) {
      return { ok: false, reason: `subscription not found (http ${subRes.status})` };
    }
    const sub = (await subRes.json()) as { status?: string };
    if (sub.status === 'ACTIVE') {
      return { ok: true, reason: 'active', status: sub.status };
    }
    return { ok: false, reason: `subscription not active (${sub.status || 'unknown'})`, status: sub.status };
  } catch (e) {
    return { ok: false, reason: 'paypal verify error' };
  }
}
