import { NextRequest } from 'next/server';

// Cron 鉴权统一入口。兼容三种调用方式：
// 1. Vercel Cron（官方定时任务）：发 GET 请求 + "Authorization: Bearer CRON_SECRET" 头
// 2. 外部 cron 服务（cron-job.org 等）：POST + ?secret=xxx 查询参数
// 3. 服务端内部调用：x-cron-secret 头
export function isCronAuthorized(req: NextRequest | Request): boolean {
  const secret = process.env.CRON_SECRET;
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
