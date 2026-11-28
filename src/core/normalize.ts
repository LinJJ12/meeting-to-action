import { createHash } from "node:crypto";
import { basename, extname } from "node:path";
import { MeetingInputSchema, type MeetingInput } from "../domain/schema.js";
import { MAX_SEGMENTS } from "./limits.js";

/** 能识别的源逐字稿行格式；mixed 表示同一份文件里混用了多种。 */
export const TRANSCRIPT_FORMATS = [
  "speaker-header",
  "speaker-time",
  "speaker-inline",
  "timestamp-first",
  "speaker-colon",
  "speaker-bracket",
] as const;
export type TranscriptFormat = (typeof TRANSCRIPT_FORMATS)[number] | "mixed";

/** 非有限数或小于 1 的 maxSegments 回落到 MAX_SEGMENTS，有限数向下取整。 */
function resolveMaxSegments(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 1) return MAX_SEGMENTS;
  return Math.floor(value);
}

interface LineMeta {
  speaker?: string;
  timestamp?: string;
  format: TranscriptFormat;
}

/** 匿名说话人标签（说话人1/发言人2/Speaker 3），用于无时间戳行与时间戳在前行的保守识别。 */
const ANON_LABEL =
  /^(?:(?:说话人|发言人|参与者|嘉宾|主持人|speaker)\s*[_\-]?\s*\d{1,3}|嘉宾|主持人)$/i;

/** MM:SS 或 H:MM(:SS) 归一成两位 HH:MM:SS；其它形状原样返回（不猜测缺失的毫秒）。 */
function normalizeClock(value: string): string {
  const match = /^([0-9]{1,2}):([0-5][0-9])(?::([0-5][0-9]))?$/.exec(value);
  if (!match) return value;
  const pad = (part: string) => part.padStart(2, "0");
  const [, first, second, third] = match;
  if (third === undefined) return `00:${pad(first!)}:${pad(second!)}`;
  return `${pad(first!)}:${pad(second!)}:${pad(third!)}`;
}

/** 同行标签里一眼不是人名的字符：日期（年月日）、书名号、路径分隔符、百分比。 */
const NOT_INLINE_LABEL = /[年月日《》/\\%]/;

/**
 * 同行格式的标签校验：真实导出里会出现「4月20日 11:15 B1录音」这类标题行与
 * 「《/tmp/…》」这类路径行，它们长得像 `标签 时间 正文` 但不是发言，不能把
 * speaker 挂到标题上（否则证据会指向错误的人）。
 */
function isInlineSpeakerLabel(label: string): boolean {
  return (
    label.length > 0 && label.length <= 20 && !NOT_INLINE_LABEL.test(label) && /\p{L}/u.test(label)
  );
}

/**
 * 判断一行是否开启一段新发言。
 * 只认完整表头、带时间戳的同行格式、匿名说话人标签；普通正文（含 "Decision: ..."）不猜。
 */
function parseLineMeta(line: string): LineMeta | undefined {
  const text = line.trim();
  const header = /^([^()\r\n]{1,100})\(([0-9]{2}:[0-5][0-9]:[0-5][0-9])\)[:：]$/.exec(text);
  if (header)
    return { speaker: header[1]!.trim(), timestamp: header[2]!, format: "speaker-header" };
  // 独立成行的「说话人 + 时间码」表头，例如 `说话人1 00:00` / `说话人1（质量管理部部长） 00:25`。
  // 只认匿名说话人标签，避免把「会议时间 00:05」这类正文误判成新发言。
  const speakerTime = /^(.{1,120}?)\s+([0-9]{1,2}:[0-5][0-9](?::[0-5][0-9])?)$/.exec(text);
  if (speakerTime) {
    const label = speakerTime[1]!.replace(/[（(][^）)]*[）)]\s*$/, "").trim();
    if (ANON_LABEL.test(label))
      return { speaker: label, timestamp: normalizeClock(speakerTime[2]!), format: "speaker-time" };
  }
  const inline = /^([^()\s:：]{1,50})\s+([0-9]{2}:[0-5][0-9](?::[0-5][0-9])?)\s+(\S.*)$/.exec(text);
  if (inline && isInlineSpeakerLabel(inline[1]!.trim()))
    return {
      speaker: inline[1]!.trim(),
      timestamp: normalizeClock(inline[2]!),
      format: "speaker-inline",
    };
  const timestampFirst = /^([0-9]{2}:[0-5][0-9](?::[0-5][0-9])?)\s+([^\s:：]{1,50})\s+(\S.*)$/.exec(
    text,
  );
  if (timestampFirst && ANON_LABEL.test(timestampFirst[2]!.trim()))
    return {
      speaker: timestampFirst[2]!.trim(),
      timestamp: normalizeClock(timestampFirst[1]!),
      format: "timestamp-first",
    };
  // 方括号只认匿名说话人标签；【会议记录】这类正文标题不能挂成 speaker。
  const bracketed = /^【([^】\r\n]{1,50})】\s*(.*)$/.exec(text);
  if (bracketed && ANON_LABEL.test(bracketed[1]!.trim()))
    return { speaker: bracketed[1]!.trim(), format: "speaker-bracket" };
  const colon = /^([^\s:：]{1,20})[：:]\s*(.+)$/.exec(text);
  if (colon && ANON_LABEL.test(colon[1]!.trim()))
    return { speaker: colon[1]!.trim(), format: "speaker-colon" };
  return undefined;
}

