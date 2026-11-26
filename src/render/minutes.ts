import type { EvidenceRef, MeetingAnalysis, MeetingInput } from "../domain/schema.js";
import type { MinutesClaim, MinutesDocument, MinutesMeta } from "../domain/minutes.js";
import { validateMinutes } from "../core/minutes.js";
import { escapeMarkdownInline as text } from "./escape.js";
import { renderMarkdown } from "./markdown.js";

export type ReadingMode = "minutes" | "actions" | "evidence";
export interface RenderMinutesOptions {
  mode?: ReadingMode;
  appendix?: boolean;
}

type ActionItem = MeetingAnalysis["actionItems"][number];
type ActionStatus = ActionItem["status"];
type FactKind = "decision" | "action" | "risk" | "openQuestion" | "conflict";
interface AnalysisFact {
  kind: FactKind;
  summary: string;
  evidence: EvidenceRef[];
  decisionStatus?: string;
}

const READING_MODES: readonly string[] = ["minutes", "actions", "evidence"];

/** CLI 的 `--mode` 与 MCP 的 `mode` 共用同一份合法取值。 */
export function isReadingMode(value: string): value is ReadingMode {
  return READING_MODES.includes(value);
}

/**
 * CLI 与 MCP 共用的模式决议：显式模式优先（非法值抛 RENDER_MODE_INVALID）；未提供时
 * 有 minutes 编辑稿默认 minutes、没有则默认 evidence。缺编辑稿却要求 minutes/actions
 * 属于接线层错误，抛 MINUTES_MISSING 由入口呈现为机器码。
 */
export function resolveReadingMode(mode: string | undefined, hasMinutes: boolean): ReadingMode {
  if (mode !== undefined && !isReadingMode(mode)) throw new Error("RENDER_MODE_INVALID: " + mode);
  const resolved: ReadingMode =
    mode !== undefined ? (mode as ReadingMode) : hasMinutes ? "minutes" : "evidence";
  if (!hasMinutes && resolved !== "evidence")
    throw new Error("MINUTES_MISSING: " + resolved + " 模式需要 minutes 编辑稿");
  return resolved;
}
const CLAIM_KIND_FALLBACK_LABELS: Record<Exclude<MinutesClaim["kind"], "decision">, string> = {
  progress: "进展",
  followup: "后续",
  open: "待确认",
};
const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  proposed: "提议",
  accepted: "已接受",
  in_progress: "进行中",
  done: "已完成",
  blocked: "受阻",
  unknown: "未确认",
};
const DECISION_STATUS_LABELS: Record<string, string> = {
  confirmed: "已确认决定",
  proposed: "提议",
  unclear: "待确认",
  rejected: "已否决",
  superseded: "已作废",
};
const FACT_KIND_LABELS: Record<FactKind, string> = {
  decision: "决定",
  action: "行动项",
  risk: "风险",
  openQuestion: "待确认问题",
  conflict: "分歧",
};
const UNSPECIFIED = "未指定";
const APPENDIX_QUOTE_LIMIT = 200;
const ACTION_LOCATOR_QUOTE_LIMIT = 80;
const DISCLAIMER = "标题与正文为编辑性整理，非事实断言；事实与证据以上述条目为准。";

/**
 * Render a minutes document for one reading mode. `minutes` and `actions` modes
 * validate the contract first (failures surface as MinutesContractError);
 * `evidence` mode is exactly the existing evidence report.
 */
export function renderMinutesDocument(
  input: MeetingInput,
  analysis: MeetingAnalysis,
  minutes: MinutesDocument,
  options: RenderMinutesOptions = {},
): string {
  const mode: string = options.mode ?? "minutes";
  if (!READING_MODES.includes(mode)) throw new Error("RENDER_MODE_INVALID: " + mode);
  if (mode === "evidence") return renderMarkdown(analysis);
  const document = validateMinutes(input, analysis, minutes);
  return mode === "actions"
    ? renderActionChecklist(input, analysis, document)
    : renderMinutesText(input, analysis, document, options.appendix !== false);
}

