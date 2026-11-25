import {it,expect} from "vitest";
import {spawnSync} from "node:child_process";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";

const cli=resolve("src/cli.ts");
const transcript=resolve("examples/agent-workflow/edge-cases.md");

/** 子进程环境：剥掉 provider 配置，保证用例只测显式来源（--env / shell env）。 */
function childEnv(extra:Record<string,string>={}):NodeJS.ProcessEnv{
 const env={...process.env};
 delete env.OPENAI_API_KEY;
 delete env.OPENAI_MODEL;
 delete env.OPENAI_BASE_URL;
 delete env.OPENAI_TIMEOUT_MS;
 delete env.OPENAI_ALLOW_INSECURE;
 delete env.OPENAI_VERBOSE_ERRORS;
 return {...env,...extra};
}

function run(args:string[],env:NodeJS.ProcessEnv={}){
 return spawnSync(process.execPath,["--import","tsx",cli,...args],{encoding:"utf8",env:childEnv(env),timeout:20_000});
}

it("cwd 下的 .env 不再被隐式加载：子进程运行在含伪造 .env 的目录仍按 CONFIG_MISSING 拒绝",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"mta-env-"));
 try{
  await writeFile(join(dir,".env"),"OPENAI_API_KEY=sk-fake\nOPENAI_MODEL=fake\nOPENAI_BASE_URL=http://127.0.0.1:9/v1\n");
  // 用编译产物而非 tsx：tsx 按 cwd 解析依赖，无法让子进程运行在临时目录。
  // 该用例需要先构建（preflight / CI 都是 build 先于 test）。修复前 dotenv 会
  // 从 cwd 隐式加载这份伪造配置（用例变红），修复后必须 CONFIG_MISSING。
  const result=spawnSync(process.execPath,[resolve("dist/cli.js"),"analyze",transcript],{encoding:"utf8",env:childEnv(),timeout:20_000,cwd:dir});
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("CONFIG_MISSING");
 }finally{await rm(dir,{recursive:true,force:true});}
},20_000);

it("--env 显式指定时配置生效（连不上的 loopback 端点给出 REQUEST_FAILED 而非 CONFIG_MISSING）",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"mta-env-"));
 try{
  const envFile=join(dir,"meeting.env");
  await writeFile(envFile,"OPENAI_API_KEY=sk-fake\nOPENAI_MODEL=fake\nOPENAI_BASE_URL=http://127.0.0.1:9/v1\n");
  const result=run(["analyze",transcript,"--env",envFile]);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("REQUEST_FAILED");
  expect(result.stderr).not.toContain("CONFIG_MISSING");
 }finally{await rm(dir,{recursive:true,force:true});}
},30_000);

it("--env 指向不可读文件时按 CONFIG_INVALID 退出",()=>{
 const result=run(["analyze",transcript,"--env","Z:/definitely/missing/env.file"]);
 expect(result.status).toBe(1);
 expect(result.stderr).toContain("CONFIG_INVALID");
},20_000);

it("非法 --env 用在非 analyze 命令上按用法错误退出",()=>{
 const result=run(["inspect",transcript,"--env","whatever"]);
 expect(result.status).toBe(2);
 expect(result.stderr).toContain("Usage:");
},20_000);

it("OPENAI_TIMEOUT_MS 越界或非整数按 CONFIG_INVALID 拒绝（#19 覆盖缺口）",()=>{
 for(const timeout of ["999","400000","abc","1500.5"]){
  const result=run(["analyze",transcript],{OPENAI_API_KEY:"sk",OPENAI_MODEL:"m",OPENAI_TIMEOUT_MS:timeout});
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("CONFIG_INVALID");
 }
},30_000);

it("缺 OPENAI_MODEL 按 CONFIG_MISSING 拒绝",()=>{
 const result=run(["analyze",transcript],{OPENAI_API_KEY:"sk"});
 expect(result.status).toBe(1);
 expect(result.stderr).toContain("CONFIG_MISSING");
},20_000);

it("非 loopback 明文 http 端点默认拒绝（CONFIG_INVALID），不开 allow 开关时不发起请求",()=>{
 const result=run(["analyze",transcript],{OPENAI_API_KEY:"sk",OPENAI_MODEL:"m",OPENAI_BASE_URL:"http://10.255.255.1/v1"});
 expect(result.status).toBe(1);
 expect(result.stderr).toContain("CONFIG_INVALID");
},20_000);
