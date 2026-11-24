import {it,expect} from "vitest";
import {spawnSync} from "node:child_process";
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
it("CLI validates arguments, writes JSON, and never overwrites existing files",()=>{
 const dir=mkdtempSync(join(tmpdir(),"meeting-cli-"));
 const run=(...args:string[])=>spawnSync(process.execPath,["--import","tsx",resolve("src/cli.ts"),...args],{encoding:"utf8"});
 try{
  const input=join(dir,"meeting.md"),out=join(dir,"output.json");writeFileSync(input,"# Plan\n\nAlice: review.");
  expect(run("inspect",input,"--out",out).status).toBe(0);
  expect(JSON.parse(readFileSync(out,"utf8")).meeting.title).toBe("Plan");
  writeFileSync(out,"keep me");expect(run("inspect",input,"--out",out).status).toBe(1);
  expect(readFileSync(out,"utf8")).toBe("keep me");
  expect(run("inspect",input,"--out").status).toBe(2);
  expect(run("inspect",join(dir,"missing.md")).status).toBe(1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
