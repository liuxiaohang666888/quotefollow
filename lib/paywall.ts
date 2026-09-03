// 付费墙管理端绕过：只有列在 NEXT_PUBLIC_ADMIN_EMAILS 的邮箱可免订阅测试。
// 这是给开发者/管理员自己的账号用的，公众无法伪造（邮箱由 Supabase 会话提供）。
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}
