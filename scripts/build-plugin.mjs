import { build } from "esbuild";
import { execFile } from "node:child_process";
import { mkdir, cp, readFile, writeFile, readdir, rm, mkdtemp, rename } from "node:fs/promises";
import { resolve, join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
const repo = fileURLToPath(new URL("../", import.meta.url));
const json = async (path) => JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
const run = promisify(execFile);
export async function buildPlugin(output = join(repo, "dist", "plugin-marketplace")) {
  const plugin = join(output, "plugins", "meeting-to-action");
  // 重建前先清空输出目录，避免上一轮残留文件被一起安装（旧产物/已删除的引用会存活）
  await rm(output, { recursive: true, force: true });
  await mkdir(join(plugin, "server"), { recursive: true });
  // 版本单一来源是 src/version.ts 的 APP_VERSION（#17）：产物清单以它为准，
  // 避免源 plugin.json 与 package.json/服务端自报版本漂移。
  const appVersion = /export const APP_VERSION\s*=\s*"([^"]+)"/.exec(
    await readFile(join(repo, "src", "version.ts"), "utf8"),
  )?.[1];
  if (!appVersion) throw new Error("cannot read APP_VERSION from src/version.ts");
  const pluginManifest = await json(join(repo, "plugin", "plugin.json"));
  pluginManifest.version = appVersion;
  await writeFile(join(plugin, "plugin.json"), JSON.stringify(pluginManifest, null, 2) + "\n");
  // mcp.json 的 `command` 必须保持裸 `node`：Codex app-server 不会启动绝对路径的 command
  // （2026-11-26 实测：绝对 node 路径与无空格 junction 路径都会导致工具列表为空），
  // 因此运行环境要求 node 在客户端 PATH 内，详见 docs/PLUGIN-INSTALL.md。
  const mcp = await json(join(repo, "plugin", "mcp.json"));
  await writeFile(join(plugin, "mcp.json"), JSON.stringify(mcp, null, 2) + "\n");
  await cp(join(repo, "skills", "meeting-to-action"), join(plugin, "skills", "meeting-to-action"), {
    recursive: true,
  });
  const result = await build({
    absWorkingDir: repo,
    entryPoints: ["src/mcp/server.ts"],
    outfile: join(plugin, "server", "mcp.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    tsconfigRaw: { compilerOptions: { target: "ES2022" } },
    metafile: true,
    banner: {
      js: 'import {createRequire as __createRequire} from "node:module"; const require = __createRequire(import.meta.url);',
    },
    logLevel: "silent",
  });
  const packages = new Set();
  for (const file of Object.keys(result.metafile.inputs)) {
    const parts = file.replaceAll("\\", "/").split("/"),
      index = parts.lastIndexOf("node_modules");
    if (index < 0) continue;
    packages.add(parts.slice(0, index + 1 + (parts[index + 1]?.startsWith("@") ? 2 : 1)).join("/"));
  }
  const notices = [];
  for (const name of [...packages].sort()) {
    const folder = resolve(repo, name),
      pkg = await json(join(folder, "package.json"));
    notices.push(`## ${pkg.name}@${pkg.version} (${pkg.license ?? "see package license"})`);
    for (const file of (await readdir(folder)).filter((f) =>
      /^(license|copying|notice)(\.|$)/i.test(f),
    ))
      notices.push(await readFile(join(folder, file), "utf8"));
  }
  await writeFile(join(plugin, "THIRD-PARTY-NOTICES.txt"), notices.join("\n\n") + "\n");
  await mkdir(join(output, ".agents", "plugins"), { recursive: true });
  const marketplace = {
    name: "meeting-to-action-local",
    interface: { displayName: "Meeting-to-Action Local" },
    plugins: [
      {
        name: "meeting-to-action",
        source: { source: "local", path: "./plugins/meeting-to-action" },
        policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
        category: "Productivity",
      },
    ],
  };
  await writeFile(
    join(output, ".agents", "plugins", "marketplace.json"),
    JSON.stringify(marketplace, null, 2) + "\n",
  );
  // Codex 上传入口只接受单插件归档，市场清单仅用于本地市场注册。
  const archive = resolve(dirname(output), `meeting-to-action-v${appVersion}.tar.gz`);
  const staging = await mkdtemp(join(dirname(archive), ".plugin-archive-"));
  try {
    const temporaryArchive = join(staging, basename(archive));
    // GNU tar 会把含盘符冒号的 -f 值当作远程主机（Windows 上报 "Cannot connect to C:"），
    // 因此以 staging 为工作目录、用相对文件名落盘，再改名为最终产物，兼容 GNU/bsdtar。
    await run(
      "tar",
      ["-czf", basename(archive), "-C", resolve(dirname(plugin)), basename(plugin)],
      { cwd: staging },
    );
    await rename(temporaryArchive, archive);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return { marketplace: resolve(output), plugin: resolve(plugin), archive };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  console.log(JSON.stringify(await buildPlugin(), null, 2));