function renderMinutesText(
  input: MeetingInput,
  analysis: MeetingAnalysis,
  document: MinutesDocument,
  appendix: boolean,
): string {
  const blocks: string[] = ["# " + text(document.title)];
  const metaLine = renderMetaLine(document.meta);
  if (metaLine !== undefined) blocks.push(metaLine);
  if (document.highlights.length) blocks.push(renderHighlights(document.highlights));
  blocks.push(renderSections(analysis, document));
  blocks.push(renderTaskSection(analysis, document.actionNote));
  const open = renderOpenClaims(analysis, document);
  if (open !== undefined) blocks.push(open);
  if (appendix) blocks.push(renderTraceAppendix(input, analysis, document));
  return blocks.join("\n\n") + "\n";
}

function renderMetaLine(meta: MinutesMeta): string | undefined {
  const parts: string[] = [];
  if (meta.date !== undefined) parts.push("日期：" + text(meta.date));
  if (meta.participants !== undefined && meta.participants.length)
    parts.push("参会：" + meta.participants.map((participant) => text(participant)).join("、"));
  return parts.length ? parts.join(" ｜ ") : undefined;
}

function renderHighlights(highlights: string[]): string {
  return "## 会议要点\n" + highlights.map((highlight) => "- " + text(highlight)).join("\n");
}

function renderSections(analysis: MeetingAnalysis, document: MinutesDocument): string {
  const facts = indexAnalysisFacts(analysis);
  const lines: string[] = ["## 按议题整理"];
  for (const section of document.sections) {
    lines.push("### " + text(section.heading));
    for (const claim of section.claims) {
      lines.push("- **" + claimKindLabel(claim, facts) + "：**" + text(claim.text));
      if (claim.detail !== undefined) lines.push("  - " + text(claim.detail));
    }
  }
  return lines.join("\n");
}

/**
 * `decision` claims point at analysis decisions whose status may be proposed,
 * unclear, rejected or superseded — a roundtable "current practice" is not a
 * confirmed decision. Label by the referenced statuses so the minutes never
 * upgrade a proposal into a confirmed outcome; other kinds keep fixed labels.
 */
function claimKindLabel(claim: MinutesClaim, facts: Map<string, AnalysisFact>): string {
  if (claim.kind !== "decision") return CLAIM_KIND_FALLBACK_LABELS[claim.kind];
  const statuses = claim.refs
    .map((ref) => facts.get(ref)?.decisionStatus)
    .filter((status): status is string => status !== undefined);
  for (const status of ["proposed", "unclear", "rejected", "superseded"])
    if (statuses.includes(status)) return DECISION_STATUS_LABELS[status]!;
  return statuses.length ? DECISION_STATUS_LABELS.confirmed! : "决定";
}

/**
 * "Key unresolved items" aggregates only the open claims whose evidence points
 * at a conflict or a risk — i.e. the items that block or endanger the outcome.
 * Plain open questions already appear inside their topic section; repeating them
 * here would turn one unresolved point into two lines of the same document.
 */
function renderOpenClaims(
  analysis: MeetingAnalysis,
  document: MinutesDocument,
): string | undefined {
  const facts = indexAnalysisFacts(analysis);
  const claims = document.sections
    .flatMap((section) => section.claims)
    .filter(
      (claim) =>
        claim.kind === "open" &&
        claim.refs.some((ref) => {
          const kind = facts.get(ref)?.kind;
          return kind === "conflict" || kind === "risk";
        }),
    );
  if (!claims.length) return undefined;
  const lines: string[] = ["## 关键未决事项"];
  for (const claim of claims) {
    lines.push("- " + text(claim.text));
    if (claim.detail !== undefined) lines.push("  - " + text(claim.detail));
  }
  return lines.join("\n");
}

function renderTaskSection(analysis: MeetingAnalysis, actionNote?: string): string {
  const lines: string[] = ["## 集中待办"];
  const intro: string[] = [];
  if (actionNote !== undefined) intro.push(text(actionNote));
  intro.push(...taskCaveats(analysis));
  if (intro.length) lines.push(...intro);
  lines.push("", ...renderTaskTable(analysis));
  return lines.join("\n");
}

