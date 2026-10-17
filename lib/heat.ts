// 热单三级 hot/warm/cold（整改清单第12项）
// 实用优先的轻量规则，不做复杂打分模型：
//   hot  = 客户在谈 / 自动跟进未过期（热）
//   warm = 跟进暂停（客户回过但需新报价激活）或跟进已滞后
//   cold = 已关闭/流失/付款，或长期无响应（30 天以上无新动作）

export type HeatLevel = 'hot' | 'warm' | 'cold';

export interface HeatInfo {
  level: HeatLevel;
  label: string;
  color: string;
  reason: string;
}

export interface HeatInput {
  status: string;
  quote_date?: string | null;
  next_followup_at?: string | null;
  followup_count?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeHeat(q: HeatInput): HeatInfo {
  const now = Date.now();
  const status = q.status || '';

  const quoteTs = q.quote_date ? new Date(q.quote_date).getTime() : NaN;
  const nextTs = q.next_followup_at ? new Date(q.next_followup_at).getTime() : NaN;
  const hasNext = !Number.isNaN(nextTs);
  const quoteAge = Number.isNaN(quoteTs) ? NaN : (now - quoteTs) / DAY_MS;

  // 已关闭 / 流失 / 已付款 / 历史遗留终止态 → cold
  if (['closed', 'lost', 'paid', 'stopped'].includes(status)) {
    return {
      level: 'cold',
      label: 'Cold',
      color: '#6b7280',
      reason: 'Closed or no longer pursuing',
    };
  }

  // 客户在谈：replied = 客户刚回复（自动跟进已暂停，属于热讨论中）
  if (status === 'replied') {
    return {
      level: 'hot',
      label: 'Hot',
      color: '#f87171',
      reason: 'Client just replied — actively talking',
    };
  }

  // 跟进中：跟进计划未过期 → hot；已过期 → warm（需重新激活）
  if (status === 'following') {
    if (hasNext && nextTs >= now) {
      return {
        level: 'hot',
        label: 'Hot',
        color: '#f87171',
        reason: 'Auto follow-up active — next one scheduled',
      };
    }
    if (!Number.isNaN(quoteAge) && quoteAge <= 7) {
      return {
        level: 'hot',
        label: 'Hot',
        color: '#f87171',
        reason: 'Quoted recently — follow-up window open',
      };
    }
    return {
      level: 'warm',
      label: 'Warm',
      color: '#fbbf24',
      reason: hasNext
        ? 'Follow-up overdue — consider a new quote/ping'
        : 'No follow-up scheduled — needs attention',
    };
  }

  // 暂停跟进 → warm（客户回复过，发新报价/发票即可恢复）
  if (status === 'paused') {
    return {
      level: 'warm',
      label: 'Warm',
      color: '#fbbf24',
      reason: 'Paused — send a new quote/invoice to resume',
    };
  }

  // 长期无响应（其它状态但报价已超 30 天）→ cold
  if (!Number.isNaN(quoteAge) && quoteAge > 30) {
    return {
      level: 'cold',
      label: 'Cold',
      color: '#6b7280',
      reason: 'No activity in 30+ days',
    };
  }

  return {
    level: 'warm',
    label: 'Warm',
    color: '#fbbf24',
    reason: 'Needs attention',
  };
}
