import { z } from "zod";
import type { MeetingAnalysis } from "../domain/schema.js";
import {
  MINUTES_CONTRACT_VERSION,
  MinutesDocumentSchema,
  type MinutesClaim,
  type MinutesDocument,
  type MinutesErrorCode,
} from "../domain/minutes.js";

export type MinutesFactKind = "decision" | "action" | "risk" | "openQuestion" | "conflict";
type FactEntry = { kind: MinutesFactKind; status?: string };
const PROGRESS_ACTION_STATUSES = new Set(["done", "in_progress", "blocked"]);

/** Deterministic minutes-contract@1.0 failure; `code` is one of MINUTES_ERROR_CODES. */
export class MinutesContractError extends Error {
  readonly code: MinutesErrorCode;
  constructor(code: MinutesErrorCode, detail?: string) {
    super(detail ? code + ": " + detail : code);
    this.name = "MinutesContractError";
    this.code = code;
  }
}

/**
 * Validate a host-model-authored minutes document against the analysis it summarizes.
 * Only structure and id mapping are deterministic; topic grouping and wording stay
 * with the host model. `input` (the normalized transcript) is accepted for future
 * evidence cross-checks and is intentionally unused in minutes-contract@1.0.
 */
export function validateMinutes(
  input: unknown,
  analysis: MeetingAnalysis,
  minutes: unknown,
): MinutesDocument {
  void input;
  const draft =
    minutes !== null && typeof minutes === "object"
      ? (minutes as { contractVersion?: unknown })
      : undefined;
  if (
    typeof draft?.contractVersion === "string" &&
    draft.contractVersion !== MINUTES_CONTRACT_VERSION
  )
    throw new MinutesContractError(
      "MINUTES_CONTRACT_UNSUPPORTED",
      "contractVersion=" + draft.contractVersion + "，当前仅支持 " + MINUTES_CONTRACT_VERSION,
    );
  let document: MinutesDocument;
  try {
    document = MinutesDocumentSchema.parse(minutes);
  } catch (error) {
    throw new MinutesContractError("MINUTES_SCHEMA_INVALID", describeSchemaIssues(error));
  }
  if (document.meetingId !== analysis.meetingId)
    throw new MinutesContractError(
      "MINUTES_MEETING_MISMATCH",
      "minutes=" + document.meetingId + "，analysis=" + analysis.meetingId,
    );
  const facts = new Map<string, FactEntry[]>();
  const addFact = (id: string, kind: MinutesFactKind, status?: string) => {
    const entry = { kind, ...(status === undefined ? {} : { status }) };
    const entries = facts.get(id);
    if (entries) entries.push(entry);
    else facts.set(id, [entry]);
  };
  for (const item of analysis.decisions) addFact(item.id, "decision");
  for (const item of analysis.actionItems) addFact(item.id, "action", item.status);
  for (const item of analysis.risks) addFact(item.id, "risk");
  for (const item of analysis.openQuestions) addFact(item.id, "openQuestion");
  for (const item of analysis.conflicts) addFact(item.id, "conflict");
  if (!document.sections.length && facts.size)
    throw new MinutesContractError("MINUTES_SCHEMA_INVALID", "存在可引用条目时 sections 不能为空");
  const referenced = new Set<string>();
  const claimIds = new Set<string>();
  for (const section of document.sections)
    for (const claim of section.claims) {
      if (claimIds.has(claim.id))
        throw new MinutesContractError("MINUTES_SCHEMA_INVALID", "sections.claims.id 必须唯一");
      claimIds.add(claim.id);
      for (const ref of claim.refs) {
        const entries = facts.get(ref);
        if (!entries)
          throw new MinutesContractError("MINUTES_REF_UNKNOWN", claim.id + " -> " + ref);
        if (!entries.some((entry) => claimSupports(claim.kind, entry)))
          throw new MinutesContractError(
            "MINUTES_KIND_MISMATCH",
            claim.id + "（kind=" + claim.kind + "）不能引用 " + ref,
          );
        if (entries.some((entry) => entry.kind === "action" && claimSupports(claim.kind, entry)))
          referenced.add(ref);
      }
    }
  const missing = analysis.actionItems
    .filter((item) => !referenced.has(item.id))
    .map((item) => item.id);
  if (missing.length)
    throw new MinutesContractError(
      "MINUTES_ACTION_COVERAGE",
      "未被任何 claim 引用的行动项：" + missing.join("，"),
    );
  return document;
}

export function claimSupports(kind: MinutesClaim["kind"], entry: FactEntry): boolean {
  switch (kind) {
    case "decision":
      return entry.kind === "decision";
    case "followup":
      return entry.kind === "action";
    case "progress":
      return (
        entry.kind === "decision" ||
        (entry.kind === "action" &&
          entry.status !== undefined &&
          PROGRESS_ACTION_STATUSES.has(entry.status))
      );
    case "open":
      return entry.kind === "risk" || entry.kind === "openQuestion" || entry.kind === "conflict";
  }
}

function describeSchemaIssues(error: unknown): string {
  if (!(error instanceof z.ZodError)) return "minutes 文档结构不合法";
  const first = error.issues[0];
  const path = first && first.path.length ? first.path.join(".") : "(root)";
  return (
    "字段 " +
    path +
    " 违反 minutes-contract@" +
    MINUTES_CONTRACT_VERSION +
    "（共 " +
    error.issues.length +
    " 处）"
  );
}
