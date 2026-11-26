import { it, expect } from "vitest";
import { normalizeTranscript } from "../src/core/normalize.js";
import { evidenceForSegment } from "../src/core/evidence.js";
import { validateAnalysis } from "../src/core/analysis.js";
const input = normalizeTranscript("Alice: I will review.", "meeting.txt");
const draft = () => ({
  schemaVersion: "1.0",
  meetingId: input.meeting.id,
  generatedAt: "2026-01-01T00:00:00Z",
  summary: [],
  topics: [],
  decisions: [],
  actionItems: [
    {
      id: "a1",
      title: "Review",
      status: "accepted",
      confidence: "high",
      evidence: [evidenceForSegment(input, "seg-1")],
    },
  ],
  risks: [],
  openQuestions: [],
  conflicts: [],
});
it("accepts host-authored analysis without a model provider", () => {
  expect(validateAnalysis(input, draft()).actionItems).toHaveLength(1);
});
it("rejects meeting mismatches, fabricated evidence and duplicate items", () => {
  expect(() => validateAnalysis(input, { ...draft(), meetingId: "other" })).toThrow(/MISMATCH/);
  const d = draft();
  d.actionItems[0]!.evidence[0]!.quote = "invented";
  expect(() => validateAnalysis(input, d)).toThrow(/EVIDENCE/);
  const dup = draft();
  dup.actionItems.push(dup.actionItems[0]!);
  expect(() => validateAnalysis(input, dup)).toThrow(/DUPLICATE/);
});
