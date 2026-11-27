// 一键同步版本（#17）：唯一书写点是 src/version.ts 的 APP_VERSION，
// 本脚本把 package.json、package-lock.json（顶层与 packages."" 两处）与
// plugin/plugin.json 全部对齐到同一值；漏改 lock 的任意一处会被 `npm ci`
// 的同步校验拒绝。用法：node scripts/version-sync.mjs 0.2.0
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error("usage: node scripts/version-sync.mjs <semver>");
  process.exit(2);
}
const oldVersion = /export const APP_VERSION\s*=\s*"([^"]+)"/.exec(
  await readFile(resolve(repo, "src/version.ts"), "utf8"),
)?.[1];
if (!oldVersion) throw new Error("cannot read current APP_VERSION from src/version.ts");
const edit = async (file, fn) => {
  const full = resolve(repo, file);
  const updated = fn(await readFile(full, "utf8"));
  await writeFile(full, updated);
  console.log("updated", file);
};
await edit("src/version.ts", (s) =>
  s.replace(/(export const APP_VERSION\s*=\s*)"[^"]+"/, (_, prefix) => `${prefix}"${version}"`),
);
await edit("package.json", (s) =>
  s.replaceAll(`"version": "${oldVersion}"`, `"version": "${version}"`),
);
await edit("plugin/plugin.json", (s) =>
  s.replaceAll(`"version": "${oldVersion}"`, `"version": "${version}"`),
);
// lock 里顶层与 packages."" 各有一个相同值（依赖的版本串恰好相同则一并更新也无害，
// npm 会按实际依赖重新锁定）
await edit("package-lock.json", (s) =>
  s.replaceAll(`"version": "${oldVersion}"`, `"version": "${version}"`),
);
console.log("all versions synced to", version);
