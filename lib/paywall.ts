import { isValidPaypalSubscriptionId } from '@/lib/paypal';

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
// 定稿口径：免费档 = 3 个客户（落地页/signup/dashboard 全部按 3 说，别再加倍数）
export const FREE_QUOTA = 3;

// 免费试用期：14 天（与落地页 "Free for 14 days, up to 3 clients" 文案对齐）
// 试用期内仍受 FREE_QUOTA 客户数限制；注册满 14 天后无论额度多少都锁定付费
export const TRIAL_DAYS = 14;

export function isWithinTrialDays(createdAt: string | null | undefined): boolean {
  if (!createdAt) return true; // 无创建时间不误杀
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return true;
  return Date.now() - created < TRIAL_DAYS * 24 * 60 * 60 * 1000;
}

// 试用期判定的唯一入口（M12 修复）：所有入口（quotes / quotes:send / inbound / followups cron）
// 都必须用这一个函数，不再各自拼 isWithinTrialDays(acc.created_at)。
// 口径：trial_ends_at 优先（显式跟踪，见 013 迁移）；没有才回退 created_at + 14 天。
// 账号不存在时返回 false——不能再像旧代码那样"查不到 created_at 就当试用期内"，
// 那会让试用过期的存量账号恒通过付费墙（select 没取 created_at 时 undefined 恒真）。
export function isTrialActive(
  account: { created_at?: string | null; trial_ends_at?: string | null } | null | undefined
): boolean {
  if (!account) return false;
  if (account.trial_ends_at) {
    const end = new Date(account.trial_ends_at).getTime();
    if (!Number.isNaN(end)) return Date.now() < end;
  }
  return isWithinTrialDays(account.created_at);
}

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

// free_months_earned 真抵扣：赠送免费月是否生效中（free_months_earned > 0 且 free_month_expires_at 未过期）。
// 生效期间即使没有有效订阅也保持解锁；到期后按免费用户降级。
export function hasActiveFreeMonth(account: {
  free_months_earned?: number | null;
  free_month_expires_at?: string | null;
} | null | undefined): boolean {
  if (!account) return false;
  const earned = Number(account.free_months_earned ?? 0);
  if (earned <= 0) return false;
  const expires = account.free_month_expires_at ? new Date(account.free_month_expires_at).getTime() : null;
  if (expires === null || Number.isNaN(expires)) return false;
  return expires > Date.now();
}

// 统一解锁判定：付费订阅有效 或 赠送免费月生效中。
// 所有付费墙判定点（quotes/quotes-send/followups/inbound/dashboard）共用此语义。
export function isUnlocked(account: {
  paypal_subscription_id?: string | null;
  free_months_earned?: number | null;
  free_month_expires_at?: string | null;
} | null | undefined): boolean {
  if (!account) return false;
  const paid = !!account.paypal_subscription_id && isValidPaypalSubscriptionId(account.paypal_subscription_id);
  return paid || hasActiveFreeMonth(account);
}
