import {describe,it,expect} from "vitest";
import {spawnSync} from "node:child_process";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {callTool} from "../src/mcp/tools.js";

// 真实评测里多个宿主执行者都踩到「只报 INPUT_SCHEMA_INVALID，不知道哪个字段」。
// 这两个用例固定「错误码 + 第一个字段路径」的对外契约（不泄露字段值）。
const badInput = {
  schemaVersion: "1.0",
  meeting: {id: "m1", title: "T"},
  sources: [{id: "s1", kind: "transcript", format: "bogus"}],
  segments: [{id: "x1", sourceId: "s1", text: "hello", lineStart: 1, lineEnd: 1}],
};

describe("schema error detail", () => {
  it("CLI 的 INPUT_SCHEMA_INVALID 带第一个字段路径", () => {
    const dir = mkdtempSync(join(tmpdir(), "meeting-schema-detail-"));
    const run = (...args: string[]) =>
      spawnSync(process.execPath, ["--import", "tsx", resolve("src/cli.ts"), ...args], {
        encoding: "utf8",
        timeout: 20_000,
        killSignal: "SIGKILL",
      });
    try {
      const input = join(dir, "bad.json");
      const analysis = join(dir, "analysis.json");
      writeFileSync(input, JSON.stringify(badInput));
      writeFileSync(analysis, "{}");
      const result = run("report", input, "--analysis", analysis);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("INPUT_SCHEMA_INVALID: sources.0.format");
      // 路径可以有，但字段值不能回显。
      expect(result.stderr).not.toContain('"bogus"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("MCP 的 INPUT_INVALID 带第一个字段路径且仍按码前缀分类", () => {
    const result = callTool("render_report", { input: badInput, analysis: {} });
    expect(result.isError).toBe(true);
    const text = result.content[0]!.text;
    expect(text).toContain("INPUT_INVALID: sources.0.format");
    expect(text.split(":")[0]).toBe("INPUT_INVALID");
  });
});