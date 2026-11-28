import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { MAX_ANALYSIS_BYTES, MAX_CONTENT_BYTES } from "../src/core/limits.js";
import { analysisFixture, inputFixture, minutesFixture } from "./support/minutes-fixtures.js";

const cli = resolve("src/cli.ts");
const run = (...args: string[]) =>
  spawnSync(process.execPath, ["--import", "tsx", cli, ...args], {
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, OPENAI_API_KEY: "", OPENAI_MODEL: "" },
  });
const makeDir = () => mkdtempSync(join(tmpdir(), "mta-io-"));
const removeDir = (dir: string) => rmSync(dir, { recursive: true, force: true });

function writeReportFixtures(dir: string) {
  const inputPath = join(dir, "normalized.json");
  const analysisPath = join(dir, "analysis.json");
  writeFileSync(inputPath, JSON.stringify(inputFixture()));
  writeFileSync(analysisPath, JSON.stringify(analysisFixture()));
  return { inputPath, analysisPath };
}

describe("report 输入文件读取失败统一为 INPUT_JSON_INVALID", () => {
  it("normalized input 文件不存在时输出稳定码，且不回显路径", () => {
    const dir = makeDir();
    try {
      const { analysisPath } = writeReportFixtures(dir);
      const missing = join(dir, "missing-normalized.json");
      const result = run("report", missing, "--analysis", analysisPath);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("INPUT_JSON_INVALID");
      expect(result.stderr).toMatch(/input/i);
      expect(result.stderr).not.toContain(resolve(missing));
      expect(result.stderr).not.toContain(dir);
      expect(result.stderr).not.toContain("ENOENT");
    } finally {
      removeDir(dir);
    }
  }, 30_000);

  it("normalized input 是目录（EISDIR）时同样输出稳定码", () => {
    const dir = makeDir();
    try {
      const { analysisPath } = writeReportFixtures(dir);
      const asDirectory = join(dir, "input-dir");
      // 目录本身作为 report 的 input：stat 成功，读取时 EISDIR。
      mkdirSync(asDirectory);
      const result = run("report", asDirectory, "--analysis", analysisPath);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("INPUT_JSON_INVALID");
      expect(result.stderr).not.toContain(dir);
      expect(result.stderr).not.toContain("EISDIR");
    } finally {
      removeDir(dir);
    }
  }, 30_000);

  it("analysis 文件不存在时输出稳定码并点名 analysis 角色", () => {
    const dir = makeDir();
    try {
      const { inputPath } = writeReportFixtures(dir);
      const missingAnalysis = join(dir, "missing-analysis.json");
      const result = run("report", inputPath, "--analysis", missingAnalysis);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("INPUT_JSON_INVALID");
      expect(result.stderr).toContain("analysis");
      expect(result.stderr).not.toContain(resolve(missingAnalysis));
      expect(result.stderr).not.toContain(dir);
      expect(result.stderr).not.toContain("ENOENT");
    } finally {
      removeDir(dir);
    }
  }, 30_000);

  it("非法 JSON 的解析失败保持同一稳定码", () => {
    const dir = makeDir();
    try {
      const { analysisPath } = writeReportFixtures(dir);
      const broken = join(dir, "normalized.json");
      writeFileSync(broken, '{"confidential text');
      const result = run("report", broken, "--analysis", analysisPath);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("INPUT_JSON_INVALID");
      expect(result.stderr).not.toContain("confidential");
      expect(result.stderr).not.toContain(dir);
    } finally {
      removeDir(dir);
    }
  }, 30_000);
});

describe("--out 目标不可用时返回 OUT_PATH_UNUSABLE", () => {
  it("report 的 --out 目标已存在：拒绝覆盖且不回显路径", () => {
    const dir = makeDir();
    try {
      const { inputPath, analysisPath } = writeReportFixtures(dir);
      const out = join(dir, "exists.md");
      writeFileSync(out, "keep me");
      const result = run("report", inputPath, "--analysis", analysisPath, "--out", out);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("OUT_PATH_UNUSABLE");
      expect(result.stderr).not.toContain(resolve(out));
      expect(result.stderr).not.toContain(dir);
      expect(readFileSync(out, "utf8")).toBe("keep me");
    } finally {
      removeDir(dir);
    }
  }, 30_000);

  it("report 的 --out 父目录缺失：稳定码且不创建文件", () => {
    const dir = makeDir();
    try {
      const { inputPath, analysisPath } = writeReportFixtures(dir);
      const out = join(dir, "missing-parent", "report.md");
      const result = run("report", inputPath, "--analysis", analysisPath, "--out", out);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("OUT_PATH_UNUSABLE");
      expect(result.stderr).not.toContain(dir);
      expect(existsSync(out)).toBe(false);
    } finally {
      removeDir(dir);
    }
  }, 30_000);

  it("report 的 --out 父路径是文件（ENOTDIR）：稳定码", () => {
    const dir = makeDir();
    try {
      const { inputPath, analysisPath } = writeReportFixtures(dir);
      const notADirectory = join(dir, "not-a-directory");
      writeFileSync(notADirectory, "x");
      const out = join(notADirectory, "report.md");
      const result = run("report", inputPath, "--analysis", analysisPath, "--out", out);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("OUT_PATH_UNUSABLE");
      expect(result.stderr).not.toContain(dir);
    } finally {
      removeDir(dir);
    }
  }, 30_000);

  it("inspect 的 --out 目标已存在：拒绝覆盖且不回显路径", () => {
    const dir = makeDir();
    try {
      const transcript = join(dir, "meeting.md");
      writeFileSync(transcript, "# Plan\n\nAlice: review.");
      const out = join(dir, "normalized.json");
      writeFileSync(out, "keep me");
      const result = run("inspect", transcript, "--out", out);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("OUT_PATH_UNUSABLE");
      expect(result.stderr).not.toContain(resolve(out));
      expect(result.stderr).not.toContain(dir);
      expect(readFileSync(out, "utf8")).toBe("keep me");
    } finally {
      removeDir(dir);
    }
  }, 30_000);

  it("inspect 的 --out 父目录缺失：稳定码", () => {
    const dir = makeDir();
    try {
      const transcript = join(dir, "meeting.md");
      writeFileSync(transcript, "# Plan\n\nAlice: review.");
      const out = join(dir, "missing-parent", "normalized.json");
      const result = run("inspect", transcript, "--out", out);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("OUT_PATH_UNUSABLE");
      expect(result.stderr).not.toContain(dir);
      expect(existsSync(out)).toBe(false);
    } finally {
      removeDir(dir);
    }
  }, 30_000);
});

