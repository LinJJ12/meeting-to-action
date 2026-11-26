import {
  EvidenceRefSchema,
  MeetingInputSchema,
  type EvidenceRef,
  type MeetingInput,
} from "../domain/schema.js";
import { MAX_EVIDENCE_REFS_PER_ENTRY, MAX_QUOTE_CHARS } from "./limits.js";

export type EvidenceMode = "fragment" | "strict";

type Segment = MeetingInput["segments"][number];

/** 同一 (sourceId, lineStart, lineEnd) 的候选集合与切片文本，只计算一次。 */
interface RangeSelection {
  segments: Segment[];
  /** 每个候选中被引用行区间对应的文本（与 segments 一一对应）。 */
  texts: string[];
  /** texts 以换行拼接成的检索缓冲，用于不含换行的 quote；首次使用时构建。 */
  haystack: string | undefined;
}

/**
 * 一次构建、多次复用的证据索引。把逐 ref 的整表扫描降为对同源 segment 的
 * 一次过滤，并且同一行区间的候选/切片文本在本次校验内只计算一次。
 */
export interface EvidenceIndex {
  /** 合法 source id 集合，用于 O(1) 的未知来源判断。 */
  sourceIds: Set<string>;
  /** segmentId → segment，用于 O(1) 的精确命中。 */
  segmentsById: Map<string, Segment>;
  /** sourceId → 该来源的全部 segment，保持输入顺序。 */
  segmentsBySource: Map<string, Segment[]>;
  /** JSON.stringify([sourceId, lineStart, lineEnd]) → 覆盖该区间的候选。 */
  ranges: Map<string, RangeSelection>;
}

/** 为一份 meeting input 构建证据索引；O(segments)。 */
export function buildEvidenceIndex(input: MeetingInput): EvidenceIndex {
  const index: EvidenceIndex = {
    sourceIds: new Set(input.sources.map((source) => source.id)),
    segmentsById: new Map<string, Segment>(),
    segmentsBySource: new Map<string, Segment[]>(),
    ranges: new Map<string, RangeSelection>(),
  };
  for (const segment of input.segments) {
    index.segmentsById.set(segment.id, segment);
    const group = index.segmentsBySource.get(segment.sourceId);
    if (group) group.push(segment);
    else index.segmentsBySource.set(segment.sourceId, [segment]);
  }
  return index;
}

/** 取覆盖 [start, end] 的同源候选；结果按 (sourceId, start, end) 缓存。 */
function rangeSelection(
  index: EvidenceIndex,
  sourceId: string,
  start: number,
  end: number,
): RangeSelection {
  const key = JSON.stringify([sourceId, start, end]);
  const cached = index.ranges.get(key);
  if (cached) return cached;
  const segments = (index.segmentsBySource.get(sourceId) ?? []).filter(
    (candidate) => candidate.lineStart <= start && candidate.lineEnd >= end,
  );
  const selection: RangeSelection = {
    segments,
    texts: segments.map((candidate) =>
      candidate.text.split("\n").slice(start - candidate.lineStart, end - candidate.lineStart + 1).join("\n"),
    ),
    haystack: undefined,
  };
  index.ranges.set(key, selection);
  return selection;
}

/**
 * 校验一条分析条目的一组 evidence 引用。
 * 传入已解析的 meeting input 时保持原有行为：一次校验内构建索引并复用。
 */
export function validateEvidence(
  input: MeetingInput,
  refs: EvidenceRef[],
  mode: EvidenceMode = "fragment",
): string[] {
  if (!MeetingInputSchema.safeParse(input).success) return ["Invalid meeting input"];
  return validateEvidenceWithIndex(buildEvidenceIndex(input), refs, mode);
}

/**
 * 使用预先构建的索引校验一组 refs（一个新分析条目的 evidence）。
 * 错误字符串、检查顺序与 fragment/strict 两种模式语义与旧实现保持一致；
 * 仅新增两类资源上限错误（单 entry 引用数、单条 quote 长度）。
 */