function renderActionChecklist(
  input: MeetingInput,
  analysis: MeetingAnalysis,
  document: MinutesDocument,
): string {
  const segments = indexSegments(input);
  const blocks: string[] = ["# 执行清单"];
  const intro: string[] = [];
  if (document.actionNote !== undefined) intro.push(text(document.actionNote));
  intro.push(...taskCaveats(analysis));
  if (intro.length) blocks.push(intro.join("\n"));
  blocks.push(renderTaskTable(analysis).join("\n"));
  const locators = analysis.actionItems.map(
    (item) =>
      "- " +
      text(item.title) +
      "：" +
      formatEvidenceLocator(item.evidence[0], ACTION_LOCATOR_QUOTE_LIMIT, false, segments),
  );
  if (locators.length) blocks.push(locators.join("\n"));
  return blocks.join("\n\n") + "\n";
}

function renderTaskTable(analysis: MeetingAnalysis): string[] {
  const rows = analysis.actionItems.map(
    (item) =>
      "| " +
      tableCell(item.title) +
      " | " +
      tableCell(item.assignee, UNSPECIFIED) +
      " | " +
      tableCell(item.dueDate, UNSPECIFIED) +
      " | " +
      actionStatusLabel(item.status) +
      " |",
  );
  const body = rows.length ? rows : ["| — | — | — | — |"];
  return ["| 任务 | 负责人 | 期限 | 状态 |", "|---|---|---|---|", ...body];
}

function actionStatusLabel(status: ActionStatus): string {
  const label = ACTION_STATUS_LABELS[status] as string | undefined;
  return label ?? text(status);
}

/**
 * Missing owner/deadline stay unknown once for the whole table instead of
 * repeating a placeholder in every row.
 */
function taskCaveats(analysis: MeetingAnalysis): string[] {
  if (!analysis.actionItems.length) return [];
  const lines: string[] = [];
  if (analysis.actionItems.every((item) => !item.assignee)) lines.push("负责人未在原文确认。");
  if (analysis.actionItems.every((item) => !item.dueDate)) lines.push("期限未在原文确认。");
  return lines;
}

/**
 * Same-file trace appendix: task-to-claim mapping plus every claim reference
 * resolved back to its analysis fact and source evidence. Exposed for tests so
 * unreachable-reference branches can be pinned; callers should render through
 * renderMinutesDocument instead.
 */
export function renderTraceAppendix(
  input: MeetingInput,
  analysis: MeetingAnalysis,
  document: MinutesDocument,
): string {
  const facts = indexAnalysisFacts(analysis);
  const segments = indexSegments(input);
  const claimIndex = indexActionItemClaims(document);
  const mappingRows = analysis.actionItems.map((item) => {
    const claimIds = claimIndex.get(item.id) ?? [];
    return (
      "| " +
      tableCell(item.id) +
      " | " +
      tableCell(item.title) +
      " | " +
      tableCell(claimIds.length ? claimIds.join("、") : "—（未映射）") +
      " |"
    );
  });
  const mappingLines = [
    "| 任务 ID | 任务 | 引用条目 |",
    "|---|---|---|",
    ...(mappingRows.length ? mappingRows : ["| — | — | — |"]),
  ];
  const claims = document.sections.flatMap((section) => section.claims);
  const evidenceLines = claims.map((claim) => renderClaimEvidence(claim, facts, segments));
  const evidenceBlock = evidenceLines.length ? evidenceLines.join("\n") : "- 无条目。";
  return [
    "## 溯源附录",
    "### 任务映射",
    mappingLines.join("\n"),
    "### 条目证据",
    evidenceBlock,
    DISCLAIMER,
  ].join("\n\n");
}

/** segmentId → 行范围与原文，用于把只有 segmentId 的证据还原到具体行号。 */
interface SegmentMeta {
  lineStart: number;
  lineEnd: number;
  text: string;
}
function indexSegments(input: MeetingInput): Map<string, SegmentMeta> {
  const segments = new Map<string, SegmentMeta>();
  for (const segment of input.segments)
    segments.set(segment.id, {
      lineStart: segment.lineStart,
      lineEnd: segment.lineEnd,
      text: segment.text,
    });
  return segments;
}

function indexAnalysisFacts(analysis: MeetingAnalysis): Map<string, AnalysisFact> {
  const facts = new Map<string, AnalysisFact>();
  const add = (
    kind: FactKind,
    id: string,
    summary: string,
    evidence: EvidenceRef[],
    decisionStatus?: string,
  ): void => {
    if (!facts.has(id))
      facts.set(id, {
        kind,
        summary,
        evidence,
        ...(decisionStatus !== undefined ? { decisionStatus } : {}),
      });
  };
  for (const item of analysis.decisions)
    add("decision", item.id, item.statement, item.evidence, item.status);
  for (const item of analysis.actionItems) add("action", item.id, item.title, item.evidence);
  for (const item of analysis.risks) add("risk", item.id, item.description, item.evidence);
  for (const item of analysis.openQuestions)
    add("openQuestion", item.id, item.question, item.evidence);
  for (const item of analysis.conflicts) add("conflict", item.id, item.description, item.evidence);
  return facts;
}

