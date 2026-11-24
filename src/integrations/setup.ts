import {lstat,readdir,readFile,realpath,mkdir,writeFile,stat} from "node:fs/promises";
import {resolve,join,dirname,relative,sep} from "node:path";

export type ClientName="codex"|"cursor";
export type SetupOptions={client:ClientName;project:string;runtime:string;apply?:boolean};
export type SetupPlan={client:ClientName;project:string;files:{path:string;status:"create"|"unchanged"}[];applied:boolean};
async function exists(path:string){try{return await lstat(path);}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return undefined;throw error;}}
async function checkedPath(root:string,path:string){
 const rel=relative(root,path);
 if(rel===".."||rel.startsWith(".."+sep))throw new Error("SETUP_PATH_ESCAPE");
 let current=root;
 for(const part of rel.split(sep).filter(Boolean)){
  current=join(current,part);const info=await exists(current);
  if(info?.isSymbolicLink())throw new Error("SETUP_LINK_REJECTED");
 }
}
async function sourceFiles(root:string,prefix=""):Promise<{relative:string;content:Buffer}[]>{
 const files:{relative:string;content:Buffer}[]=[];
 for(const entry of await readdir(join(root,prefix),{withFileTypes:true})){
  const rel=join(prefix,entry.name);
  if(entry.isSymbolicLink())throw new Error("SETUP_LINK_REJECTED");
  if(entry.isDirectory())files.push(...await sourceFiles(root,rel));
  else if(entry.isFile())files.push({relative:rel,content:await readFile(join(root,rel))});
  else throw new Error("SETUP_SOURCE_INVALID");
 }
 return files;
}
/** Project-local setup only. Existing different files are never replaced or merged. */
export async function setupProject(options:SetupOptions):Promise<SetupPlan>{
 if(!["codex","cursor"].includes(options.client))throw new Error("SETUP_CLIENT_INVALID");
 const project=await realpath(resolve(options.project)),runtime=await realpath(resolve(options.runtime));
 if(!(await stat(project)).isDirectory())throw new Error("SETUP_PROJECT_INVALID");
 const server=join(runtime,"dist","mcp","server.js");
 if(!(await stat(server)).isFile())throw new Error("SETUP_BUILD_REQUIRED");
 const source=join(runtime,"skills","meeting-to-action");
 const sourceInfo=await lstat(source);if(sourceInfo.isSymbolicLink()||!sourceInfo.isDirectory())throw new Error("SETUP_SOURCE_INVALID");
 const files=await sourceFiles(source);
 if(!files.some(f=>f.relative==="SKILL.md"))throw new Error("SETUP_SOURCE_INVALID");
 const skillPath=join(project,options.client==="codex"?".agents":".cursor","skills","meeting-to-action");
 const command=process.execPath.replaceAll("\\","/"),args=[server.replaceAll("\\","/")];
 const configPath=join(project,options.client==="codex"?".codex":".cursor",options.client==="codex"?"config.toml":"mcp.json");
 const config=options.client==="codex"?`[mcp_servers.meeting_to_action]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}\n`:JSON.stringify({mcpServers:{"meeting-to-action":{command,args}}},null,2)+"\n";
 const writes=[...files.map(f=>({path:join(skillPath,f.relative),content:f.content})),{path:configPath,content:Buffer.from(config)}];
 const plan:SetupPlan={client:options.client,project,files:[],applied:false};
 // Preflight every destination before any writes. Never expose existing config contents.
 for(const file of writes){
  await checkedPath(project,file.path);const info=await exists(file.path);
  if(info&&(!info.isFile()||!file.content.equals(await readFile(file.path))))throw new Error("SETUP_CONFLICT: "+file.path);
  plan.files.push({path:file.path,status:info?"unchanged":"create"});
 }
 if(options.apply){
  for(let i=0;i<writes.length;i++){
   const file=writes[i]!;
   if(plan.files[i]!.status==="unchanged")continue;
   await checkedPath(project,file.path);
   await mkdir(dirname(file.path),{recursive:true});
   await writeFile(file.path,file.content,{flag:"wx"});
  }
  plan.applied=true;
 }
 return plan;
}
