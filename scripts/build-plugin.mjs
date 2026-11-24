import {build} from "esbuild";
import {mkdir,cp,readFile,writeFile,readdir} from "node:fs/promises";
import {resolve,join,dirname} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
const repo=fileURLToPath(new URL("../",import.meta.url));
const json=async path=>JSON.parse((await readFile(path,"utf8")).replace(/^\uFEFF/,""));
export async function buildPlugin(output=join(repo,"dist","plugin-marketplace")){
 const plugin=join(output,"plugins","meeting-to-action");
 await mkdir(join(plugin,"server"),{recursive:true});
 for(const file of ["plugin.json","mcp.json"]){await writeFile(join(plugin,file),JSON.stringify(await json(join(repo,"plugin",file)),null,2)+"\n");}
 await cp(join(repo,"skills","meeting-to-action"),join(plugin,"skills","meeting-to-action"),{recursive:true});
 const result=await build({absWorkingDir:repo,entryPoints:["src/mcp/server.ts"],outfile:join(plugin,"server","mcp.mjs"),bundle:true,platform:"node",format:"esm",target:"node20",tsconfigRaw:{compilerOptions:{target:"ES2022"}},metafile:true,banner:{js:'import {createRequire as __createRequire} from "node:module"; const require = __createRequire(import.meta.url);'},logLevel:"silent"});
 const packages=new Set();
 for(const file of Object.keys(result.metafile.inputs)){
  const parts=file.replaceAll("\\","/").split("/"),index=parts.lastIndexOf("node_modules");
  if(index<0)continue;
  packages.add(parts.slice(0,index+1+(parts[index+1]?.startsWith("@")?2:1)).join("/"));
 }
 const notices=[];
 for(const name of [...packages].sort()){
  const folder=resolve(repo,name),pkg=await json(join(folder,"package.json"));
  notices.push(`## ${pkg.name}@${pkg.version} (${pkg.license??"see package license"})`);
  for(const file of (await readdir(folder)).filter(f=>/^(license|copying|notice)(\.|$)/i.test(f)))notices.push(await readFile(join(folder,file),"utf8"));
 }
 await writeFile(join(plugin,"THIRD-PARTY-NOTICES.txt"),notices.join("\n\n")+"\n");
 await mkdir(join(output,".agents","plugins"),{recursive:true});
 const marketplace={name:"meeting-to-action-local",interface:{displayName:"Meeting-to-Action Local"},plugins:[{name:"meeting-to-action",source:{source:"local",path:"./plugins/meeting-to-action"},policy:{installation:"AVAILABLE",authentication:"ON_INSTALL"},category:"Productivity"}]};
 await writeFile(join(output,".agents","plugins","marketplace.json"),JSON.stringify(marketplace,null,2)+"\n");
 return {marketplace:resolve(output),plugin:resolve(plugin)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await buildPlugin(),null,2));
