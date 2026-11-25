import { describe, expect, it } from "vitest";
import { normalizeTranscript } from "../src/core/normalize.js";
import { evidenceForSegment, validateEvidence } from "../src/core/evidence.js";
import { validateAnalysis } from "../src/core/analysis.js";
import { analyzeMeeting } from "../src/core/analyze.js";
import type { AnalysisProvider, ChatMessage } from "../src/providers/types.js";

// 同一个逐字稿，覆盖带 speaker/timestamp 头的导出格式
const input = normalizeTranscript(
  "演示用户(00:01:37):\n我会复查。\n\n另一人(00:02:00):\n待确认。",
  "demo.md",
);

class StubProvider implements AnalysisProvider {
  constructor(private readonly result: string) {}
  async complete(_messages: ChatMessage[]): Promise<string> {
    return this.result;
  }
}

const base = evidenceForSegment(input, "seg-1");

/**
 * 一组边界用例。三种入口（analyze / report / validateEvidence）
 * 对同一份 evidence 必须给出相同结论。
 */
const variants: Record<string, Record<string, unknown>> = {
  valid: base,
  forgedSpeaker: { ...base, speaker: "幽灵" },
  forgedTimestamp: { ...base, timestamp: "99:99:99" },
  subRange: { ...base, lineStart: 1, lineEnd: 1 },
  lineOnly: { sourceId: base.sourceId, lineStart: 1, lineEnd: 2 },
  missingBounds: { sourceId: base.sourceId, segmentId: "seg-1" },
  fabricatedQuote: { ...base, quote: "这句话原文里没有" },
  unknownSource: { ...base, sourceId: "unknown-source" },
};

function draftWithEvidence(evidence: unknown[]) {
  return {
    summary: ["摘要"],
    topics: [{ title: "议题", summary: "说明", evidence }],
    decisions: [],
    actionItems: [],
    risks: [],
    openQuestions: [],
    conflicts: [],
  };
}

function fullAnalysisWithEvidence(evidence: unknown[]) {
  return {
    schemaVersion: "1.0",
    meetingId: input.meeting.id,
    generatedAt: "2026-01-01T00:00:00Z",
    ...draftWithEvidence(evidence),
  };
}

async function analyzeVerdict(evidence: unknown[]): Promise<boolean> {
  try {
    await analyzeMeeting(input, new StubProvider(JSON.stringify(draftWithEvidence(evidence))));
    return true;
  } catch {
    return false;
  }
}

function reportVerdict(evidence: unknown[]): boolean {
  try {
    validateAnalysis(input, fullAnalysisWithEvidence(evidence));
    return true;
  } catch {
    return false;
  }
}

function evidenceVerdict(ref: unknown): boolean {
  return validateEvidence(input, [ref as never]).length === 0;
}

describe("evidence 校验一致性（analyze / report / validateEvidence）", () => {
  it("三个入口对同一份 evidence 的结论必须一致", async () => {
    const rows: Array<{ name: string; analyze: boolean; report: boolean; validateEvidence: boolean }> = [];
    for (const [name, ref] of Object.entries(variants)) {
      rows.push({
        name,
        analyze: await analyzeVerdict([ref]),
        report: reportVerdict([ref]),
        validateEvidence: evidenceVerdict(ref),
      });
    }
    const inconsistent = rows.filter(
      (r) => !(r.analyze === r.report && r.report === r.validateEvidence),
    );
    // 有分歧时把完整表格打出来，便于定位
    expect(inconsistent, JSON.stringify(rows, null, 2)).toEqual([]);
  });

  it("三个入口都必须拒绝伪造的 speaker / timestamp", async () => {
    for (const name of ["forgedSpeaker", "forgedTimestamp"]) {
      const ref = variants[name]!;
      expect(await analyzeVerdict([ref]), `${name} 应被 analyze 拒绝`).toBe(false);
      expect(reportVerdict([ref]), `${name} 应被 report 拒绝`).toBe(false);
      expect(evidenceVerdict(ref), `${name} 应被 validateEvidence 拒绝`).toBe(false);
    }
  });

  it("合法的 evidence 三个入口都必须接受", async () => {
    expect(await analyzeVerdict([base])).toBe(true);
    expect(reportVerdict([base])).toBe(true);
    expect(evidenceVerdict(base)).toBe(true);
  });

  it("strict 模式要求完整 segment 边界，但仍校验元数据", () => {
    expect(validateEvidence(input, [base], "strict")).toEqual([]);
    // 子区间 / 缺 segmentId / 缺行号 在 strict 下被拒
    expect(validateEvidence(input, [variants.subRange as never], "strict").length).toBeGreaterThan(0);
    expect(validateEvidence(input, [variants.lineOnly as never], "strict").length).toBeGreaterThan(0);
    expect(validateEvidence(input, [variants.missingBounds as never], "strict").length).toBeGreaterThan(0);
    // strict 同样拒绝伪造元数据
    expect(validateEvidence(input, [variants.forgedSpeaker as never], "strict").length).toBeGreaterThan(0);
  });
});