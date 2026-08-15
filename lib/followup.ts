// 跟进引擎：决定某个 quote 接下来什么时候该发第几封跟进邮件。
// 序列：第 1 / 3 / 7 天（从报价日期起算），发完第 3 封后停止。

export type FollowupStep = 1 | 2 | 3;

export function nextStep(quoteDate: Date, now: Date = new Date()): FollowupStep | null {
  const dayDiff = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(quoteDate.getFullYear(), quoteDate.getMonth(), quoteDate.getDate())) /
      86400000
  );

  if (dayDiff >= 7) return 3;
  if (dayDiff >= 3) return 2;
  if (dayDiff >= 1) return 1;
  return null; // 当天，还没到跟进时间
}

// 下一次跟进的时间点：创建后第 1 / 3 / 7 天的 09:00 本地（用 UTC 近似）
export function scheduleForDay(quoteDate: Date, day: 1 | 2 | 3): Date {
  const d = new Date(
    Date.UTC(
      quoteDate.getUTCFullYear(),
      quoteDate.getUTCMonth(),
      quoteDate.getUTCDate() + (day === 1 ? 1 : day === 2 ? 3 : 7),
      9,
      0,
      0
    )
  );
  return d;
}
