/** 统计字符串中未与配对代理结伴的 UTF-16 代理码元数量（正常应为 0）。 */
export function countLoneSurrogates(value: string): number {
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) index += 1;
      else count += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) count += 1;
  }
  return count;
}
