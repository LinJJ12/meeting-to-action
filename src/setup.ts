import {fileURLToPath} from "node:url";
import {setupProject,type ClientName} from "./integrations/setup.js";
const usage="Usage: node dist/setup.js --client codex|cursor --project <existing-directory> [--apply]";
const values=new Map<string,string>();let apply=false,invalid=false;
const args=process.argv.slice(2);
for(let i=0;i<args.length;i++){
 const key=args[i]!;
 if(key==="--apply"&&!apply){apply=true;continue;}
 const value=args[++i];
 if(!["--client","--project"].includes(key)||!value||value.startsWith("--")||values.has(key)){invalid=true;break;}
 values.set(key,value);
}
const client=values.get("--client"),project=values.get("--project");
if(invalid||!project||!client||!["codex","cursor"].includes(client)){console.error(usage);process.exitCode=2;}
else try{
 const plan=await setupProject({client:client as ClientName,project,runtime:fileURLToPath(new URL("../",import.meta.url)),apply});
 console.log(JSON.stringify(plan,null,2));
}catch(error){console.error(error instanceof Error?error.message:"SETUP_FAILED");process.exitCode=1;}
