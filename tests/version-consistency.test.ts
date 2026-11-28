import { it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_VERSION } from "../src/version.js";

type Json = Record<string, unknown>;
const readJson = async (path: string): Promise<Json> =>
  JSON.parse(await readFile(path, "utf8")) as Json;

/** #17：五处版本必须一致；唯一书写点是 src/version.ts，其余位点都与它对齐。 */
it("package.json、插件清单、lock 两处与 APP_VERSION 一致", () => {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8").replace(/^\uFEFF/, ""),
  ) as { version?: string };
  const plugin = JSON.parse(
    readFileSync(new URL("../plugin/plugin.json", import.meta.url), "utf8").replace(/^\uFEFF/, ""),
  ) as { version?: string };
  const lock = JSON.parse(
    readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
  ) as { version?: string; packages?: Record<string, { version?: string }> };
  expect(
    APP_VERSION,
    "src/version.ts 是唯一版本书写点，请同步 package.json（可运行 scripts/version-sync.mjs）",
  ).toBe(pkg.version);
  expect(APP_VERSION, "plugin/plugin.json 的 version 与 APP_VERSION 漂移").toBe(plugin.version);
  expect(APP_VERSION, "package-lock.json 顶层 version 与 APP_VERSION 漂移").toBe(lock.version);
  expect(
    APP_VERSION,
    'package-lock.json packages[""].version 与 APP_VERSION 漂移（npm ci 读它，漏改会导致安装版本错误）',
  ).toBe(lock.packages?.[""]?.version);
});

type RunResult = { status: number | null; stdout: string; stderr: string };
type Fixture = { root: string; run: (version: string) => RunResult };

type FixtureOptions = {
  packageVersion?: string;
  lockTopVersion?: string;
  /** null 表示 lock 里缺少 packages[""].version，用于验证脚本会拒绝不完整的 lock。 */
  lockRootVersion?: string | null;
  pluginVersion?: string;
  dependencyVersion?: string;
};

/** 在临时目录里造一份最小仓库布局，脚本按自身位置解析 repo，因此可以安全地跑真实写入。 */
async function makeFixture(options: FixtureOptions = {}): Promise<Fixture> {
  const {
    packageVersion = "0.1.1",
    lockTopVersion = "0.1.1",
    lockRootVersion = "0.1.1",
    pluginVersion = "0.1.1",
    dependencyVersion = "0.1.1",
  } = options;
  const root = await mkdtemp(join(tmpdir(), "version-sync-"));
  await mkdir(join(root, "scripts"), { recursive: true });
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "plugin"), { recursive: true });
  await copyFile(
    fileURLToPath(new URL("../scripts/version-sync.mjs", import.meta.url)),
    join(root, "scripts", "version-sync.mjs"),
  );
  await writeFile(join(root, "src", "version.ts"), 'export const APP_VERSION = "0.1.1";\n');
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "fixture", version: packageVersion, private: true }, null, 2) + "\n",
  );
  await writeFile(
    join(root, "plugin", "plugin.json"),
    JSON.stringify({ name: "fixture", version: pluginVersion }, null, 2) + "\n",
  );
  const packages: Json = { "node_modules/foo": { version: dependencyVersion } };
  if (lockRootVersion !== null) packages[""] = { name: "fixture", version: lockRootVersion };
  await writeFile(
    join(root, "package-lock.json"),
    JSON.stringify(
      { name: "fixture", version: lockTopVersion, lockfileVersion: 3, requires: true, packages },
      null,
      2,
    ) + "\n",
  );
  return {
    root,
    run: (version) =>
      spawnSync(process.execPath, [join(root, "scripts", "version-sync.mjs"), version], {
        cwd: root,
        encoding: "utf8",
      }),
  };
}

const readSite = async (fixture: Fixture, site: string): Promise<string | undefined> => {
  if (site === "src/version.ts")
    return /APP_VERSION\s*=\s*"([^"]+)"/.exec(
      await readFile(join(fixture.root, site), "utf8"),
    )?.[1];
  const isLockRootVersion = site === "package-lock.json packages[]";
  const json = await readJson(join(fixture.root, isLockRootVersion ? "package-lock.json" : site));
  if (isLockRootVersion) {
    const rootPackage = (json.packages as Json | undefined)?.[""] as Json | undefined;
    return rootPackage?.["version"] as string | undefined;
  }
  return json.version as string | undefined;
};

/** 已漂移的位点必须让脚本失败：写后校验不能只覆盖“本来就能替换成功”的情况。 */
it("version-sync 遇到漂移的 package.json 时非零退出且不写任何版本位点", async () => {
  const fixture = await makeFixture({ packageVersion: "9.9.9" });
  try {
    const result = fixture.run("0.4.0");
    expect(result.status, result.stderr).not.toBe(0);
    expect(result.stderr).toContain("VERSION_SYNC_FAILED: package.json still reports 9.9.9");
    expect(result.stderr).not.toContain(fixture.root);
    expect(await readSite(fixture, "src/version.ts")).toBe("0.1.1");
    expect(await readSite(fixture, "package-lock.json")).toBe("0.1.1");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

it("version-sync 同步 lock 两处版本但不动恰好同号的依赖版本，且可重复执行", async () => {
  const fixture = await makeFixture({ dependencyVersion: "0.1.1" });
  try {
    const first = fixture.run("0.4.0");
    expect(first.status, first.stderr).toBe(0);
    expect(await readSite(fixture, "src/version.ts")).toBe("0.4.0");
    expect(await readSite(fixture, "package.json")).toBe("0.4.0");
    expect(await readSite(fixture, "plugin/plugin.json")).toBe("0.4.0");
    expect(await readSite(fixture, "package-lock.json")).toBe("0.4.0");
    expect(await readSite(fixture, "package-lock.json packages[]")).toBe("0.4.0");
    const lock = await readJson(join(fixture.root, "package-lock.json"));
    expect((lock.packages as Json)["node_modules/foo"]).toEqual({ version: "0.1.1" });
    const second = fixture.run("0.4.0");
    expect(second.status, second.stderr).toBe(0);
    expect(await readSite(fixture, "package-lock.json packages[]")).toBe("0.4.0");
    const relocked = await readJson(join(fixture.root, "package-lock.json"));
    expect((relocked.packages as Json)["node_modules/foo"]).toEqual({ version: "0.1.1" });
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

it('version-sync 发现缺少 lock packages[""].version 时失败', async () => {
  const fixture = await makeFixture({ lockRootVersion: null });
  try {
    const result = fixture.run("0.4.0");
    expect(result.status, result.stderr).not.toBe(0);
    expect(result.stderr).toContain(
      'VERSION_SYNC_FAILED: package-lock.json packages[""].version still reports <missing>',
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
