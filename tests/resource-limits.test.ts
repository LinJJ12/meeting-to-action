import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { normalizeTranscript } from "../src/core/normalize.js";
import { evidenceForSegment, validateEvidence } from "../src/core/evidence.js";
import { validateAnalysis } from "../src/core/analysis.js";
import { callTool } from "../src/mcp/tools.js";
import {
  MAX_ANALYSIS_BYTES,
  MAX_CONTENT_BYTES,
  MAX_EVIDENCE_REFS_PER_ENTRY,
  MAX_QUOTE_CHARS,
  MAX_SEGMENTS,
} from "../src/core/limits.js";

const envWithoutApiKeys = () => {
  const env = { ...process.env };
  delete env.OPENAI_API_KEY;
  delete env.OPENAI_MODEL;
  delete env.OPENAI_BASE_URL;
  return env;
};
const cliRun = (args: string[]) =>
  spawnSync(process.execPath, ["--import", "tsx", resolve("src/cli.ts"), ...args], {
    encoding: "utf8",
    env: envWithoutApiKeys(),
  });

/** 复用 normalizeTranscript 产出的合法 skeleton，只替换 segments（顺序不重叠区间），保持 schema 合法。 */
function meetingWithSegments(count: number) {
  const base = normalizeTranscript("seed", "x.txt");
  const sourceId = base.sources[0]!.id;
  return {
    ...base,
    segments: Array.from({ length: count }, (_, index) => ({
      id: "seg-" + (index + 1),
      sourceId,
      text: "a",
      lineStart: index + 1,
      lineEnd: index + 1,
    })),
  };
}
function validAnalysis(meeting: { meeting: { id: string } }) {
  return {
    schemaVersion: "1.0",
    meetingId: meeting.meeting.id,
    generatedAt: "2026-01-01T00:00:00Z",
    summary: [],
    topics: [],
    decisions: [],
    actionItems: [],
    risks: [],
    openQuestions: [],
    conflicts: [],
  };
}

