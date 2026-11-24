import {spawn,type ChildProcessWithoutNullStreams} from "node:child_process";
import {resolve} from "node:path";

export interface StdioServer {
 child:ChildProcessWithoutNullStreams;
 stderr:()=>string;
 stdout:()=>string;
 invalidFrames:()=>string[];
 write:(chunk:string|Buffer)=>void;
 nextFrame:(predicate?:(frame:any)=>boolean,timeoutMs?:number)=>Promise<any>;
 close:(timeoutMs?:number)=>Promise<{code:number|null;signal:NodeJS.Signals|null}>;
 kill:()=>void;
}

interface Waiter{predicate:(frame:any)=>boolean;resolve:(frame:any)=>void;reject:(error:Error)=>void;timer:NodeJS.Timeout;}

// Raw stdio harness for transport-level tests that the SDK Client cannot express
// (for example a single request line larger than the transport limit).
export function startStdioServer():StdioServer{
 const child=spawn(process.execPath,["--import","tsx",resolve("src/mcp/server.ts")],{stdio:["pipe","pipe","pipe"]});
 let stdoutText="";let stderrText="";let pending="";
 const frames:any[]=[];const invalid:string[]=[];const waiters:Waiter[]=[];
 const deliver=(frame:any)=>{
  const at=waiters.findIndex(waiter=>waiter.predicate(frame));
  if(at===-1){frames.push(frame);return;}
  const waiter=waiters.splice(at,1)[0]!;
  clearTimeout(waiter.timer);waiter.resolve(frame);
 };
 child.stdout.setEncoding("utf8");
 child.stdout.on("data",(chunk:string)=>{
  stdoutText+=chunk;pending+=chunk;
  let index=0;
  while((index=pending.indexOf("\n"))!==-1){
   const line=pending.slice(0,index);pending=pending.slice(index+1);
   if(line.trim()==="")continue;
   try{deliver(JSON.parse(line));}catch{invalid.push(line);}
  }
 });
 child.stderr.setEncoding("utf8");
 child.stderr.on("data",(chunk:string)=>{stderrText+=chunk;});
 child.stdin.on("error",()=>{});child.on("error",()=>{});
 const nextFrame=(predicate:(frame:any)=>boolean=()=>true,timeoutMs=20_000)=>new Promise<any>((resolveFrame,rejectFrame)=>{
  const at=frames.findIndex(predicate);
  if(at!==-1){resolveFrame(frames.splice(at,1)[0]);return;}
  const waiter:Waiter={predicate,resolve:resolveFrame,reject:rejectFrame,timer:setTimeout(()=>{
   const index=waiters.indexOf(waiter);
   if(index!==-1)waiters.splice(index,1);
   rejectFrame(new Error(`timed out after ${timeoutMs} ms waiting for a JSON-RPC frame; stderr=${JSON.stringify(stderrText.slice(-2000))}`));
  },timeoutMs)};
  waiters.push(waiter);
 });
 const close=(timeoutMs=10_000)=>new Promise<{code:number|null;signal:NodeJS.Signals|null}>(resolveClose=>{
  if(child.exitCode!==null||child.signalCode!==null){resolveClose({code:child.exitCode,signal:child.signalCode});return;}
  const timer=setTimeout(()=>{child.kill("SIGKILL");},timeoutMs);
  child.once("close",(code,signal)=>{clearTimeout(timer);resolveClose({code,signal});});
  if(!child.stdin.writableEnded)child.stdin.end();
 });
 return {
  child,
  stderr:()=>stderrText,
  stdout:()=>stdoutText,
  invalidFrames:()=>invalid,
  write:chunk=>{child.stdin.write(chunk);},
  nextFrame,
  close,
  kill:()=>{if(child.exitCode===null&&child.signalCode===null)child.kill();},
 };
}