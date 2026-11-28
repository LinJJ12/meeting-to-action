import { build } from "esbuild";
import { mkdir, cp, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { resolve, join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
const repo = fileURLToPath(new URL("../", import.meta.url));
const json = async (path) => JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));

// 发布归档必须可复现：固定条目 mtime、权限、属主与 gzip 头，条目按路径排序。
// 不调用系统 tar：Windows 自带 bsdtar 会把权限写成 0777/0666、mtime 写成构建时刻，
// GNU tar 与 bsdtar 的参数也不一致；这里直接写 ustar + gzip，字节只由文件内容决定。
const TAR_MTIME = Date.UTC(2020, 0, 1) / 1000; // 2020-01-01T00:00:00Z
const TAR_DIR_MODE = 0o755;
const TAR_FILE_MODE = 0o644;

const writeString = (buffer, offset, length, text) => {
  const bytes = Buffer.from(text, "utf8");
  if (bytes.length > length) throw new Error(`tar field too long: ${text}`);
  bytes.copy(buffer, offset);
};
const writeOctal = (buffer, offset, length, value) => {
  const text = value.toString(8);
  if (text.length > length - 1) throw new Error(`tar octal field overflow: ${value}`);
  buffer.write(text.padStart(length - 1, "0"), offset, "ascii");
  buffer[offset + length - 1] = 0;
};
// ustar 的 name 只有 100 字节，更长的路径要拆成 prefix（155）+ name；本项目产物用不到，
// 但拆法保持标准，避免以后加文件时静默写坏归档。
const splitTarName = (name) => {
  if (Buffer.byteLength(name) <= 100) return { name, prefix: "" };
  for (let index = name.lastIndexOf("/"); index > 0; index = name.lastIndexOf("/", index - 1)) {
    const prefix = name.slice(0, index);
    const leaf = name.slice(index + 1);
    if (Buffer.byteLength(leaf) <= 100 && Buffer.byteLength(prefix) <= 155)
      return { name: leaf, prefix };
  }
  throw new Error(`archive path too long: ${name}`);
};
const tarHeader = (name, type, size) => {
  const header = Buffer.alloc(512, 0);
  const fields = splitTarName(name);
  writeString(header, 0, 100, fields.name);
  writeOctal(header, 100, 8, type === "5" ? TAR_DIR_MODE : TAR_FILE_MODE);
  writeOctal(header, 108, 8, 0); // uid
  writeOctal(header, 116, 8, 0); // gid
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, TAR_MTIME);
  header.fill(0x20, 148, 156); // 计算校验和时校验字段按空格计
  header[156] = type.charCodeAt(0);
  writeString(header, 257, 6, "ustar\0"); // magic
  writeString(header, 263, 2, "00"); // version
  writeOctal(header, 329, 8, 0); // devmajor
  writeOctal(header, 337, 8, 0); // devminor
  writeString(header, 345, 155, fields.prefix);
  let checksum = 0;
  for (const byte of header) checksum += byte;
  const digits = checksum.toString(8).padStart(6, "0");
  if (digits.length > 6) throw new Error(`tar checksum overflow: ${checksum}`);
  header.write(digits, 148, "ascii");
  header[154] = 0;
  header[155] = 0x20;
  return header;
};

/** 按名字字节序收集条目（父目录先于子项），保证归档顺序与文件系统遍历顺序无关。 */
async function collectTarEntries(dir, relative, entries) {
  const dirents = (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const dirent of dirents) {
    const name = `${relative}/${dirent.name}`;
    if (dirent.isDirectory()) {
      entries.push({ name: `${name}/`, type: "5" });
      await collectTarEntries(join(dir, dirent.name), name, entries);
    } else {
      entries.push({ name, type: "0", file: join(dir, dirent.name) });
    }
  }
}

/** 生成确定字节的 tar.gz：单一根目录、固定元数据、gzip mtime 为 0。 */
async function createReproducibleArchive(pluginDir) {
  const rootName = basename(pluginDir);
  const entries = [{ name: `${rootName}/`, type: "5" }];
  await collectTarEntries(pluginDir, rootName, entries);
  const chunks = [];
  for (const entry of entries) {
    const data = entry.type === "5" ? Buffer.alloc(0) : await readFile(entry.file);
    chunks.push(tarHeader(entry.name, entry.type, data.length), data);
    const padding = (512 - (data.length % 512)) % 512;
    if (padding > 0) chunks.push(Buffer.alloc(padding, 0));
  }
  chunks.push(Buffer.alloc(1024, 0)); // 归档结束标记
  return gzipSync(Buffer.concat(chunks), { level: 9 });
}
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
  // 因此运行环境要求 node 在客户端 PATH 内，详见 docs/en/guides/PLUGIN-INSTALL.md。
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
    for (const file of (await readdir(folder))
      .filter((f) => /^(license|copying|notice)(\.|$)/i.test(f))
      .sort())
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
  // 归档字节只由插件内容决定：固定 mtime/权限/属主与 gzip 头，条目按名字排序。
  // 连续两次构建必须得到相同 SHA-256（tests/scripts-reproducibility.test.ts 把关）。
  await mkdir(dirname(archive), { recursive: true });
  await writeFile(archive, await createReproducibleArchive(plugin));
  return { marketplace: resolve(output), plugin: resolve(plugin), archive };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  console.log(JSON.stringify(await buildPlugin(), null, 2));
