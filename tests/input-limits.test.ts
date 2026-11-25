import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { normalizeTranscript } from "../src/core/normalize.js";
import { assertContentWithinLimit, MAX_CONTENT_BYTES, MAX_SEGMENTS } from "../src/core/limits.js";
import { callTool } from "../src/mcp/tools.js";

const segmentsContent = (count: number) => "a\n\n".repeat(count);
const contentAtLimit = "a".repeat(MAX_CONTENT_BYTES);
const cliRun = (args: string[], env: NodeJS.ProcessEnv = process.env) =>
  spawnSync(process.execPath, ["--import", "tsx", resolve("src/cli.ts"), ...args], { encoding: "utf8", env });
const envWithoutApiKeys = () => {
  const env = { ...process.env };
  delete env.OPENAI_API_KEY;
  delete env.OPENAI_MODEL;
  delete env.OPENAI_BASE_URL;
  return env;
};

describe("输入上限", () => {
  it("normalizeTranscript 达到 maxSegments 时立即抛错", () => {
    const content = Array.from({ length: 5 }, (_, index) => `段落${index + 1}`).join("\n\n");
    expect(() => normalizeTranscript(content, "x.md", { maxSegments: 3 })).toThrow("INPUT_SEGMENT_LIMIT");
    expect(normalizeTranscript(content, "x.md", { maxSegments: 5 }).segments).toHaveLength(5);
  });

  it("未超限的输入不受影响", () => {
    expect(() => assertContentWithinLimit("Alice: 我会在周五前更新契约。")).not.toThrow();
    expect(normalizeTranscript("Alice: ok.", "x.md", { maxSegments: 1 }).segments).toHaveLength(1);
  });

  it("assertContentWithinLimit 按 UTF-8 字节数拒绝超大输入", () => {
    const huge = "界".repeat(Math.floor(MAX_CONTENT_BYTES / 3) + 1);
    expect(() => assertContentWithinLimit(huge)).toThrow("INPUT_SIZE_LIMIT");
  });

  it("MCP prepare_meeting 在内容远小于字节上限时就拒绝超量段落", () => {
    // 每段约 3 字节，总量约 30 KB，远低于 2 MiB，但段落数超过 MAX_SEGMENTS
    const content = "a\n\n".repeat(MAX_SEGMENTS + 5);
    expect(Buffer.byteLength(content, "utf8")).toBeLessThan(MAX_CONTENT_BYTES);

    const result = callTool("prepare_meeting", { content, fileName: "x.txt" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe("INPUT_SEGMENT_LIMIT");
  });

  it("MCP 常量与 core 常量保持一致", async () => {
    const tools = await import("../src/mcp/tools.js");
    expect(tools.MAX_CONTENT_BYTES).toBe(MAX_CONTENT_BYTES);
    expect(tools.MAX_SEGMENTS).toBe(MAX_SEGMENTS);
  });
});

describe("内容字节上限的精确边界", () => {
  it("恰好 2 MiB 通过，多 1 字节拒绝并在错误信息中给出实际字节数与上限", () => {
    expect(() => assertContentWithinLimit(contentAtLimit)).not.toThrow();
    expect(() => assertContentWithinLimit(contentAtLimit + "a")).toThrow(/INPUT_SIZE_LIMIT: transcript is 2097153 bytes, limit is 2097152/);
  });

  it("MCP prepare_meeting 恰好 2 MiB 的 ASCII 内容仍可正常规范化", () => {
    const result = callTool("prepare_meeting", { content: contentAtLimit, fileName: "x.txt" });
    expect(result.isError).not.toBe(true);
  });
});

describe("段落数上限的精确边界", () => {
  it("恰好 10,000 段通过，10,001 段拒绝", () => {
    expect(normalizeTranscript(segmentsContent(MAX_SEGMENTS), "x.md", { maxSegments: MAX_SEGMENTS }).segments).toHaveLength(MAX_SEGMENTS);
    expect(() => normalizeTranscript(segmentsContent(MAX_SEGMENTS + 1), "x.md", { maxSegments: MAX_SEGMENTS })).toThrow("INPUT_SEGMENT_LIMIT");
  });
});

describe("MCP prepare_meeting 的超限口径", () => {
  it("ASCII 超限内容报 INPUT_SIZE_LIMIT，而不是 Zod 的 INPUT_INVALID", () => {
    const result = callTool("prepare_meeting", { content: contentAtLimit + "a", fileName: "x.txt" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe("INPUT_SIZE_LIMIT");
  });

  it("同一段中文超限内容同样报 INPUT_SIZE_LIMIT", () => {
    const cjk = "界".repeat(Math.floor(MAX_CONTENT_BYTES / 3) + 1);
    expect(Buffer.byteLength(cjk, "utf8")).toBe(MAX_CONTENT_BYTES + 1);
    const result = callTool("prepare_meeting", { content: cjk, fileName: "x.txt" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe("INPUT_SIZE_LIMIT");
  });
});

describe("normalizeTranscript 的 maxSegments 归一化", () => {
  const atLimit = segmentsContent(MAX_SEGMENTS);
  const overLimit = segmentsContent(MAX_SEGMENTS + 1);

  it("NaN、Infinity、-5 都回落到 MAX_SEGMENTS", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -5]) {
      expect(normalizeTranscript(atLimit, "x.md", { maxSegments: value }).segments).toHaveLength(MAX_SEGMENTS);
      expect(() => normalizeTranscript(overLimit, "x.md", { maxSegments: value })).toThrow("INPUT_SEGMENT_LIMIT");
    }
  });

  it("有限小数向下取整", () => {
    expect(normalizeTranscript(segmentsContent(3), "x.md", { maxSegments: 3.9 }).segments).toHaveLength(3);
    expect(() => normalizeTranscript(segmentsContent(4), "x.md", { maxSegments: 3.9 })).toThrow("INPUT_SEGMENT_LIMIT");
  });
});

describe("CLI analyze 的超大文件拦截", () => {
  it("超过 2 MiB 的文件直接拒绝且错误信息包含路径/大小/上限", () => {
    const dir = mkdtempSync(join(tmpdir(), "meeting-limit-"));
    try {
      const oversized = join(dir, "oversized.txt");
      writeFileSync(oversized, "a".repeat(MAX_CONTENT_BYTES + 1));
      const rejected = cliRun(["analyze", oversized], envWithoutApiKeys());
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toContain("INPUT_SIZE_LIMIT");
      expect(rejected.stderr).toContain(resolve(oversized));
      expect(rejected.stderr).toContain(String(MAX_CONTENT_BYTES + 1));
      expect(rejected.stderr).toContain(String(MAX_CONTENT_BYTES));

      // 边界准确：恰好 2 MiB 应通过大小门槛，随后仍按既有配置校验失败。
      const atLimit = join(dir, "at-limit.txt");
      writeFileSync(atLimit, contentAtLimit);
      const accepted = cliRun(["analyze", atLimit], envWithoutApiKeys());
      expect(accepted.status).toBe(1);
      expect(accepted.stderr).toContain("CONFIG_MISSING");
      expect(accepted.stderr).not.toContain("INPUT_SIZE_LIMIT");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("不存在的文件保持既有 ENOENT 失败语义", () => {
    const dir = mkdtempSync(join(tmpdir(), "meeting-limit-"));
    try {
      const missing = join(dir, "missing.txt");
      const result = cliRun(["analyze", missing], envWithoutApiKeys());
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("ENOENT");
      expect(result.stderr).not.toContain("INPUT_SIZE_LIMIT");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);
});