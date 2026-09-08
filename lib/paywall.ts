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

// 免费额度：所有创建报价的入口（手动粘贴/发送报价/邮件转发）都必须用这一个常量
export const FREE_QUOTA = 4;

// 额度统计必须按 account_id（报价归属于账号），绝不能按 customer_email（那是客户的邮箱）。
// 兜底：优先按邮箱关联统计（防删号重注册换新账号ID绕过额度），join 失败自动回退按账号ID统计。
export async function countQuotesFor(
  db: { from: (table: string) => any },
  accountId: string,
  email?: string | null
): Promise<number> {
  if (email) {
    const { count, error } = await db
      .from('quotes')
      .select('id, accounts!inner(email)', { count: 'exact', head: true })
      .eq('accounts.email', email.toLowerCase());
    if (!error) return count ?? 0;
  }
  const { count } = await db
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId);
  return count ?? 0;
}
