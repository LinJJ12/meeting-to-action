/**
 * 输入上限。CLI 与 MCP 工具共用同一套常量，避免两条入口的资源策略不一致。
 *
 * 这些上限的用途是防止畸形或超长输入在本地耗尽内存/CPU，而不是替代业务校验。
 */
export const MAX_CONTENT_BYTES = 2 * 1024 * 1024;
export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
export const MAX_SEGMENTS = 10_000;

/** 在解析或规范化之前先按字节数拦截超大输入。 */
export function assertContentWithinLimit(content: string): void {
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > MAX_CONTENT_BYTES) {
    throw new Error(`INPUT_SIZE_LIMIT: transcript is ${bytes} bytes, limit is ${MAX_CONTENT_BYTES}`);
  }
}