export function normalizeTranscript(
  content: string,
  fileName: string,
  options: { title?: string; maxSegments?: number } = {},
): MeetingInput {
  if (!content.trim()) throw new Error("INPUT_EMPTY: transcript content is empty");
  const ext = extname(fileName).toLowerCase();
  if (![".txt", ".md", ".markdown"].includes(ext))
    throw new Error("INPUT_UNSUPPORTED: expected TXT or Markdown");
  const sourceId = createHash("sha256")
    .update(fileName + "\0" + content)
    .digest("hex")
    .slice(0, 16);
  const maxSegments = resolveMaxSegments(options.maxSegments);
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const segments: MeetingInput["segments"] = [];
  const formats = new Set<TranscriptFormat>();
  let buffer: string[] = [],
    start = 1,
    meta: LineMeta | undefined;
  const flush = (end: number) => {
    // 契约（docs/en/contracts/DATA-SCHEMA.md）：segment.text 与源文件对应行逐字一致，因此只 trim 判空。
    const text = buffer.join("\n");
    if (text.trim()) {
      // 到达上限立即停止：先拒绝，再构造 segment，避免超大输入先把内存吃完再报错。
      if (maxSegments !== undefined && segments.length >= maxSegments)
        throw new Error(`INPUT_SEGMENT_LIMIT: transcript has more than ${maxSegments} segments`);
      if (meta?.format) formats.add(meta.format);
      // Recognize only a complete export header. A label is not proof of a person's identity.
      segments.push({
        id: "seg-" + (segments.length + 1),
        sourceId,
        text,
        lineStart: start,
        lineEnd: end,
        ...(meta?.speaker ? { speaker: meta.speaker } : {}),
        ...(meta?.timestamp ? { timestamp: meta.timestamp } : {}),
      });
    }
    buffer = [];
    meta = undefined;
  };
  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const isSeparator = /^[-=_*~\s]{3,}$/.test(line.trim());
    if (!line.trim() || isSeparator) {
      flush(index);
      start = lineNo + 1;
      return;
    }
    const parsed = parseLineMeta(line);
    if (parsed) {
      flush(index);
      start = lineNo;
      meta = parsed;
    } else if (!buffer.length) {
      start = lineNo;
    }
    buffer.push(line);
  });
  flush(lines.length);
  // 只有分隔线/空行的输入没有任何 segment：明确报 INPUT_EMPTY，而不是抛 ZodError。
  if (!segments.length) throw new Error("INPUT_EMPTY: transcript has no text segments");
  const detected: TranscriptFormat | undefined =
    formats.size === 0 ? undefined : formats.size === 1 ? [...formats][0] : "mixed";
  const heading = lines
    .find((line) => /^#\s+/.test(line.trim()))
    ?.trim()
    .replace(/^#\s+/, "")
    .trim();
  return MeetingInputSchema.parse({
    schemaVersion: "1.0",
    meeting: {
      id: "meeting-" + sourceId,
      title: options.title?.trim() || heading || basename(fileName, ext),
    },
    sources: [
      {
        id: sourceId,
        kind: "transcript",
        format: ext === ".txt" ? "txt" : "markdown",
        fileName,
        checksum: createHash("sha256").update(content).digest("hex"),
        ...(detected ? { transcriptFormat: detected } : {}),
      },
    ],
    segments,
  });
}
