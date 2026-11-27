import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { toolErrorCodes } from "../src/mcp/tools.js";
import { APP_VERSION } from "../src/version.js";

/**
 * #22 防漂移：文档里承诺的错误码集合必须与代码一致。
 * MCP.md 与英文变体 MCP.en.md 各有一行 Known codes（机器解析行，保持英文原文），
 * 每份的 Known codes = tools.ts 白名单 ∪ {INPUT_INVALID, TOOL_UNKNOWN}
 * （两个兜底码由 default 分支与 toolErrorCode fallback 直接产生，不在白名单里）。
 */
it("docs/MCP.md 与 MCP.en.md 的 Known codes 都与 tools.ts 白名单完全一致", () => {
  for (const file of ["docs/MCP.md", "docs/MCP.en.md"]) {
    const md = readFileSync(new URL("../" + file, import.meta.url), "utf8");
    const line = md.split("\n").find((l) => l.includes("Known codes include"));
    expect(line, `${file} 缺少 Known codes 行`).toBeDefined();
    const documented = new Set([...(line!.match(/[A-Z][A-Z_]{3,}/g) ?? [])]);
    // 双向核对：白名单每个码文档必须记载，文档不得出现白名单之外的自造码。
    for (const code of toolErrorCodes) {
      expect(documented.has(code), `${file} 缺少错误码 ${code}`).toBe(true);
    }
    expect(documented.has("INPUT_INVALID")).toBe(true);
    expect(documented.has("TOOL_UNKNOWN")).toBe(true);
    expect(
      documented.size,
      `${file} 出现了白名单之外的错误码: ${[...documented].filter((c) => !toolErrorCodes.includes(c) && c !== "INPUT_INVALID" && c !== "TOOL_UNKNOWN").join(", ")}`,
    ).toBe(toolErrorCodes.length + 2);
  }
});

/** 文档不得再宣称“无重试”——与 analyzeMeeting 的默认重试语义（#9/#22）冲突。 */
it("README（含英文变体）与 ANALYSIS-ENGINE 不再出现“无自动重试”表述", () => {
  for (const file of ["README.md", "docs/README.en.md", "docs/ANALYSIS-ENGINE.md"]) {
    const text = readFileSync(new URL("../" + file, import.meta.url), "utf8");
    expect(text.includes("No automatic retries"), `${file} 仍声称无自动重试`).toBe(false);
    expect(text.includes("尚无自动长文分析、重试"), `${file} 仍声称无重试`).toBe(false);
  }
});

/** PRD 不得再声称 CI 在运行（#20/#22：CI 暂停，本地 preflight 为准）。 */
it("docs/PRD.md 不再声称 CI 运行", () => {
  const text = readFileSync(new URL("../docs/PRD.md", import.meta.url), "utf8");
  expect(text.includes("run in CI.")).toBe(false);
});

/** CHANGELOG 双语对必须包含当前包版本对应的发布小节（Keep a Changelog 标题格式；英文变体统一在 docs/）。 */
it("CHANGELOG.md 与 docs/CHANGELOG.en.md 都包含 APP_VERSION 的发布小节", () => {
  for (const file of ["CHANGELOG.md", "docs/CHANGELOG.en.md"]) {
    const text = readFileSync(new URL("../" + file, import.meta.url), "utf8");
    expect(text.includes(`## [${APP_VERSION}]`), `${file} 缺少 ${APP_VERSION} 的发布小节`).toBe(
      true,
    );
  }
});
