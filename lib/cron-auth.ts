import { NextRequest } from 'next/server';

// Cron 鉴权统一入口。兼容三种调用方式：
// 1. Vercel Cron（官方定时任务）：发 GET 请求 + "Authorization: Bearer CRON_SECRET" 头
// 2. 外部 cron 服务（cron-job.org 等）：POST + ?secret=xxx 查询参数
// 3. 服务端内部调用：x-cron-secret 头
export function isCronAuthorized(req: NextRequest | Request): boolean {
  const secret = process.env.CRON_SECRET;
  // fail-closed：密钥未配置时一律拒绝。
  // 旧行为是"未配置即放行"，等于任何人无密钥可调 cron 接口（含月报、跟进群发）。
  // Vercel Cron 会自动注入 CRON_SECRET；外部 cron 服务需在 URL 带 ?secret= 或带头。
  if (!secret) return false;

  try {
    const url = new URL(req.url);
    if (url.searchParams.get('secret') === secret) return true;
  } catch {
    // url 解析失败继续检查头
  }

  const auth = req.headers.get('authorization') || '';
  if (auth === `Bearer ${secret}`) return true;

  return req.headers.get('x-cron-secret') === secret;
}