export function validateEvidenceWithIndex(
  index: EvidenceIndex,
  refs: EvidenceRef[],
  mode: EvidenceMode = "fragment",
  deadline?: number,
): string[] {
  const errors: string[] = [];
  if (refs.length > MAX_EVIDENCE_REFS_PER_ENTRY) {
    return [`Too many evidence references: ${refs.length}, limit is ${MAX_EVIDENCE_REFS_PER_ENTRY}`];
  }
  for (const ref of refs) {
    // 资源预算：调用方（MCP handler）传入绝对截止时间，超时立即终止而不是继续扫描。
    if (deadline !== undefined && Date.now() > deadline) {
      throw new Error("WORK_LIMIT_EXCEEDED");
    }
    if (!EvidenceRefSchema.safeParse(ref).success) {
      errors.push("Invalid evidence reference");
      continue;
    }
    if (!index.sourceIds.has(ref.sourceId)) {
      errors.push("Unknown source: " + ref.sourceId);
      continue;
    }
    if (ref.quote !== undefined && ref.quote.length > MAX_QUOTE_CHARS) {
      errors.push(`Evidence quote is ${ref.quote.length} characters, limit is ${MAX_QUOTE_CHARS}`);
      continue;
    }
    const segment = ref.segmentId === undefined ? undefined : index.segmentsById.get(ref.segmentId);
    if (ref.segmentId !== undefined && !segment) {
      errors.push("Unknown segment: " + ref.segmentId);
      continue;
    }
    if (segment && segment.sourceId !== ref.sourceId) {
      errors.push("Evidence source does not match segment");
      continue;
    }
    const start = ref.lineStart;
    const end = ref.lineEnd;
    if ((start === undefined) !== (end === undefined)) {
      errors.push("Evidence requires both line bounds");
      continue;
    }
    if (start !== undefined && end !== undefined && end < start) {
      errors.push("Evidence lineEnd precedes lineStart");
      continue;
    }
    if (mode === "strict") {
      if (!segment) {
        errors.push("Evidence requires a known segmentId in strict mode");
        continue;
      }
      if (start === undefined || end === undefined) {
        errors.push("Evidence requires complete line bounds in strict mode");
        continue;
      }
      if (start !== segment.lineStart || end !== segment.lineEnd) {
        errors.push("Evidence line bounds must match the cited segment in strict mode");
        continue;
      }
    }
    let selected: Segment[];
    let range: RangeSelection | undefined;
    if (segment) {
      selected =
        start === undefined || end === undefined || (segment.lineStart <= start && segment.lineEnd >= end)
          ? [segment]
          : [];
      if (start !== undefined && !selected.length) {
        errors.push("Evidence lines outside segment bounds");
        continue;
      }
    } else {
      // 无 segmentId 时 line bounds 必须成对出现（上面已校验），否则无法定位行区间。
      if (start === undefined || end === undefined) {
        errors.push("Evidence requires a segment or line range");
        continue;
      }
      range = rangeSelection(index, ref.sourceId, start, end);
      selected = range.segments;
      if (!selected.length) {
        errors.push("Evidence lines outside segment bounds");
        continue;
      }
    }
    if (
      (ref.speaker !== undefined || ref.timestamp !== undefined) &&
      !selected.some(
        (candidate) =>
          (ref.speaker === undefined || candidate.speaker === ref.speaker) &&
          (ref.timestamp === undefined || candidate.timestamp === ref.timestamp),
      )
    ) {
      errors.push("Evidence metadata does not match cited segment");
    }
    if (ref.quote !== undefined) {
      const quote = ref.quote;
      const selection = range;
      let matched: boolean;
      if (selection) {
        if (quote.includes("\n")) {
          matched = selection.texts.some((text) => text.includes(quote));
        } else {
          // 分隔符是换行：不含换行的 quote 若出现在拼接缓冲里，必然完整落在单个候选文本内。
          const haystack = selection.haystack ?? (selection.haystack = selection.texts.join("\n"));
          matched = haystack.includes(quote);
        }
      } else {
        matched = selected.some((candidate) => {
          const text =
            start === undefined || end === undefined
              ? candidate.text
              : candidate.text
                  .split("\n")
                  .slice(start - candidate.lineStart, end - candidate.lineStart + 1)
                  .join("\n");
          return text.includes(quote);
        });
      }
      if (!matched) errors.push("Evidence quote does not match cited text");
    }
  }
  return errors;
}

export function evidenceForSegment(input: MeetingInput, segmentId: string): EvidenceRef {
  MeetingInputSchema.parse(input);
  const segment = input.segments.find((candidate) => candidate.id === segmentId);
  if (!segment) throw new Error("EVIDENCE_REFERENCE_INVALID: " + segmentId);
  return {
    sourceId: segment.sourceId,
    segmentId,
    lineStart: segment.lineStart,
    lineEnd: segment.lineEnd,
    quote: segment.text.slice(0, 240),
    ...(segment.speaker ? { speaker: segment.speaker } : {}),
    ...(segment.timestamp ? { timestamp: segment.timestamp } : {}),
  };
}