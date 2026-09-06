import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// 简易内存限流：每个用户每 60 秒最多创建 N 条（防脚本刷爆 AI 成本）
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const createLog = new Map<string, number[]>();

export function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (createLog.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    createLog.set(userId, arr);
    return true;
  }
  arr.push(now);
  createLog.set(userId, arr);
  return false;
}

// 注册页限流：每 IP 每 60 秒最多 5 次
const SIGNUP_WINDOW_MS = 60_000;
const SIGNUP_MAX = 5;
const signupLog = new Map<string, number[]>();

export function isSignupRateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (signupLog.get(ip) || []).filter((t) => now - t < SIGNUP_WINDOW_MS);
  if (arr.length >= SIGNUP_MAX) {
    signupLog.set(ip, arr);
    return true;
  }
  arr.push(now);
  signupLog.set(ip, arr);
  return false;
}

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return createServerClient(
    url,
    key,
    {
      cookies: {
        async getAll() {
          return cookieStore.getAll().map((c: { name: string; value: string }) => ({ name: c.name, value: c.value }));
        },
        async setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            for (const cookie of cookiesToSet) {
              cookieStore.set(cookie.name, cookie.value, cookie.options);
            }
          } catch {
            // Server Component 中调用时忽略，Middleware 负责刷新
          }
        },
      },
    }
  );
}
