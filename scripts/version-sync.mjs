// 一键同步版本（#17）：唯一书写点是 src/version.ts 的 APP_VERSION，
// 本脚本把 package.json、package-lock.json 顶层与 plugin/plugin.json 对齐到同一值。
// 用法：node scripts/version-sync.mjs 0.2.0
import {readFile,writeFile} from "node:fs/promises";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const repo=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const version=process.argv[2];
if(!version||!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)){
 console.error("usage: node scripts/version-sync.mjs <semver>");
 process.exit(2);
}
const edit=async(file,fn)=>{
 const full=resolve(repo,file);
 const updated=fn(await readFile(full,"utf8"));
 await writeFile(full,updated);
 console.log("updated",file);
};
await edit("src/version.ts",s=>s.replace(/export const APP_VERSION="[^"]+"/,`export const APP_VERSION="${version}"`));
await edit("package.json",s=>s.replace(/"version": "[^"]+"/,`"version": "${version}"`));
await edit("plugin/plugin.json",s=>s.replace(/"version": "[^"]+"/,`"version": "${version}"`));
await edit("package-lock.json",s=>s.replace(/"version": "[^"]+"/,`"version": "${version}"`));
console.log("all versions synced to",version);
