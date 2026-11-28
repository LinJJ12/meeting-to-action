/**
 * 按 Unicode 码点截断文本，绝不让代理对（如 emoji）被切开变成孤立代理码元。
 * `limit` 计的是可见字符（码点）数；只有确实超过上限时才追加省略标记。
 * 需要逐字前缀时（例如证据引文）传空字符串当省略标记。
 */
export function truncateText(text: string, limit: number, ellipsis = "…"): string {
  const max = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;
  // UTF-16 长度不小于码点数：长度已在上限内时无需再切。
  if (text.length <= max) return text;
  const chars = Array.from(text);
  return chars.length <= max ? text : chars.slice(0, max).join("") + ellipsis;
}
