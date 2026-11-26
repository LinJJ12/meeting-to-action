import { describe, expect, test } from "vitest";
import { validateAnalysis } from "../src/core/analysis.js";
import { callTool, toolErrorCode, toolErrorCodes } from "../src/mcp/tools.js";
import { MAX_TOOL_WORK_MS } from "../src/core/limits.js";

const input = {
  schemaVersion: "1.0",
  meeting: { id: "meeting-budget", title: "预算测试" },
  sources: [{ id: "src-1", kind: "transcript", format: "txt" }],
  segments: [
    { id: "seg-1", sourceId: "src-1", text: "下周四之前交方案。", lineStart: 1, lineEnd: 1 },
  ],
};

const analysis = {
  schemaVersion: "1.0",
  meetingId: "meeting-budget",
  summary: ["本周定下交付时间。"],
  topics: [],
  decisions: [
    {
      id: "d1",
      statement: "下周四前交方案。",
      status: "confirmed",
      evidence: [{ sourceId: "src-1", segmentId: "seg-1", quote: "下周四之前交方案。" }],
      confidence: "high",
    },
  ],
  actionItems: [],
  risks: [],
  openQuestions: [],
  conflicts: [],
  generatedAt: "2026-11-25T00:00:00.000Z",
};

describe("handler CPU budget (#13 optional hardening)", () => {
  test("normal validation finishes within the default budget", () => {
    expect(validateAnalysis(input, analysis)).toMatchObject({ meetingId: "meeting-budget" });
  });

  test("an expired deadline aborts evidence validation with WORK_LIMIT_EXCEEDED", () => {
    expect(() => validateAnalysis(input, analysis, { deadline: Date.now() - 1 })).toThrow(
      /WORK_LIMIT_EXCEEDED/,
    );
  });

  test("MCP calls still succeed when the shared budget is in place", () => {
    expect(callTool("validate_analysis", { input, analysis }).isError).toBeUndefined();
    expect(callTool("render_report", { input, analysis }).isError).toBeUndefined();
  });

  test("WORK_LIMIT_EXCEEDED is a stable tool error code and the budget is positive", () => {
    expect(toolErrorCode(new Error("WORK_LIMIT_EXCEEDED"))).toBe("WORK_LIMIT_EXCEEDED");
    expect(toolErrorCodes).toContain("WORK_LIMIT_EXCEEDED");
    expect(MAX_TOOL_WORK_MS).toBeGreaterThan(0);
  });
});
