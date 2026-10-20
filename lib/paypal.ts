// PayPal 订阅验证
// L12 修复：① API_BASE 不再硬编码生产——PAYPAL_ENV=sandbox 时切沙箱，方便联调；
//          ② 三处 fetch 均加 8 秒超时（旧代码无超时，PayPal 挂起时请求无限期悬挂）。
const API_BASE =
  process.env.PAYPAL_ENV === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
const FETCH_TIMEOUT_MS = 8000;

// 我们自己的 PayPal 计划 ID（三档）。verifyPaypalSubscription 用它校验订阅归属：
// 只有订阅到"我们自己计划"的 I-xxx 才认可，别家商家的 ACTIVE 订阅不能白嫖本站权益。
// 最后一个为硬编码的 Pro 生产计划（与客户端 PayPalSubscribeButton 的 DEFAULT_PLAN_ID 一致），
// 防止环境变量被旧值覆盖时全部档位失效。
const FALLBACK_PRO_PLAN_ID = 'P-9RN20574BN6264401NKUP3CY';

export function getAllowedPlanIds(): string[] {
  const ids = [
    process.env.NEXT_PUBLIC_PAYPAL_PRO_PLAN_ID,
    process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID, // 兼容旧变量名
    process.env.NEXT_PUBLIC_PAYPAL_EARLY_BIRD_PLAN_ID,
    process.env.NEXT_PUBLIC_PAYPAL_YEARLY_PLAN_ID,
    FALLBACK_PRO_PLAN_ID,
  ].filter((v): v is string => !!v && /^P-[A-Z0-9]+$/i.test(v));
  return Array.from(new Set(ids));
}

export function isValidPaypalSubscriptionId(id: string | null | undefined): boolean {
  if (!id) return false;
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

  // 🚨 生产环境下凭证缺失 = 验证失败（默认拒绝，防止白嫖）
  // 开发环境下也返回失败，但提示 dev mode，方便排查
  if (!clientId || !clientSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[paypal] PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not configured in production!');
      return { ok: false, reason: 'paypal credentials not configured' };
    }
    return { ok: false, reason: 'dev mode: paypal credentials not configured' };
  }

  try {
    const tokenRes = await fetch(`${API_BASE}/v1/oauth2/token`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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

    const subRes = await fetch(`${API_BASE}/v1/billing/subscriptions/${encodeURIComponent(subId)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!subRes.ok) {
      return { ok: false, reason: `subscription not found (http ${subRes.status})` };
    }
    const sub = (await subRes.json()) as { status?: string; plan_id?: string };
    if (sub.status === 'ACTIVE') {
      // 归属校验：订阅必须挂在我们的计划下。别家商家名下的有效订阅 ID 直接拒绝，
      // 杜绝"拿任何 ACTIVE 订阅过来就开通付费权益"的白嫖路径。
      const planId = sub.plan_id;
      if (!planId || !getAllowedPlanIds().includes(planId)) {
        console.warn(`[paypal] subscription ${subId} plan_id=${planId || 'missing'} not in allowed plans — rejected`);
        return { ok: false, reason: 'subscription plan is not one of our plans', status: sub.status };
      }
      return { ok: true, reason: 'active', status: sub.status };
    }
    return { ok: false, reason: `subscription not active (${sub.status || 'unknown'})`, status: sub.status };
  } catch (e) {
    return { ok: false, reason: 'paypal verify error' };
  }
}

// 取消 PayPal 订阅（用户主动取消）
export async function cancelPaypalSubscription(subId: string): Promise<{ ok: boolean; reason: string }> {
  if (!isValidPaypalSubscriptionId(subId)) {
    return { ok: false, reason: 'invalid subscription id format' };
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[paypal] PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not configured for cancel!');
    return { ok: false, reason: 'paypal credentials not configured' };
  }

  try {
    const tokenRes = await fetch(`${API_BASE}/v1/oauth2/token`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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

    const cancelRes = await fetch(`${API_BASE}/v1/billing/subscriptions/${encodeURIComponent(subId)}/cancel`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Customer cancelled from Settings' }),
    });
    if (!cancelRes.ok) {
      return { ok: false, reason: `cancel failed (http ${cancelRes.status})` };
    }
    return { ok: true, reason: 'cancelled' };
  } catch (e) {
    return { ok: false, reason: 'paypal cancel error' };
  }
}
