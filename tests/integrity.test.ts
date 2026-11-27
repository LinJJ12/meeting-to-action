import { it, expect } from "vitest";
import { normalizeTranscript } from "../src/core/normalize.js";
import { evidenceForSegment, validateEvidence } from "../src/core/evidence.js";
import { MeetingInputSchema } from "../src/domain/schema.js";
it("rejects fabricated quotes, invalid lines and mismatched sources", () => {
  const x = normalizeTranscript("Alice: defer.\nBob: review.", "x.md");
  x.sources.push({ ...x.sources[0]!, id: "other" });
  const ref = evidenceForSegment(x, "seg-1");
  for (const change of [
    { quote: "Ship now" },
    { lineStart: 99, lineEnd: 100 },
    { lineStart: 0 },
    { sourceId: "other" },
    { lineStart: 2, lineEnd: 2, quote: "Alice" },
  ])
    expect(validateEvidence(x, [{ ...ref, ...change }]).length).toBeGreaterThan(0);
  expect(validateEvidence(x, [ref])).toEqual([]);
});
it("rejects duplicate segment ids and unknown sources", () => {
  const x = normalizeTranscript("Text", "x.txt");
  x.segments.push({ ...x.segments[0]! });
  expect(MeetingInputSchema.safeParse(x).success).toBe(false);
  x.segments.pop();
  x.segments[0]!.sourceId = "missing";
  expect(MeetingInputSchema.safeParse(x).success).toBe(false);
});
it("rejects overlapping segment line ranges within one source", () => {
  const x = normalizeTranscript("Alice: a\n\nBob: b", "x.md"); // seg-1: 1–1, seg-2: 3–3
  x.segments[1]!.lineStart = 1; // 完全相同的区间：1–1 与 1–1
  expect(MeetingInputSchema.safeParse(x).success).toBe(false);
  x.segments[1]!.lineStart = 3;
  x.segments[0]!.lineEnd = 3; // 部分重叠：1–3 与 3–3
  expect(MeetingInputSchema.safeParse(x).success).toBe(false);
  x.segments[0]!.lineEnd = 1;
  x.segments[1]!.lineStart = 1; // 嵌套包含：1–1 被 1–3 覆盖
  expect(MeetingInputSchema.safeParse(x).success).toBe(false);
});
it("allows adjacent and gapped ranges, and isolates the check per source", () => {
  const x = normalizeTranscript("Alice: a\n\nBob: b", "x.md"); // seg-1: 1–1, seg-2: 3–3
  x.segments[0]!.lineEnd = 2; // 相邻：1–2 与 3–3
  expect(MeetingInputSchema.safeParse(x).success).toBe(true);
  x.segments[1]!.lineStart = 5; // 有空隙：1–2 与 5–5
  x.segments[1]!.lineEnd = 5;
  expect(MeetingInputSchema.safeParse(x).success).toBe(true);
  x.sources.push({ ...x.sources[0]!, id: "other" });
  x.segments.push(
    { id: "seg-a", sourceId: "other", text: "t", lineStart: 1, lineEnd: 1 },
    { id: "seg-b", sourceId: "other", text: "t", lineStart: 1, lineEnd: 2 },
  ); // 重叠只发生在 other 来源
  expect(MeetingInputSchema.safeParse(x).success).toBe(false);
});
it("extracts indented headings with BOM", () => {
  expect(normalizeTranscript("\ufeff  # Plan\n\nText", "x.MD").meeting.title).toBe("Plan");
});
