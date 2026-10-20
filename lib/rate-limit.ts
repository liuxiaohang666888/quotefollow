// 全局限流（收敛原 quotes/quotes:send 各自复制的内存 Map 与原 utils.ts 的助手）。
//
// ⚠️ 定位说明（L11）：这是"弱限流"。Vercel/Serverless 多实例下每个实例各有一份 Map，
// 计数不共享；实例回收即丢失。真正的强限流需要共享存储（Upstash Redis 等），
// 属于基础设施决策，留待人工接入；当前实现至少保证：单实例内防刷、无内存泄漏
// （周期性清理过期桶）、 Key 不会无限增长。
//
// 用途：防脚本刷爆 AI 成本（报价创建）、防匿名反馈接口被垃圾数据打爆。

const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 每 5 分钟清理一次过期桶

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    const alive = bucket.hits.filter((t) => now - t < windowMs);
    if (alive.length === 0) {
      buckets.delete(key);
    } else {
      bucket.hits = alive;
    }
  }
}

/**
 * 滑动窗口限流。
 * @param key      限流键（如 `quotes:${userId}` / `feedback:${ip}`）
 * @param max      窗口内最大次数
 * @param windowMs 窗口长度（毫秒）
 */
export function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now, windowMs);
  const bucket = buckets.get(key) || { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= max) {
    buckets.set(key, bucket);
    return true;
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  return false;
}

// 报价创建：每用户每 60 秒最多 10 条（防脚本刷爆 AI 成本）
export function isQuoteCreateRateLimited(userId: string): boolean {
  return isRateLimited(`quotes:${userId}`, 10, 60_000);
}

// 反馈提交：每 IP 每 60 秒最多 5 次（匿名接口防垃圾数据）
export function isFeedbackRateLimited(ip: string): boolean {
  return isRateLimited(`feedback:${ip}`, 5, 60_000);
}
