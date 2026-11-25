import {it,expect} from "vitest";
import {spawn,spawnSync} from "node:child_process";
import {createServer,type Server} from "node:http";
import type {AddressInfo} from "node:net";
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
it("CLI validates arguments, writes JSON, and never overwrites existing files",()=>{
 const dir=mkdtempSync(join(tmpdir(),"meeting-cli-"));
 const run=(...args:string[])=>spawnSync(process.execPath,["--import","tsx",resolve("src/cli.ts"),...args],{encoding:"utf8",timeout:20_000,killSignal:"SIGKILL"});
 try{
  const input=join(dir,"meeting.md"),out=join(dir,"output.json");writeFileSync(input,"# Plan\n\nAlice: review.");
  expect(run("inspect",input,"--out",out).status).toBe(0);
  expect(JSON.parse(readFileSync(out,"utf8")).meeting.title).toBe("Plan");
  writeFileSync(out,"keep me");expect(run("inspect",input,"--out",out).status).toBe(1);
  expect(readFileSync(out,"utf8")).toBe("keep me");
  expect(run("inspect",input,"--out").status).toBe(2);
  expect(run("inspect",join(dir,"missing.md")).status).toBe(1);
  const version=run("--version");
  expect(version.status).toBe(0);
  expect(version.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

interface CliResult{status:number|null;stdout:string;stderr:string;}

function runCli(args:string[],env:NodeJS.ProcessEnv):Promise<CliResult>{
 return new Promise((resolvePromise)=>{
  const child=spawn(process.execPath,["--import","tsx",resolve("src/cli.ts"),...args],{
   env:{...process.env,...env},
   stdio:["ignore","pipe","pipe"],
  });
  let stdout="",stderr="";
  child.stdout.setEncoding("utf8").on("data",(chunk:string)=>{stdout+=chunk;});
  child.stderr.setEncoding("utf8").on("data",(chunk:string)=>{stderr+=chunk;});
  child.on("error",()=>resolvePromise({status:null,stdout,stderr}));
  child.on("close",(status)=>resolvePromise({status,stdout,stderr}));
 });
}

function listen(server:Server):Promise<number>{
 return new Promise((resolvePromise)=>{
  server.listen(0,"127.0.0.1",()=>resolvePromise((server.address() as AddressInfo).port));
 });
}

function closeServer(server:Server):Promise<void>{
 return new Promise((resolvePromise)=>{
  server.closeAllConnections();
  server.close(()=>resolvePromise());
 });
}

it("CLI 的 verbose 错误诊断脱敏上游凭据后再写 stderr",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"meeting-cli-redact-"));
 const server=createServer((_req,res)=>{
  res.writeHead(400,{"content-type":"application/json"});
  res.end(JSON.stringify({error:"SECRET_TRANSCRIPT_TOKEN_4f2a",key:"sk-live-ABC123",auth:"Bearer abc.def"}));
 });
 try{
  const port=await listen(server);
  const input=join(dir,"meeting.md");writeFileSync(input,"# Plan\n\nAlice: review.");
  const result=await runCli(["analyze",input],{
   OPENAI_API_KEY:"test-key",
   OPENAI_MODEL:"test-model",
   OPENAI_BASE_URL:`http://127.0.0.1:${port}/v1`,
   OPENAI_TIMEOUT_MS:"5000",
   OPENAI_VERBOSE_ERRORS:"1",
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("HTTP_ERROR");
  expect(result.stderr).toContain("[REDACTED]");
  expect(result.stderr).not.toContain("sk-live-ABC123");
  expect(result.stderr).not.toContain("abc.def");
  expect(result.stderr).not.toContain("SECRET_TRANSCRIPT_TOKEN_4f2a");
 }finally{
  try{await closeServer(server);}catch{/* 已关闭 */ }
  rmSync(dir,{recursive:true,force:true});
 }
});

it("CLI 网络失败时把稳定错误码写进 stderr",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"meeting-cli-network-"));
 try{
  const reserved=createServer();
  const port=await listen(reserved);
  await closeServer(reserved);
  const input=join(dir,"meeting.md");writeFileSync(input,"# Plan\n\nAlice: review.");
  const result=await runCli(["analyze",input],{
   OPENAI_API_KEY:"test-key",
   OPENAI_MODEL:"test-model",
   OPENAI_BASE_URL:`http://127.0.0.1:${port}/v1`,
   OPENAI_TIMEOUT_MS:"5000",
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("REQUEST_FAILED");
 }finally{
  rmSync(dir,{recursive:true,force:true});
 }
});
