// Slack Webhook 安全校验：只允许官方 hooks.slack.com 域名的 https 地址。
// 防 SSRF：accounts.slack_webhook 是用户自填字段，若不校验，
// 攻击者可填内网地址（如 http://169.254.169.254/、http://127.0.0.1:xxxx）
// 借服务端 fetch 打内网/云元数据接口。
export function isSafeSlackWebhook(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return u.hostname === 'hooks.slack.com' || u.hostname.endsWith('.hooks.slack.com');
  } catch {
    return false;
  }
}
