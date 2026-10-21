// 共享的 Refer 完成判定（Refer 付费后补判定用）：
// 检查账号是否有 status='pending' 的被邀请记录，有则标记 completed 并发放 free_months_earned。
// 幂等：pending 乐观锁（更新条件 eq status=pending + 写回校验，0 行 = 已被并发完成）+ RPC 原子自增；
// 无 pending 直接返回 completed=0。
//
// 调用方：
//   - /api/account/bind-subscription（绑定订阅成功后补判定，skipVerify=true 信任绑定动作）
//   - /api/webhooks/paypal ACTIVATED（订阅激活确认后补判定，skipVerify=true 信任 webhook）
//   - /api/referral/complete 保留原有独立实现作为 signup 的 HTTP 入口（历史调用不变）
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidPaypalSubscriptionId, verifyPaypalSubscription } from '@/lib/paypal';

export interface CompleteReferralResult {
  ok: boolean;
  completed: number;
  reason?: string;
}

export async function completePendingReferrals(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  opts?: { skipVerify?: boolean }
): Promise<CompleteReferralResult> {
  try {
    // 先验证这个用户确实有有效的 PayPal 订阅
    const { data: acc, error: accErr } = await admin
      .from('accounts')
      .select('id, email, paypal_subscription_id')
      .eq('id', userId)
      .maybeSingle();
    if (accErr) {
      return { ok: false, completed: 0, reason: `account query error: ${accErr.code}` };
    }
    if (!acc || !acc.paypal_subscription_id || !isValidPaypalSubscriptionId(acc.paypal_subscription_id)) {
      return { ok: false, completed: 0, reason: 'user is not a paid subscriber' };
    }

    // 二次确认订阅 ACTIVE（新入口已由绑定/webhook 确认激活，可跳过以减少外部调用）
    if (!opts?.skipVerify) {
      const verify = await verifyPaypalSubscription(acc.paypal_subscription_id);
      if (!verify.ok) {
        return { ok: false, completed: 0, reason: `subscription not active: ${verify.reason}` };
      }
    }

    // 查 pending referrals（被邀请记录）
    const { data: pending, error: qErr } = await admin
      .from('referrals')
      .select('id, referrer_id, referred_id, free_months_granted, status')
      .eq('referred_id', userId)
      .eq('status', 'pending');
    if (qErr) {
      return { ok: false, completed: 0, reason: `pending query error: ${qErr.code}` };
    }
    if (!pending || pending.length === 0) {
      return { ok: true, completed: 0 };
    }

    // 每个 pending referral 标记完成（乐观锁：更新条件 eq status=pending + 写回校验，防并发重复发放）
    const completedRefs: { referrer_id: string }[] = [];
    for (const r of pending) {
      const { data: updated, error: updateErr } = await admin
        .from('referrals')
        .update({
          status: 'completed',
          free_months_granted: 1,
          completed_at: new Date().toISOString(),
          subscription_id: acc.paypal_subscription_id,
        })
        .eq('id', r.id)
        .eq('status', 'pending')
        .select('referrer_id')
        .maybeSingle();
      if (!updateErr && updated) {
        completedRefs.push(updated);
      }
    }
    const completed = completedRefs.length;
    if (completed === 0) {
      return { ok: true, completed: 0 };
    }

    // 发放：按 referrer 聚合本轮完成数（同一 referrer 多条 referral 要累加），被荐人本人 +1
    const grantCount = new Map<string, number>();
    for (const ref of completedRefs) {
      grantCount.set(ref.referrer_id, (grantCount.get(ref.referrer_id) || 0) + 1);
    }
    grantCount.set(userId, (grantCount.get(userId) || 0) + 1);
    for (const [accountId, months] of grantCount) {
      // 优先原子自增（迁移 017 RPC），不可用时回退读后写（兼容期）
      const { error: rpcErr } = await admin.rpc('increment_free_months', {
        account_id: accountId,
        months,
      });
      if (rpcErr) {
        console.warn('[referral-complete] rpc increment_free_months unavailable, fallback to read-modify-write:', rpcErr.code);
        const { data: accData } = await admin
          .from('accounts')
          .select('free_months_earned')
          .eq('id', accountId)
          .maybeSingle();
        if (accData) {
          await admin
            .from('accounts')
            .update({ free_months_earned: (accData.free_months_earned || 0) + months })
            .eq('id', accountId);
        }
      }
    }

    console.log('[referral-complete] completed', completed, 'referral(s) for user:', userId);
    return { ok: true, completed };
  } catch (e: any) {
    console.error('[referral-complete] unexpected error:', e?.message || e);
    return { ok: false, completed: 0, reason: 'internal error' };
  }
}
