import { it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { normalizeTranscript } from "../src/core/normalize.js";
import { evidenceForSegment } from "../src/core/evidence.js";
it("reports Agent JSON without API keys and leaves invalid output untouched", () => {
  const dir = mkdtempSync(join(tmpdir(), "meeting-report-"));
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ["--import", "tsx", resolve("src/cli.ts"), ...args], {
      encoding: "utf8",
      env: { ...process.env, OPENAI_API_KEY: "", OPENAI_MODEL: "" },
    });
  try {
    const meeting = normalizeTranscript("Team: Defer launch.", "meeting.txt");
    const normalized = join(dir, "normalized.json"),
      analysis = join(dir, "analysis.json"),
      out = join(dir, "report.md");
    writeFileSync(normalized, JSON.stringify(meeting));
    const draft = {
      schemaVersion: "1.0",
      meetingId: meeting.meeting.id,
      generatedAt: "2026-01-01T00:00:00Z",
      summary: [],
      topics: [],
      decisions: [
        {
          id: "d1",
          statement: "Defer launch.",
          status: "confirmed",
          confidence: "high",
          evidence: [evidenceForSegment(meeting, "seg-1")],
        },
      ],
      actionItems: [],
      risks: [],
      openQuestions: [],
      conflicts: [],
    };
    writeFileSync(analysis, JSON.stringify(draft));
    expect(run("report", normalized, "--analysis", analysis, "--out", out).status).toBe(0);
    expect(readFileSync(out, "utf8")).toContain("Evidence:");
    writeFileSync(out, "keep");
    expect(run("report", normalized, "--analysis", analysis, "--out", out).status).toBe(1);
    expect(readFileSync(out, "utf8")).toBe("keep");
    const invalidOut = join(dir, "invalid.md");
    draft.meetingId = "wrong";
    writeFileSync(analysis, JSON.stringify(draft));
    expect(run("report", normalized, "--analysis", analysis, "--out", invalidOut).status).toBe(1);
    expect(existsSync(invalidOut)).toBe(false);
    writeFileSync(analysis, '{"confidential text');
    const result = run("report", normalized, "--analysis", analysis);
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain("confidential");
    expect(run("report", normalized).status).toBe(2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
