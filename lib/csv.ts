// CSV 单元格转义：双引号包裹 + 防公式注入（CSV Formula Injection）。
// Excel/WPS/Numbers 会把以 = + - @ 或制表符/回车开头的单元格当公式执行，
// 客户自填内容（邮箱/描述）里含 "=HYPERLINK(...)" 之类会造成公式注入，
// 打开导出文件即触发。前置单引号是最通用的中立化方式。
export function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  const guarded = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return `"${guarded.replace(/"/g, '""')}"`;
}