function indexActionItemClaims(document: MinutesDocument): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const section of document.sections)
    for (const claim of section.claims)
      for (const ref of claim.refs) {
        const claimIds = index.get(ref);
        if (claimIds) {
          if (!claimIds.includes(claim.id)) claimIds.push(claim.id);
        } else index.set(ref, [claim.id]);
      }
  return index;
}

function renderClaimEvidence(
  claim: MinutesClaim,
  facts: Map<string, AnalysisFact>,
  segments: Map<string, SegmentMeta>,
): string {
  const lines: string[] = [
    "- **" + text(claim.id) + "**（" + claimKindLabel(claim, facts) + "）：" + text(claim.text),
  ];
  for (const ref of claim.refs) {
    const fact = facts.get(ref);
    if (fact === undefined) {
      lines.push("  - " + text(ref) + "：未解析到分析条目（引用不可达）");
      continue;
    }
    lines.push(
      "  - " + text(ref) + "（" + FACT_KIND_LABELS[fact.kind] + "）：" + text(fact.summary),
    );
    if (fact.evidence.length)
      for (const evidence of fact.evidence)
        lines.push(
          "    - 证据：" + formatEvidenceLocator(evidence, APPENDIX_QUOTE_LIMIT, true, segments),
        );
    else lines.push("    - 证据：—");
  }
  return lines.join("\n");
}

function formatEvidenceLocator(
  ref: EvidenceRef | undefined,
  quoteLimit: number,
  fillMissing: boolean,
  segments?: Map<string, SegmentMeta>,
): string {
  if (ref === undefined) return "—";
  const parts: string[] = [text(ref.sourceId)];
  if (ref.segmentId !== undefined) parts.push(text(ref.segmentId));
  else if (fillMissing) parts.push("—");
  const lineRange = resolveLineRange(ref, segments);
  if (lineRange !== undefined) parts.push(lineRange);
  else if (fillMissing) parts.push("行 —");
  if (ref.timestamp !== undefined) parts.push(text(ref.timestamp));
  else if (fillMissing) parts.push("—");
  if (ref.quote !== undefined) parts.push("“" + text(truncate(ref.quote, quoteLimit)) + "”");
  else if (fillMissing) parts.push("—");
  return parts.join(" / ");
}

/**
 * 证据显式带行号时直接用；只有 segmentId 时回退到 segment 的原文行范围。
 * 引文能在 segment 里定位到时，再按换行位置换算成更精确的行号——
 * 这样溯源附录不会只剩一个「行 —」。
 */
function resolveLineRange(
  ref: EvidenceRef,
  segments: Map<string, SegmentMeta> | undefined,
): string | undefined {
  if (ref.lineStart !== undefined) return formatLineRange(ref.lineStart, ref.lineEnd);
  if (segments === undefined || ref.segmentId === undefined) return undefined;
  const segment = segments.get(ref.segmentId);
  if (segment === undefined) return undefined;
  if (ref.quote !== undefined) {
    const index = segment.text.indexOf(ref.quote);
    if (index >= 0) {
      const start = segment.lineStart + countNewlines(segment.text.slice(0, index));
      const end = start + countNewlines(ref.quote);
      return formatLineRange(start, end);
    }
  }
  return formatLineRange(segment.lineStart, segment.lineEnd);
}

function countNewlines(value: string): number {
  let count = 0;
  for (const char of value) if (char === "\n") count++;
  return count;
}

function formatLineRange(lineStart: number, lineEnd: number | undefined): string {
  if (lineEnd === undefined || lineEnd === lineStart) return "行 " + lineStart;
  return "行 " + lineStart + "–" + lineEnd;
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : value.slice(0, limit) + "…";
}

function tableCell(value: string | undefined, fallback = "—"): string {
  return value === undefined || value === "" ? fallback : text(value);
}
