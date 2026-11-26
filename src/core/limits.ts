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
    throw new Error(
      `INPUT_SIZE_LIMIT: transcript is ${bytes} bytes, limit is ${MAX_CONTENT_BYTES}`,
    );
  }
}

/**
 * analysis JSON 的字节上限。report 只读本地文件、不调用模型，但超大的 analysis
 * 仍会放大证据校验与渲染的 CPU/内存开销，因此在读取前单独拦截。
 * MCP 路径由 MAX_REQUEST_BYTES 兜底（两者取值相同）。
 */
export const MAX_ANALYSIS_BYTES = 4 * 1024 * 1024;

/** 单个分析条目（topic/decision/...）允许的 evidence 引用数上限，防止证据校验被放大。 */
export const MAX_EVIDENCE_REFS_PER_ENTRY = 200;

/** 单条 evidence quote 的字符数上限（UTF-16），超长引文在被反复包含检查前就拒绝。 */
export const MAX_QUOTE_CHARS = 4000;

/**
 * 单个 MCP 工具调用的 CPU 时间预算（毫秒）。
 * 证据索引把最坏路径降到几十毫秒，但 handler 仍应有一个硬上限：
 * 超过预算时抛 WORK_LIMIT_EXCEEDED，避免异常输入长时间占住事件循环。
 */
export const MAX_TOOL_WORK_MS = 5_000;

/** 已解析 meeting input 的最小结构视图，供 limits 层复用而不反向依赖 domain/schema。 */
export interface MeetingInputLike {
  segments: ReadonlyArray<{ text: string }>;
}

/**
 * 已解析 meeting input 的统一资源校验：先看段数，再看所有 segment 文本的 UTF-8 总字节数。
 * CLI report 与 MCP 工具共用，保证两条入口对同一份输入得出相同结论。
 */
export function assertMeetingInputWithinLimits(input: MeetingInputLike): void {
  const segmentCount = input.segments.length;
  if (segmentCount > MAX_SEGMENTS) {
    throw new Error(
      `INPUT_SEGMENT_LIMIT: input has ${segmentCount} segments, limit is ${MAX_SEGMENTS}`,
    );
  }
  let bytes = 0;
  for (const segment of input.segments) {
    bytes += Buffer.byteLength(segment.text, "utf8");
  }
  if (bytes > MAX_CONTENT_BYTES) {
    throw new Error(`INPUT_SIZE_LIMIT: input is ${bytes} bytes, limit is ${MAX_CONTENT_BYTES}`);
  }
}