describe("--version 只接受单独出现", () => {
  it("单独 --version / -v 打印版本并 exit 0", () => {
    for (const flag of ["--version", "-v"]) {
      const result = run(flag);
      expect(result.status, flag).toBe(0);
      expect(result.stdout.trim(), flag).toMatch(/^\d+\.\d+\.\d+/);
    }
  }, 30_000);

  it("version 旗标与其它参数同现视为用法错误 exit 2", () => {
    const cases = [
      ["--version", "--bogus"],
      ["--bogus", "--version"],
      ["-v", "--bogus"],
      ["--version", "inspect"],
    ];
    for (const args of cases) {
      const result = run(...args);
      expect(result.status, args.join(" ")).toBe(2);
      expect(result.stderr, args.join(" ")).toContain("Usage:");
    }
  }, 30_000);
});

describe("usage 文案使用真实入口", () => {
  it("同时给出 npm run dev -- 与 node dist/cli.js，且不再出现不存在的 bin 名", () => {
    const result = run("report", "normalized.json");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("npm run dev -- ");
    expect(result.stderr).toContain("node dist/cli.js ");
    expect(result.stderr).not.toContain("meeting-to-action ");
  });
});

describe("report 的 --minutes 与 MCP 统一为 2 MiB 上限", () => {
  it("3 MiB 的 minutes 被拒绝并报 INPUT_SIZE_LIMIT", () => {
    const dir = makeDir();
    try {
      const { inputPath, analysisPath } = writeReportFixtures(dir);
      const minutesPath = join(dir, "minutes-3mib.json");
      const threeMiB = 3 * 1024 * 1024;
      const base = Buffer.from(JSON.stringify(minutesFixture()), "utf8");
      writeFileSync(
        minutesPath,
        Buffer.concat([base, Buffer.alloc(threeMiB - base.byteLength, 0x20)]),
      );
      expect(readFileSync(minutesPath).byteLength).toBe(threeMiB);
      const result = run("report", inputPath, "--analysis", analysisPath, "--minutes", minutesPath);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("INPUT_SIZE_LIMIT");
      expect(result.stderr).toContain(String(threeMiB));
      expect(result.stderr).toContain(String(MAX_CONTENT_BYTES));
    } finally {
      removeDir(dir);
    }
  }, 30_000);

  it("恰好 2 MiB 的 minutes 仍可正常渲染（边界精确）", () => {
    const dir = makeDir();
    try {
      const { inputPath, analysisPath } = writeReportFixtures(dir);
      const minutesPath = join(dir, "minutes-at-limit.json");
      const base = Buffer.from(JSON.stringify(minutesFixture()), "utf8");
      writeFileSync(
        minutesPath,
        Buffer.concat([base, Buffer.alloc(MAX_CONTENT_BYTES - base.byteLength, 0x20)]),
      );
      expect(readFileSync(minutesPath).byteLength).toBe(MAX_CONTENT_BYTES);
      const result = run("report", inputPath, "--analysis", analysisPath, "--minutes", minutesPath);
      expect(result.status).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(0);
    } finally {
      removeDir(dir);
    }
  }, 30_000);

  it("analysis 的 4 MiB 上限保持不变（超过 2 MiB 仍可读取）", () => {
    const dir = makeDir();
    try {
      const { inputPath } = writeReportFixtures(dir);
      const analysisPath = join(dir, "analysis-large.json");
      const base = Buffer.from(JSON.stringify(analysisFixture()), "utf8");
      const target = MAX_CONTENT_BYTES + 1024; // 超过 2 MiB、低于 4 MiB
      writeFileSync(
        analysisPath,
        Buffer.concat([base, Buffer.alloc(target - base.byteLength, 0x20)]),
      );
      expect(readFileSync(analysisPath).byteLength).toBeLessThan(MAX_ANALYSIS_BYTES);
      const result = run("report", inputPath, "--analysis", analysisPath);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Meeting report:");
    } finally {
      removeDir(dir);
    }
  }, 30_000);
});
