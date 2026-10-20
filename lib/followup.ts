// 跟进引擎：决定某个 quote 接下来什么时候该发第几封跟进邮件。
// 序列：第 1 / 3 / 7 天（从报价日期起算），发完第 3 封后停止。

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
