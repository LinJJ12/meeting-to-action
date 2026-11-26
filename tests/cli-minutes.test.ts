import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { validateAnalysis } from "../src/core/analysis.js";
import { renderMarkdown } from "../src/render/markdown.js";
import { renderMinutesDocument } from "../src/render/minutes.js";
import {
  analysisFixture,
  inputFixture,
  minutesFixture,
  mutatedMinutes,
} from "./support/minutes-fixtures.js";

const run = (...args: string[]) =>
  spawnSync(process.execPath, ["--import", "tsx", resolve("src/cli.ts"), ...args], {
    encoding: "utf8",
    env: { ...process.env, OPENAI_API_KEY: "", OPENAI_MODEL: "" },
  });

describe("report CLI minutes wiring", () => {
  let dir: string;
  let inputPath: string, analysisPath: string, minutesPath: string, transcriptPath: string;
  const input = inputFixture(),
    analysis = analysisFixture(),
    minutes = minutesFixture();
  let evidenceMarkdown: string;
  const expectedMinutes = (options?: {
    mode?: "minutes" | "actions" | "evidence";
    appendix?: boolean;
  }) => renderMinutesDocument(input, analysis, minutes, options);

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "meeting-minutes-cli-"));
    inputPath = join(dir, "normalized.json");
    analysisPath = join(dir, "analysis.json");
    minutesPath = join(dir, "minutes.json");
    transcriptPath = join(dir, "transcript.txt");
    writeFileSync(inputPath, JSON.stringify(input));
    writeFileSync(analysisPath, JSON.stringify(analysis));
    writeFileSync(minutesPath, JSON.stringify(minutes));
    writeFileSync(transcriptPath, "Team: Defer launch.\n");
    evidenceMarkdown = renderMarkdown(validateAnalysis(input, analysis));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const writeMinutesFile = (name: string, draft: unknown): string => {
    const path = join(dir, name);
    writeFileSync(path, typeof draft === "string" ? draft : JSON.stringify(draft));
    return path;
  };

  it("keeps the default evidence report byte-identical without --minutes", () => {
    const result = run("report", inputPath, "--analysis", analysisPath);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(evidenceMarkdown);
    expect(result.stdout).toContain("Evidence:");
  });

  it("defaults to minutes mode when --minutes is supplied", () => {
    const result = run("report", inputPath, "--analysis", analysisPath, "--minutes", minutesPath);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(expectedMinutes());
    expect(result.stdout).toContain("## 集中待办");
    expect(result.stdout).toContain("## 溯源附录");
  });

  it("renders the actions checklist with --mode actions", () => {
    const result = run(
      "report",
      inputPath,
      "--analysis",
      analysisPath,
      "--minutes",
      minutesPath,
      "--mode",
      "actions",
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(expectedMinutes({ mode: "actions" }));
    expect(result.stdout.startsWith("# 执行清单")).toBe(true);
  });

  it("drops the trace appendix with --no-appendix", () => {
    const result = run(
      "report",
      inputPath,
      "--no-appendix",
      "--analysis",
      analysisPath,
      "--minutes",
      minutesPath,
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(expectedMinutes({ appendix: false }));
    expect(result.stdout).not.toContain("## 溯源附录");
    expect(result.stdout).toContain("## 集中待办");
  });

  it("keeps explicit --mode evidence byte-identical and still validates supplied minutes", () => {
    const result = run(
      "report",
      inputPath,
      "--analysis",
      analysisPath,
      "--minutes",
      minutesPath,
      "--mode",
      "evidence",
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(evidenceMarkdown);

    const badRefsPath = writeMinutesFile(
      "minutes-bad-refs.json",
      mutatedMinutes((draft) => {
        draft.sections[0].claims[0].refs = ["not-a-fact"];
      }),
    );
    const badResult = run(
      "report",
      inputPath,
      "--analysis",
      analysisPath,
      "--minutes",
      badRefsPath,
      "--mode",
      "evidence",
    );
    expect(badResult.status).toBe(1);
    expect(badResult.stderr).toContain("MINUTES_REF_UNKNOWN");
  });

  it("writes one --out file and keeps the exclusive-create semantics", () => {
    const outPath = join(dir, "minutes-out.md");
    const result = run(
      "report",
      inputPath,
      "--analysis",
      analysisPath,
      "--minutes",
      minutesPath,
      "--out",
      outPath,
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Wrote ");
    expect(readFileSync(outPath, "utf8")).toBe(expectedMinutes());

    writeFileSync(outPath, "keep");
    const again = run(
      "report",
      inputPath,
      "--analysis",
      analysisPath,
      "--minutes",
      minutesPath,
      "--out",
      outPath,
    );
    expect(again.status).toBe(1);
    expect(readFileSync(outPath, "utf8")).toBe("keep");
  });

  it("reports MINUTES_MISSING when minutes/actions modes lack --minutes", () => {
    for (const mode of ["minutes", "actions"]) {
      const result = run("report", inputPath, "--analysis", analysisPath, "--mode", mode);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("MINUTES_MISSING");
    }
  });

  it("rejects unknown --mode values as a usage error with exit 1", () => {
    const result = run(
      "report",
      inputPath,
      "--analysis",
      analysisPath,
      "--minutes",
      minutesPath,
      "--mode",
      "summary",
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage:");
    expect(result.stderr).toContain("--mode");
    expect(result.stdout).toBe("");
  });

  it("rejects report-only flags on inspect and analyze", () => {
    for (const flagArgs of [
      ["--minutes", minutesPath],
      ["--mode", "evidence"],
      ["--no-appendix"],
    ]) {
      expect(run("inspect", transcriptPath, ...flagArgs).status).toBe(2);
    }
    expect(run("analyze", transcriptPath, "--minutes", minutesPath).status).toBe(2);
  });

  it("maps unreadable or malformed minutes files to INPUT_JSON_INVALID without leaking paths", () => {
    const missing = run(
      "report",
      inputPath,
      "--analysis",
      analysisPath,
      "--minutes",
      join(dir, "missing-minutes.json"),
    );
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("INPUT_JSON_INVALID");
    expect(missing.stderr).not.toContain(dir);

    const truncatedPath = writeMinutesFile("minutes-truncated.json", '{"confidential text');
    const truncated = run(
      "report",
      inputPath,
      "--analysis",
      analysisPath,
      "--minutes",
      truncatedPath,
    );
    expect(truncated.status).toBe(1);
    expect(truncated.stderr).toContain("INPUT_JSON_INVALID");
    expect(truncated.stderr).not.toContain("confidential");
  });

  it("surfaces minutes contract failures with their machine codes", () => {
    const cases: [string, unknown, string][] = [
      [
        "MINUTES_REF_UNKNOWN",
        mutatedMinutes((draft) => {
          draft.sections[0].claims[0].refs = ["not-a-fact"];
        }),
        "MINUTES_REF_UNKNOWN",
      ],
      [
        "MINUTES_KIND_MISMATCH",
        mutatedMinutes((draft) => {
          draft.sections[1].claims[0].kind = "open";
        }),
        "MINUTES_KIND_MISMATCH",
      ],
      [
        "MINUTES_MEETING_MISMATCH",
        mutatedMinutes((draft) => {
          draft.meetingId = "other-meeting";
        }),
        "MINUTES_MEETING_MISMATCH",
      ],
      [
        "MINUTES_CONTRACT_UNSUPPORTED",
        mutatedMinutes((draft) => {
          draft.contractVersion = "2.0";
        }),
        "MINUTES_CONTRACT_UNSUPPORTED",
      ],
      [
        "MINUTES_ACTION_COVERAGE",
        mutatedMinutes((draft) => {
          draft.sections[0].claims = draft.sections[0].claims.filter(
            (claim: any) => claim.id !== "c2",
          );
        }),
        "MINUTES_ACTION_COVERAGE",
      ],
    ];
    for (const [name, draft, code] of cases) {
      const path = writeMinutesFile("minutes-" + code + ".json", draft);
      const result = run("report", inputPath, "--analysis", analysisPath, "--minutes", path);
      expect(result.status, name).toBe(1);
      expect(result.stdout, name).toBe("");
      expect(result.stderr, name).toContain(code);
    }
    const schemaInvalid = writeMinutesFile(
      "minutes-schema-invalid.json",
      mutatedMinutes((draft) => {
        delete draft.title;
      }),
    );
    const result = run("report", inputPath, "--analysis", analysisPath, "--minutes", schemaInvalid);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("MINUTES_SCHEMA_INVALID");
  });

  it("does not write --out when the minutes document fails validation", () => {
    const badPath = writeMinutesFile(
      "minutes-bad-no-out.json",
      mutatedMinutes((draft) => {
        draft.sections[0].claims[0].refs = ["not-a-fact"];
      }),
    );
    const outPath = join(dir, "failed-minutes.md");
    const result = run(
      "report",
      inputPath,
      "--analysis",
      analysisPath,
      "--minutes",
      badPath,
      "--out",
      outPath,
    );
    expect(result.status).toBe(1);
    expect(existsSync(outPath)).toBe(false);
  });

  it("accepts JSON files exported by Windows tools with a UTF-8 BOM", () => {
    const bomInput = join(dir, "normalized-bom.json");
    const bomAnalysis = join(dir, "analysis-bom.json");
    const bomMinutes = join(dir, "minutes-bom.json");
    writeFileSync(bomInput, "\uFEFF" + JSON.stringify(input, null, 2));
    writeFileSync(bomAnalysis, "\uFEFF" + JSON.stringify(analysis, null, 2));
    writeFileSync(bomMinutes, "\uFEFF" + JSON.stringify(minutes, null, 2));
    const outPath = join(dir, "bom-minutes.md");
    const result = run(
      "report",
      bomInput,
      "--analysis",
      bomAnalysis,
      "--minutes",
      bomMinutes,
      "--out",
      outPath,
    );
    expect(result.status).toBe(0);
    expect(readFileSync(outPath, "utf8")).toBe(expectedMinutes());
  });

  it("accepts a transcript exported with a UTF-8 BOM", () => {
    const bomTranscript = join(dir, "transcript-bom.md");
    writeFileSync(bomTranscript, "\uFEFF" + "Team: Defer launch.\n");
    const result = run("inspect", bomTranscript);
    expect(result.status).toBe(0);
    expect(result.stdout.startsWith("{\n")).toBe(true);
    expect(result.stdout).not.toContain("\uFEFF");
  });
});
