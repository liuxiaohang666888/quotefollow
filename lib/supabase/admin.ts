import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// 服务端专用：service_role 绕过 RLS，用于 webhook / cron / AI 解析等后端流程。
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
