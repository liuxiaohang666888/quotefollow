import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// 服务端专用：service_role 绕过 RLS，用于 webhook / cron / AI 解析等后端流程。
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createSupabaseClient(
    url,
    key,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
