import { describe, it, expect } from "vitest";
import { normalizeTranscript } from "../src/core/normalize.js";
import { evidenceForSegment, validateEvidence } from "../src/core/evidence.js";
import { countLoneSurrogates } from "./support/lone-surrogates.js";
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
    expect(validateEvidence(x, [{ sourceId: "missing" }])).toContain(
      "evidence references an unknown source",
    );
  });
  it("preserves segment text verbatim so source evidence quotes match exactly", () => {
    // 契约（docs/en/contracts/DATA-SCHEMA.md）：segment.text 必须与源文件对应行逐字一致。
    const content = "# Planning\n\n  缩进行\n尾随空格  \n";
    const input = normalizeTranscript(content, "meeting.md");
    const segment = input.segments[1]!;
    expect(segment.lineStart).toBe(3);
    expect(segment.lineEnd).toBe(4);
    expect(segment.text).toBe("  缩进行\n尾随空格  ");
    const ref = {
      sourceId: segment.sourceId,
      segmentId: segment.id,
      lineStart: 3,
      lineEnd: 4,
      quote: segment.text,
    };
    expect(validateEvidence(input, [ref])).toEqual([]);
    expect(validateEvidence(input, [ref], "strict")).toEqual([]);
  });
  it("truncates evidenceForSegment quotes without splitting surrogate pairs", () => {
    // 截断必须按码点进行，否则第 240 个代码元会落在 emoji 中间，写入时变 U+FFFD。
    const input = normalizeTranscript("a".repeat(239) + "😀" + "b".repeat(400), "emoji.txt");
    const ref = evidenceForSegment(input, "seg-1");
    expect(ref.quote).toBe("a".repeat(239) + "😀");
    expect(Array.from(ref.quote!)).toHaveLength(240);
    expect(countLoneSurrogates(ref.quote!)).toBe(0);
    // 截断结果仍是逐字前缀，fragment 与 strict 都应通过。
    expect(validateEvidence(input, [ref])).toEqual([]);
    expect(validateEvidence(input, [ref], "strict")).toEqual([]);
  });
  it("rejects input that only contains separators", () => {
    expect(() => normalizeTranscript("---\n===\n***\n", "separators.txt")).toThrow(/INPUT_EMPTY/);
  });
  it("pads single-digit clock parts to HH:MM:SS", () => {
    const minutes = normalizeTranscript("说话人1 1:05\n内容\n", "clock.txt");
    expect(minutes.segments[0]?.timestamp).toBe("00:01:05");
    expect(minutes.sources[0]?.transcriptFormat).toBe("speaker-time");
    const hours = normalizeTranscript("说话人1 1:05:30\n内容\n", "clock2.txt");
    expect(hours.segments[0]?.timestamp).toBe("01:05:30");
  });
  it("does not treat bracketed prose as a speaker label", () => {
    const prose = normalizeTranscript("【会议记录】\n今天开会\n", "notes.txt");
    expect(prose.segments[0]?.speaker).toBeUndefined();
    const label = normalizeTranscript("【说话人3】\n内容\n", "label.txt");
    expect(label.segments[0]?.speaker).toBe("说话人3");
    expect(label.sources[0]?.transcriptFormat).toBe("speaker-bracket");
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