describe("CLI report 的资源上限", () => {
  it("拒绝超过 10,000 段的 normalized input（不进入证据校验）", () => {
    const dir = mkdtempSync(join(tmpdir(), "meeting-report-limits-"));
    try {
      const meeting = meetingWithSegments(MAX_SEGMENTS + 1);
      const inputPath = join(dir, "normalized.json");
      const analysisPath = join(dir, "analysis.json");
      writeFileSync(inputPath, JSON.stringify(meeting));
      writeFileSync(analysisPath, JSON.stringify(validAnalysis(meeting)));
      const result = cliRun(["report", inputPath, "--analysis", analysisPath]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("INPUT_SEGMENT_LIMIT");
      expect(result.stderr).toContain(String(MAX_SEGMENTS));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("恰好 10,000 段的 normalized input 仍可正常 report", () => {
    const dir = mkdtempSync(join(tmpdir(), "meeting-report-limits-"));
    try {
      const meeting = meetingWithSegments(MAX_SEGMENTS);
      const inputPath = join(dir, "normalized.json");
      const analysisPath = join(dir, "analysis.json");
      writeFileSync(inputPath, JSON.stringify(meeting));
      writeFileSync(analysisPath, JSON.stringify(validAnalysis(meeting)));
      const result = cliRun(["report", inputPath, "--analysis", analysisPath]);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Meeting report:");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("input JSON 文件超过 2 MiB 时按 stat 大小拒绝，并在错误中给出路径/实际大小/上限", () => {
    const dir = mkdtempSync(join(tmpdir(), "meeting-report-limits-"));
    try {
      const inputPath = join(dir, "normalized.json");
      const analysisPath = join(dir, "analysis.json");
      writeFileSync(inputPath, "a".repeat(MAX_CONTENT_BYTES + 1));
      writeFileSync(analysisPath, "{}");
      const result = cliRun(["report", inputPath, "--analysis", analysisPath]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("INPUT_SIZE_LIMIT");
      expect(result.stderr).toContain(resolve(inputPath));
      expect(result.stderr).toContain(String(MAX_CONTENT_BYTES + 1));
      expect(result.stderr).toContain(String(MAX_CONTENT_BYTES));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("analysis JSON 文件超过 4 MiB 时按 stat 大小拒绝，且不读取整个文件", () => {
    const dir = mkdtempSync(join(tmpdir(), "meeting-report-limits-"));
    try {
      const meeting = normalizeTranscript("Team: Defer launch.", "x.txt");
      const inputPath = join(dir, "normalized.json");
      const analysisPath = join(dir, "analysis.json");
      writeFileSync(inputPath, JSON.stringify(meeting));
      writeFileSync(analysisPath, "a".repeat(MAX_ANALYSIS_BYTES + 1));
      const result = cliRun(["report", inputPath, "--analysis", analysisPath]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("INPUT_SIZE_LIMIT");
      expect(result.stderr).toContain(resolve(analysisPath));
      expect(result.stderr).toContain(String(MAX_ANALYSIS_BYTES + 1));
      expect(result.stderr).toContain(String(MAX_ANALYSIS_BYTES));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("evidence 索引与单 entry 上限", () => {
  it("100,000 段 + 300 refs 的 validateEvidence 在索引下保持线性（<3s）", () => {
    const segments = Array.from({ length: 100_000 }, (_, index) => ({
      id: "seg-" + (index + 1),
      sourceId: "s1",
      text: "a",
      lineStart: index + 1,
      lineEnd: index + 1,
    }));
    const input = {
      schemaVersion: "1.0" as const,
      meeting: { id: "perf", title: "Perf" },
      sources: [{ id: "s1", kind: "transcript" as const, format: "txt" as const }],
      segments,
    };
    // 行区间互不重叠后，每条 ref 指向不同的唯一区间，压测逐区间的候选过滤仍保持线性。
    const refs = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        sourceId: "s1",
        lineStart: index + 1,
        lineEnd: index + 1,
        quote: "zzz",
      }));
    const started = performance.now();
    const first = validateEvidence(input, refs(150));
    const second = validateEvidence(input, refs(150));
    const elapsed = performance.now() - started;
    expect(first).toHaveLength(150);
    expect(second).toHaveLength(150);
    expect(elapsed).toBeLessThan(3000);
  }, 60_000);

  it("单个 entry 最多 200 条 refs；超限被拒绝且消息含实际上限", () => {
    const input = normalizeTranscript("Team: Defer launch.", "x.txt");
    const sourceId = input.sources[0]!.id;
    const refs = (count: number) =>
      Array.from({ length: count }, () => ({ sourceId, segmentId: "seg-1" }));
    expect(validateEvidence(input, refs(MAX_EVIDENCE_REFS_PER_ENTRY))).toEqual([]);

    const errors = validateEvidence(input, refs(MAX_EVIDENCE_REFS_PER_ENTRY + 1));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(String(MAX_EVIDENCE_REFS_PER_ENTRY));
    expect(errors[0]).toMatch(/reference/i);

    const analysis = {
      ...validAnalysis(input),
      decisions: [
        {
          id: "d1",
          statement: "Defer launch.",
          status: "confirmed",
          confidence: "high",
          evidence: refs(MAX_EVIDENCE_REFS_PER_ENTRY + 1),
        },
      ],
    };
    expect(() => validateAnalysis(input, analysis)).toThrow(/ANALYSIS_EVIDENCE_INVALID/);
    expect(() => validateAnalysis(input, analysis)).toThrow(
      new RegExp(String(MAX_EVIDENCE_REFS_PER_ENTRY)),
    );
  });

  it("quote 最多 4,000 字符；超长 quote 被拒绝且消息含实际上限", () => {
    const input = normalizeTranscript("a".repeat(MAX_QUOTE_CHARS + 1), "x.txt");
    const sourceId = input.sources[0]!.id;
    const atLimit = { sourceId, segmentId: "seg-1", quote: "a".repeat(MAX_QUOTE_CHARS) };
    expect(validateEvidence(input, [atLimit])).toEqual([]);

    const overLimit = { ...atLimit, quote: "a".repeat(MAX_QUOTE_CHARS + 1) };
    const errors = validateEvidence(input, [overLimit]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(String(MAX_QUOTE_CHARS));
    expect(errors[0]).toMatch(/quote/i);
  });

  it("正常短 quote 的既有语义不变（fragment 与 strict）", () => {
    const input = normalizeTranscript("Team: Defer launch.", "x.txt");
    const ref = evidenceForSegment(input, "seg-1");
    expect(validateEvidence(input, [ref])).toEqual([]);
    expect(validateEvidence(input, [ref], "strict")).toEqual([]);
    expect(validateEvidence(input, [{ ...ref, quote: "fabricated" }])).toEqual([
      "Evidence quote does not match cited text",
    ]);
  });
});

describe("MCP validate_analysis 的资源上限", () => {
  it("拒绝超限 input（段数与总字节），返回稳定错误码", () => {
    const overSegments = meetingWithSegments(MAX_SEGMENTS + 1);
    const segmentResult = callTool("validate_analysis", {
      input: overSegments,
      analysis: validAnalysis(overSegments),
    });
    expect(segmentResult.isError).toBe(true);
    expect(segmentResult.content[0]!.text).toBe("INPUT_SEGMENT_LIMIT");

    const tiny = normalizeTranscript("seed", "x.txt");
    const hugeText = "a".repeat(800 * 1024);
    const overBytes = {
      ...tiny,
      segments: [0, 1, 2].map((index) => ({
        id: "seg-" + (index + 1),
        sourceId: tiny.sources[0]!.id,
        text: hugeText,
        lineStart: index + 1,
        lineEnd: index + 1,
      })),
    };
    const byteResult = callTool("validate_analysis", {
      input: overBytes,
      analysis: validAnalysis(overBytes),
    });
    expect(byteResult.isError).toBe(true);
    expect(byteResult.content[0]!.text).toBe("INPUT_SIZE_LIMIT");
  }, 30_000);

  it("拒绝超限 analysis（refs 数量与 quote 长度）", () => {
    const input = normalizeTranscript("Team: Defer launch.", "x.txt");
    const sourceId = input.sources[0]!.id;
    const tooManyRefs = Array.from({ length: MAX_EVIDENCE_REFS_PER_ENTRY + 1 }, () => ({
      sourceId,
      segmentId: "seg-1",
    }));
    const analysis = {
      ...validAnalysis(input),
      decisions: [
        {
          id: "d1",
          statement: "Defer launch.",
          status: "confirmed",
          confidence: "high",
          evidence: tooManyRefs,
        },
      ],
    };
    const refsResult = callTool("validate_analysis", { input, analysis });
    expect(refsResult.isError).toBe(true);
    expect(refsResult.content[0]!.text).toBe("ANALYSIS_EVIDENCE_INVALID");

    const longQuote = {
      ...analysis,
      decisions: [
        {
          ...analysis.decisions[0]!,
          evidence: [{ sourceId, segmentId: "seg-1", quote: "a".repeat(MAX_QUOTE_CHARS + 1) }],
        },
      ],
    };
    const quoteResult = callTool("validate_analysis", { input, analysis: longQuote });
    expect(quoteResult.isError).toBe(true);
    expect(quoteResult.content[0]!.text).toBe("ANALYSIS_EVIDENCE_INVALID");
  });
});
