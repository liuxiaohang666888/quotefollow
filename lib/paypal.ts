// PayPal 订阅验证
const API_BASE = 'https://api-m.paypal.com';

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

  if (!clientId || !clientSecret) {
    return { ok: true, reason: 'format-only (server credentials not configured)' };
  }

  try {
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
