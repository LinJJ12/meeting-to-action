import {it,expect} from "vitest";
import {spawnSync} from "node:child_process";
import {mkdtemp,mkdir,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";

const setupEntry=resolve("src/setup.ts");

function run(args:string[]){
 return spawnSync(process.execPath,["--import","tsx",setupEntry,...args],{encoding:"utf8",timeout:20_000});
}

it("无参数打印 usage 并以 exit 2 退出（#19 入口覆盖缺口）",()=>{
 const result=run([]);
 expect(result.status).toBe(2);
 expect(result.stderr).toContain("Usage:");
},20_000);

it("非法 --client 值是用法错误：exit 2 + usage（入口预校验，不进安装器）",()=>{
 const result=run(["--client","vscode","--project","x"]);
 expect(result.status).toBe(2);
 expect(result.stderr).toContain("Usage:");
},20_000);

it("未知参数与缺值同样按用法错误 exit 2",()=>{
 expect(run(["--client","cursor","--runtime","y","--project","x"]).status).toBe(2);
 expect(run(["--client","cursor"]).status).toBe(2);
 expect(run(["--client","cursor","--project","--apply"]).status).toBe(2);
},30_000);

it("预览（无 --apply）不写盘，--apply 写入成功且幂等（runtime 固定为仓库根）",async()=>{
 const root=await mkdtemp(join(tmpdir(),"mta-setup-entry-"));
 const project=join(root,"project");
 await mkdir(project);
 try{
  const preview=run(["--client","cursor","--project",project]);
  expect(preview.status).toBe(0);
  expect(preview.stdout).toContain('"applied": false');
  const applied=run(["--client","cursor","--project",project,"--apply"]);
  expect(applied.status).toBe(0);
  expect(applied.stdout).toContain('"applied": true');
  expect(applied.stdout).toContain(".cursor");
  const again=run(["--client","cursor","--project",project,"--apply"]);
  expect(again.status).toBe(0);
  expect(again.stdout).toContain('"unchanged"');
 }finally{await rm(root,{recursive:true,force:true});}
},30_000);
