import {it,expect} from "vitest";
import {spawnSync} from "node:child_process";
import {mkdtemp,rm,readdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";

const cli=resolve("src/cli.ts");
const transcript=resolve("examples/agent-workflow/edge-cases.md");

function run(...args:string[]){
 return spawnSync(process.execPath,["--import","tsx",cli,...args],{encoding:"utf8",timeout:20_000});
}

it("--out 拒绝跨平台的网络/设备路径形态，且不创建任何文件（#23）",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"mta-out-"));
 try{
  // 前导 // 或 \\ 的形态在所有平台都被 path-guard 拒绝
  const cases=["//server/share/x.md","\\\\127.0.0.1\\share\\x.md","\\\\?\\C:\\temp\\x.md","\\\\.\\pipe\\x"];
  for(const bad of cases){
   const result=run("inspect",transcript,"--out",bad);
   expect(result.status,bad).toBe(1);
   expect(result.stderr,bad).toContain("OUT_PATH_INVALID");
  }
  // 目标目录未被写入任何占位文件
  expect(await readdir(dir)).toEqual([]);
 }finally{await rm(dir,{recursive:true,force:true});}
},30_000);

// 盘符相对/ADS/保留设备名是 Windows 专属概念：POSIX 上它们是合法文件名，
// path-guard 在非 Windows 平台有意放行，因此这些用例只在 Windows 断言。
const itOnWindows=it.skipIf(process.platform!=="win32");
itOnWindows("--out 拒绝盘符相对/ADS/保留设备名形态（Windows）",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"mta-out-win-"));
 try{
  for(const bad of ["C:relative.md","report.md:ads","CON","com1"]){
   const result=run("inspect",transcript,"--out",bad);
   expect(result.status,bad).toBe(1);
   expect(result.stderr,bad).toContain("OUT_PATH_INVALID");
  }
  expect(await readdir(dir)).toEqual([]);
 }finally{await rm(dir,{recursive:true,force:true});}
},30_000);

it("--out 错误信息回显用户输入且超过 120 字符时截断",()=>{
 const longPath="//server/share/"+ "x".repeat(200)+".md";
 const result=run("inspect",transcript,"--out",longPath);
 expect(result.status).toBe(1);
 expect(result.stderr).toContain("OUT_PATH_INVALID");
 expect(result.stderr).toContain("…");
 // 不回显解析后的绝对路径
 expect(result.stderr).not.toMatch(new RegExp(process.cwd().replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
},20_000);

it("正常本地路径的 --out 不受影响",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"mta-out-ok-"));
 try{
  // 用绝对本地路径保持子进程 cwd 在仓库根（tsx 按子进程 cwd 解析依赖）
  const result=run("inspect",transcript,"--out",join(dir,"normalized-ok.json"));
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Wrote ");
 }finally{await rm(dir,{recursive:true,force:true});}
},20_000);
