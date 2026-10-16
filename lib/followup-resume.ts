import { scheduleForDay } from '@/lib/followup';

// 恢复跟进：同一客户有新报价/发票发出时，把该客户所有 paused 状态的旧报价
// 恢复为 following（active），并从头重排跟进序列（Day1 明天 09:00）。
// 简单可靠优先：不引入 AI 判断，只按 customer_email 匹配。
export async function resumePausedFollowupsForCustomer(
  admin: { from: (table: string) => any },
  accountId: string,
  customerEmail: string,
  excludeQuoteId?: string
): Promise<number> {
  if (!customerEmail) return 0;

  const { data: pausedQuotes, error } = await admin
    .from('quotes')
    .select('id')
    .eq('account_id', accountId)
    .eq('customer_email', customerEmail)
    .eq('status', 'paused');

  if (error || !pausedQuotes || pausedQuotes.length === 0) return 0;

  const ids = pausedQuotes
    .map((q: { id: string }) => q.id)
    .filter((id: string) => id !== excludeQuoteId);

  if (ids.length === 0) return 0;

  const now = new Date();
  await admin
    .from('quotes')
    .update({
      status: 'following',
      followup_count: 0,
      last_followup_at: null,
      next_followup_at: scheduleForDay(now, 1).toISOString(),
    })
    .in('id', ids);

  return ids.length;
}
