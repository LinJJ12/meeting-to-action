import {lstat,readdir,readFile,realpath,mkdir,writeFile,stat} from "node:fs/promises";
import {resolve,join,dirname,relative,sep,basename,isAbsolute} from "node:path";

export type ClientName="codex"|"cursor";
export type SetupOptions={client:ClientName;project:string;runtime:string;apply?:boolean};
export type SetupPlan={client:ClientName;project:string;files:{path:string;status:"create"|"unchanged"}[];applied:boolean};
const windows=process.platform==="win32";
/** Reject path forms that are never legitimate install targets: UNC shares, device
 * namespaces, alternate data streams and drive-relative Windows paths. */
function assertSafePathForm(candidate:string){
 if(candidate.includes("\0"))throw new Error("SETUP_PATH_INVALID");
 if(/^[\\/]{2}/.test(candidate))throw new Error("SETUP_PATH_INVALID");
 if(!windows)return;
 if(/^[A-Za-z]:(?![\\/])/.test(candidate))throw new Error("SETUP_PATH_INVALID");
 const absolute=/^[A-Za-z]:[\\/]/.test(candidate);
 for(let index=candidate.indexOf(":");index!==-1;index=candidate.indexOf(":",index+1))
  if(!(absolute&&index===1))throw new Error("SETUP_PATH_INVALID");
}
/** Resolve a path whose tail may not exist yet: realpath the nearest existing ancestor
 * and append the remaining segments verbatim, so junctions in the existing prefix are
 * always followed while a not-yet-created tail cannot escape through them. */
async function canonicalPath(target:string):Promise<string>{
 const tail:string[]=[];
 let current=resolve(target);
 for(;;){
  try{
   const resolved=await realpath(current);
   return tail.length===0?resolved:join(resolved,...tail.reverse());
  }catch(error){
   const code=(error as NodeJS.ErrnoException).code;
   if(code!=="ENOENT"&&code!=="ENOTDIR")throw error;
   const parent=dirname(current);
   if(parent===current)throw new Error("SETUP_PATH_ESCAPE");
   tail.push(basename(current));current=parent;
  }
 }
}
/** Resolve target and prove it stays inside root after canonicalization. The lexical
 * and the real path are checked separately so `..`, junction and symlink escapes are
 * rejected independently of lstat's link flags, which differ between Node versions on
 * Windows (Node 20 reports a directory junction as not a symlink). */
export async function resolveContainedPath(root:string,target:string):Promise<string>{
 assertSafePathForm(root);assertSafePathForm(target);
 const resolvedRoot=resolve(root),resolvedTarget=resolve(target);
 const lexical=relative(resolvedRoot,resolvedTarget);
 if(lexical===".."||lexical.startsWith(".."+sep)||isAbsolute(lexical))throw new Error("SETUP_PATH_ESCAPE");
 const rootReal=await realpath(resolvedRoot),targetReal=await canonicalPath(resolvedTarget);
 const normalize=(path:string)=>windows?path.toLowerCase():path;
 const canonical=relative(normalize(rootReal),normalize(targetReal));
 if(canonical===".."||canonical.startsWith(".."+sep)||isAbsolute(canonical))throw new Error("SETUP_LINK_REJECTED");
 return targetReal;
}
async function exists(path:string){try{return await lstat(path);}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return undefined;throw error;}}
async function sourceFiles(root:string,prefix=""):Promise<{relative:string;content:Buffer}[]>{
 const files:{relative:string;content:Buffer}[]=[];
 for(const entry of await readdir(await resolveContainedPath(root,join(root,prefix)),{withFileTypes:true})){
  const rel=join(prefix,entry.name),path=await resolveContainedPath(root,join(root,rel));
  if(entry.isSymbolicLink())throw new Error("SETUP_LINK_REJECTED");
  if(entry.isDirectory())files.push(...await sourceFiles(root,rel));
  else if(entry.isFile())files.push({relative:rel,content:await readFile(path)});
  else throw new Error("SETUP_SOURCE_INVALID");
 }
 return files;
}
/** Project-local setup only. Existing different files are never replaced or merged. */
export async function setupProject(options:SetupOptions):Promise<SetupPlan>{
 if(!["codex","cursor"].includes(options.client))throw new Error("SETUP_CLIENT_INVALID");
 assertSafePathForm(options.project);assertSafePathForm(options.runtime);
 const project=await realpath(resolve(options.project)),runtime=await realpath(resolve(options.runtime));
 if(!(await stat(project)).isDirectory())throw new Error("SETUP_PROJECT_INVALID");
 const server=await resolveContainedPath(runtime,join(runtime,"dist","mcp","server.js"));
 if(!(await stat(server)).isFile())throw new Error("SETUP_BUILD_REQUIRED");
 const source=await resolveContainedPath(runtime,join(runtime,"skills","meeting-to-action"));
 if(!(await stat(source)).isDirectory())throw new Error("SETUP_SOURCE_INVALID");
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
  const destination=await resolveContainedPath(project,file.path);const info=await exists(file.path);
  if(info&&(!info.isFile()||!file.content.equals(await readFile(destination))))throw new Error("SETUP_CONFLICT: "+file.path);
  plan.files.push({path:file.path,status:info?"unchanged":"create"});
 }
 if(options.apply){
  for(let i=0;i<writes.length;i++){
   const file=writes[i]!;
   if(plan.files[i]!.status==="unchanged")continue;
   const destination=await resolveContainedPath(project,file.path);
   await mkdir(dirname(destination),{recursive:true});
   await writeFile(destination,file.content,{flag:"wx"});
  }
  plan.applied=true;
 }
 return plan;
}