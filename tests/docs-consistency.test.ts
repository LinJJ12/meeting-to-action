import { it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { toolErrorCodes } from "../src/mcp/tools.js";
import { APP_VERSION } from "../src/version.js";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".git",
  ".npm-cache",
  ".local-client-check",
  ".zcode",
]);

/** 遍历仓库收集 .md 文件（忽略构建产物与本地目录）。 */
function walkMd(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkMd(full));
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
}

/**
 * #22 防漂移：文档里承诺的错误码集合必须与代码一致。
 * 中文主版 docs/guides/MCP.md 与英文变体 docs/en/guides/MCP.md 各有一行
 * Known codes（机器解析行，保持英文原文），
 * 每份的 Known codes = tools.ts 白名单 ∪ {INPUT_INVALID, TOOL_UNKNOWN}
 * （两个兜底码由 default 分支与 toolErrorCode fallback 直接产生，不在白名单里）。
 */
it("docs/guides/MCP.md 与 docs/en/guides/MCP.md 的 Known codes 都与 tools.ts 白名单完全一致", () => {
  for (const file of ["docs/guides/MCP.md", "docs/en/guides/MCP.md"]) {
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
it("README（含 docs/en/ 英文变体）与 ANALYSIS-ENGINE 不再出现“无自动重试”表述", () => {
  for (const file of ["README.md", "docs/en/README.md", "docs/en/guides/ANALYSIS-ENGINE.md"]) {
    const text = readFileSync(new URL("../" + file, import.meta.url), "utf8");
    expect(text.includes("No automatic retries"), `${file} 仍声称无自动重试`).toBe(false);
    expect(text.includes("尚无自动长文分析、重试"), `${file} 仍声称无重试`).toBe(false);
  }
});

/** PRD 必须说明 CI 在 push/PR 上运行与 preflight 相同的验证步骤（#20/#22、#36）。 */
it("docs/en/design/PRD.md 说明 CI 运行与 preflight 相同的七步", () => {
  const text = readFileSync(new URL("../docs/en/design/PRD.md", import.meta.url), "utf8");
  expect(text.includes("CI runs the same seven steps on push and pull requests")).toBe(true);
  expect(text.includes("paused")).toBe(false);
});

/** CHANGELOG 双语对必须包含当前包版本对应的发布小节（Keep a Changelog 标题格式；英文变体在 docs/en/）。 */
it("CHANGELOG.md 与 docs/en/CHANGELOG.md 都包含 APP_VERSION 的发布小节", () => {
  for (const file of ["CHANGELOG.md", "docs/en/CHANGELOG.md"]) {
    const text = readFileSync(new URL("../" + file, import.meta.url), "utf8");
    expect(text.includes(`## [${APP_VERSION}]`), `${file} 缺少 ${APP_VERSION} 的发布小节`).toBe(
      true,
    );
  }
});

/** 语言布局守卫：.en.md 旧约定不得回流，英文内容集中在 docs/en/（双语对规则见 docs/INDEX.md）。 */
it("仓库不再使用 .en.md 后缀命名英文变体", () => {
  const offenders = walkMd(REPO_ROOT).filter((f) => f.endsWith(".en.md"));
  expect(offenders, `旧命名的英文变体应移入 docs/en/: ${offenders.join(", ")}`).toEqual([]);
});

/** 双语对清单：中文主版必须与 docs/en/ 同名英文变体成对存在（防单侧漂移，新增双语对在此登记）。 */
const BILINGUAL_PAIRS: readonly (readonly [string, string])[] = [
  ["README.md", "docs/en/README.md"],
  ["CONTRIBUTING.md", "docs/en/CONTRIBUTING.md"],
  ["CHANGELOG.md", "docs/en/CHANGELOG.md"],
  ["SECURITY.md", "docs/en/SECURITY.md"],
  ["CODE_OF_CONDUCT.md", "docs/en/CODE_OF_CONDUCT.md"],
  ["docs/INDEX.md", "docs/en/INDEX.md"],
  ["docs/guides/PLUGIN-INSTALL.md", "docs/en/guides/PLUGIN-INSTALL.md"],
  ["docs/guides/CLIENT-SETUP.md", "docs/en/guides/CLIENT-SETUP.md"],
  ["docs/guides/MCP.md", "docs/en/guides/MCP.md"],
  ["docs/guides/CLI-ERRORS.md", "docs/en/guides/CLI-ERRORS.md"],
];
it("双语对的中文主版与 docs/en/ 英文变体成对存在", () => {
  for (const [main, variant] of BILINGUAL_PAIRS) {
    expect(existsSync(join(REPO_ROOT, main)), `缺少中文主版 ${main}`).toBe(true);
    expect(existsSync(join(REPO_ROOT, variant)), `缺少英文变体 ${variant}`).toBe(true);
  }
});

/** 链接完整性：根目录与 docs/（含 en/）Markdown 的相对链接必须解析到真实文件；绝对 URL 不校验。 */
it("根目录与 docs/ 的 Markdown 相对链接无断链", () => {
  const files = [
    ...readdirSync(REPO_ROOT)
      .filter((f) => f.endsWith(".md"))
      .map((f) => join(REPO_ROOT, f)),
    ...walkMd(join(REPO_ROOT, "docs")),
  ];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const dir = dirname(file);
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const target = match[1]!;
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
      const pathOnly = target.split("#")[0]!;
      if (pathOnly === "") continue;
      expect(existsSync(resolve(dir, pathOnly)), `${file} 存在断链: ${target}`).toBe(true);
    }
  }
});
