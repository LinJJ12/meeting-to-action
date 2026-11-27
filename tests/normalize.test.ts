import { describe, it, expect } from "vitest";
import { normalizeTranscript } from "../src/core/normalize.js";
import { evidenceForSegment, validateEvidence } from "../src/core/evidence.js";
describe("transcript normalization", () => {
  it("preserves line ranges and checksum", () => {
    const t = "# Planning\n\nAlice: Ship import.\n\nBob: I can review.";
    const a = normalizeTranscript(t, "meeting.md"),
      b = normalizeTranscript(t, "meeting.md");
    expect(a.meeting.title).toBe("Planning");
    expect(a.segments[1]?.lineStart).toBe(3);
    expect(a.sources[0]?.checksum).toBe(b.sources[0]?.checksum);
  });
  it("rejects empty and unsupported input", () => {
    expect(() => normalizeTranscript(" ", "x.txt")).toThrow(/INPUT_EMPTY/);
    expect(() => normalizeTranscript("hello", "x.pdf")).toThrow(/INPUT_UNSUPPORTED/);
  });
  it("validates evidence", () => {
    const x = normalizeTranscript("Decision: defer launch.", "notes.txt"),
      ref = evidenceForSegment(x, "seg-1");
    expect(validateEvidence(x, [ref])).toEqual([]);
    expect(validateEvidence(x, [{ sourceId: "missing" }])).toContain("Unknown source: missing");
  });
  it("never emits overlapping segment ranges", () => {
    const t = "Speaker A: one.\nSpeaker B: two.\n\n# Notes\n\nDecision: defer.\nAlice: ok";
    for (const fileName of ["x.txt", "y.md", "z.md"]) {
      const { segments } = normalizeTranscript(t, fileName);
      const sorted = [...segments].sort((a, b) => a.lineStart - b.lineStart);
      for (let i = 1; i < sorted.length; i++)
        expect(sorted[i]!.lineStart).toBeGreaterThan(sorted[i - 1]!.lineEnd);
    }
  });
});
