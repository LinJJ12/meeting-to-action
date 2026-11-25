import {describe,it,expect} from "vitest";
import {mkdtemp,mkdir,readFile,writeFile,readdir,realpath,rm,symlink} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve,relative,dirname,basename,sep} from "node:path";
import {resolveContainedPath,setupProject} from "../src/integrations/setup.js";
const windows=process.platform==="win32";
async function temporary(){return mkdtemp(join(tmpdir(),"meeting-containment-"));}
async function cleanup(root:string){await rm(root,{recursive:true,force:true});}
async function link(target:string,path:string){await symlink(resolve(target),path,windows?"junction":"dir");}
async function fixture(){
 const root=await temporary(),project=join(root,"project space 中文"),runtime=join(root,"runtime");
 await mkdir(project);
 await mkdir(join(runtime,"dist","mcp"),{recursive:true});
 await writeFile(join(runtime,"dist","mcp","server.js"),"");
 await mkdir(join(runtime,"skills","meeting-to-action","references"),{recursive:true});
 await writeFile(join(runtime,"skills","meeting-to-action","SKILL.md"),"skill");
 await writeFile(join(runtime,"skills","meeting-to-action","references","rules.md"),"rules");
 return {root,project,runtime};
}
describe("resolveContainedPath",()=>{
 it("accepts existing and not-yet-created paths inside the root",async()=>{
  const root=await temporary();try{
   await mkdir(join(root,"existing"));
   expect(await resolveContainedPath(root,join(root,"existing"))).toBe(await realpath(join(root,"existing")));
   expect(await resolveContainedPath(root,join(root,"nested","deep","file.txt"))).toBe(join(await realpath(root),"nested","deep","file.txt"));
  }finally{await cleanup(root);}
 });
 it("accepts the root itself and paths that normalize back inside",async()=>{
  const root=await temporary();try{
   expect(await resolveContainedPath(root,root)).toBe(await realpath(root));
   const normalized=root+sep+".."+sep+basename(root)+sep+"inside.txt";
   expect(await resolveContainedPath(root,normalized)).toBe(join(await realpath(root),"inside.txt"));
  }finally{await cleanup(root);}
 });
 it("rejects traversal, absolute, and sibling-prefix targets outside the root",async()=>{
  const root=await temporary();try{
   await expect(resolveContainedPath(root,join(root,"..","escape.txt"))).rejects.toThrow(/PATH_ESCAPE/);
   await expect(resolveContainedPath(root,join(root,"sub","..","..","escape.txt"))).rejects.toThrow(/PATH_ESCAPE/);
   await expect(resolveContainedPath(root,dirname(root)+sep+basename(root)+"-sibling")).rejects.toThrow(/PATH_ESCAPE/);
   await expect(resolveContainedPath(root,join(dirname(root),"escape","file.txt"))).rejects.toThrow(/PATH_ESCAPE/);
  }finally{await cleanup(root);}
 });
 it("resolves a junction inside the root that points to an inside directory",async()=>{
  const root=await temporary();try{
   await mkdir(join(root,"real","nested"),{recursive:true});
   await link(join(root,"real"),join(root,"alias"));
   expect(await resolveContainedPath(root,join(root,"alias","nested","new.txt"))).toBe(join(await realpath(join(root,"real")),"nested","new.txt"));
  }finally{await cleanup(root);}
 });
 it("rejects a junction that points outside the root",async()=>{
  const root=await temporary();try{
   const project=join(root,"project"),outside=join(root,"outside");
   await mkdir(project);await mkdir(outside);
   await link(outside,join(project,"redirect"));
   await expect(resolveContainedPath(project,join(project,"redirect"))).rejects.toThrow(/LINK_REJECTED/);
   await expect(resolveContainedPath(project,join(project,"redirect","file.txt"))).rejects.toThrow(/LINK_REJECTED/);
  }finally{await cleanup(root);}
 });
 it("rejects a nested junction through a not-yet-created tail",async()=>{
  const root=await temporary();try{
   const project=join(root,"project"),outside=join(root,"outside");
   await mkdir(join(project,"skills"),{recursive:true});await mkdir(outside);
   await link(outside,join(project,"skills","redirect"));
   await expect(resolveContainedPath(project,join(project,"skills","redirect","deep","file.txt"))).rejects.toThrow(/LINK_REJECTED/);
  }finally{await cleanup(root);}
 });
 it("keeps containment consistent when the root itself is a junction",async()=>{
  const root=await temporary();try{
   await mkdir(join(root,"real-root","inside"),{recursive:true});
   await link(join(root,"real-root"),join(root,"root-alias"));
   const alias=join(root,"root-alias");
   expect(await resolveContainedPath(alias,join(alias,"inside","file.txt"))).toBe(join(await realpath(alias),"inside","file.txt"));
   await expect(resolveContainedPath(alias,join(alias,"..","outside.txt"))).rejects.toThrow(/PATH_ESCAPE/);
  }finally{await cleanup(root);}
 });
 it.skipIf(!windows)("treats Windows casing differences as the same root",async()=>{
  const root=await temporary();try{
   const alias=root.toUpperCase();
   expect(await resolveContainedPath(root,join(alias,"sub","file.txt"))).toBeTruthy();
  }finally{await cleanup(root);}
 });
 it("rejects UNC, device namespace, and NUL path forms",async()=>{
  const root=await temporary();try{
   for(const target of ["\\\\server\\share\\project","//server/share/project","\\\\?\\C:\\Windows\\project","\\\\.\\pipe\\project"])
    await expect(resolveContainedPath(root,target)).rejects.toThrow(/PATH_INVALID/);
   await expect(resolveContainedPath(root,"bad\0path")).rejects.toThrow(/PATH_INVALID/);
  }finally{await cleanup(root);}
 });
 it.skipIf(!windows)("rejects Windows drive-relative and alternate data stream forms",async()=>{
  const root=await temporary();try{
   await expect(resolveContainedPath(root,"C:relative")).rejects.toThrow(/PATH_INVALID/);
   await expect(resolveContainedPath(root,join(root,"file:stream"))).rejects.toThrow(/PATH_INVALID/);
   await expect(resolveContainedPath(root,join(root,".cursor","mcp.json")+":stream")).rejects.toThrow(/PATH_INVALID/);
  }finally{await cleanup(root);}
 });
});
describe("setupProject path containment",()=>{
 it("installs through a junction that stays inside the project",async()=>{
  const f=await fixture();try{
   const inside=join(f.project,"inside-cursor");await mkdir(inside);
   await link(inside,join(f.project,".cursor"));
   const plan=await setupProject({client:"cursor",project:f.project,runtime:f.runtime,apply:true});
   expect(plan.applied).toBe(true);
   const config=JSON.parse(await readFile(join(inside,"mcp.json"),"utf8"));
   expect(config.mcpServers["meeting-to-action"].args[0]).toContain("server.js");
   expect(await readFile(join(inside,"skills","meeting-to-action","references","rules.md"),"utf8")).toBe("rules");
  }finally{await cleanup(f.root);}
 });
 it("rejects a junction that redirects a client directory outside the project",async()=>{
  const f=await fixture();try{
   const outside=join(f.root,"outside");await mkdir(outside);
   await link(outside,join(f.project,".cursor"));
   await expect(setupProject({client:"cursor",project:f.project,runtime:f.runtime,apply:true})).rejects.toThrow(/LINK_REJECTED/);
   expect(await readdir(outside)).toEqual([]);
   expect(await readdir(f.project)).toEqual([".cursor"]);
  }finally{await cleanup(f.root);}
 });
 it("rejects a redirected nested skill directory before writing anything",async()=>{
  const f=await fixture();try{
   const outside=join(f.root,"outside");await mkdir(outside);
   await mkdir(join(f.project,".agents","skills"),{recursive:true});
   await link(outside,join(f.project,".agents","skills","meeting-to-action"));
   await expect(setupProject({client:"codex",project:f.project,runtime:f.runtime,apply:true})).rejects.toThrow(/LINK_REJECTED/);
   expect(await readdir(outside)).toEqual([]);
   expect(await readdir(join(f.project,".agents"))).toEqual(["skills"]);
  }finally{await cleanup(f.root);}
 });
});