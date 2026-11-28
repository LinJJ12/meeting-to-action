// 一键同步版本（#17）：唯一书写点是 src/version.ts 的 APP_VERSION，
// 本脚本把 package.json、package-lock.json（顶层 version 与 packages[""].version）
// 与 plugin/plugin.json 对齐到目标版本。npm ci 不会校验这些手工维护的版本字段，
// 因此脚本在写入前要求所有位点仍是当前版本，写入后逐个读回校验：
// 任一位点不一致都会打印 VERSION_SYNC_FAILED 并以非零退出，由脚本与
// tests/version-consistency.test.ts 一起兜住版本漂移。
// 用法：node scripts/version-sync.mjs 0.2.0
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error("usage: node scripts/version-sync.mjs <semver>");
  process.exit(2);
}

const SOURCE = "src/version.ts";
// 注意括号顺序：前缀里包含 `=`，只捕捉字符串字面量本身。
const APP_VERSION_LITERAL = /(export const APP_VERSION\s*=\s*)"([^"]+)"/;
const stripBom = (text) => text.replace(/^\uFEFF/, "");
const display = (value) => (value === undefined ? "<missing>" : String(value));
const readText = async (file) => stripBom(await readFile(resolve(repo, file), "utf8"));
const readJson = (text) => JSON.parse(text);
const writeJson = (mutate) => (text, target) => {
  const data = readJson(text);
  mutate(data, target);
  return JSON.stringify(data, null, 2) + "\n";
};

// 脚本实际维护的位点：唯一来源 + 四个清单/锁文件字段。写前与写后都按这份清单校验。
const files = [
  {
    file: SOURCE,
    sites: [{ label: SOURCE, read: (text) => APP_VERSION_LITERAL.exec(text)?.[2] }],
    write: (text, target) =>
      text.replace(APP_VERSION_LITERAL, (_match, prefix) => `${prefix}"${target}"`),
  },
  {
    file: "package.json",
    sites: [{ label: "package.json", read: (text) => readJson(text).version }],
    write: writeJson((data, target) => {
      data.version = target;
    }),
  },
  {
    file: "package-lock.json",
    sites: [
      { label: "package-lock.json", read: (text) => readJson(text).version },
      {
        label: 'package-lock.json packages[""].version',
        read: (text) => readJson(text).packages?.[""]?.version,
      },
    ],
    write: writeJson((data, target) => {
      data.version = target;
      if (data.packages?.[""]) data.packages[""].version = target;
    }),
  },
  {
    file: "plugin/plugin.json",
    sites: [{ label: "plugin/plugin.json", read: (text) => readJson(text).version }],
    write: writeJson((data, target) => {
      data.version = target;
    }),
  },
];

const reportFailures = (failures) => {
  for (const failure of failures) console.error(`VERSION_SYNC_FAILED: ${failure}`);
  process.exitCode = 1;
};

const source = await readText(SOURCE).catch(() => "");
const oldVersion = APP_VERSION_LITERAL.exec(source)?.[2];
if (!oldVersion) {
  reportFailures([`${SOURCE} still reports ${display(undefined)}`]);
  process.exit();
}

// 写前预检：任一位点已漂移就整体放弃，避免写出半数文件后才发现（也不静默“修正”漂移）。
const current = new Map();
const stale = [];
for (const { file, sites } of files) {
  const text = await readText(file).catch(() => undefined);
  if (text === undefined) {
    stale.push(`${sites[0].label} still reports ${display(undefined)}`);
    continue;
  }
  current.set(file, text);
  for (const site of sites) {
    const actual = site.read(text);
    if (actual !== oldVersion) stale.push(`${site.label} still reports ${display(actual)}`);
  }
}
if (stale.length > 0) {
  reportFailures(stale);
  process.exit();
}

for (const { file, write } of files) {
  await writeFile(resolve(repo, file), write(current.get(file), version));
  console.log("updated", file);
}

// 写后读回校验：所有位点必须都变成目标版本，失败时不依赖调用方猜测写入结果。
const unverified = [];
for (const { file, sites } of files) {
  const text = await readText(file).catch(() => undefined);
  for (const site of sites) {
    const actual = text === undefined ? undefined : site.read(text);
    if (actual !== version) unverified.push(`${site.label} still reports ${display(actual)}`);
  }
}
if (unverified.length > 0) {
  reportFailures(unverified);
} else {
  console.log("all versions synced to", version);
}
