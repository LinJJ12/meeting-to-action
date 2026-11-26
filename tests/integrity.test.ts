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
it("extracts indented headings with BOM", () => {
  expect(normalizeTranscript("\ufeff  # Plan\n\nText", "x.MD").meeting.title).toBe("Plan");
});
