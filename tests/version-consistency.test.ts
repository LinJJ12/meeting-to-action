import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { APP_VERSION } from "../src/version.js";

/** #17：三处版本必须一致；唯一书写点是 src/version.ts，package.json/plugin.json 与之对齐。 */
it("package.json、插件清单与 APP_VERSION 一致", () => {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8").replace(/^\uFEFF/, ""),
  ) as { version?: string };
  const plugin = JSON.parse(
    readFileSync(new URL("../plugin/plugin.json", import.meta.url), "utf8").replace(/^\uFEFF/, ""),
  ) as { version?: string };
  const lock = JSON.parse(
    readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
  ) as { version?: string };
  expect(
    APP_VERSION,
    "src/version.ts 是唯一版本书写点，请同步 package.json（可运行 scripts/version-sync.mjs）",
  ).toBe(pkg.version);
  expect(APP_VERSION, "plugin/plugin.json 的 version 与 APP_VERSION 漂移").toBe(plugin.version);
  expect(APP_VERSION, "package-lock.json 顶层 version 与 APP_VERSION 漂移").toBe(lock.version);
});
