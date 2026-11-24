import {it,expect} from "vitest";
import {resolve} from "node:path";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";

it("negotiates stdio, lists tools, processes content and recovers from rejected input",async()=>{
 const client=new Client({name:"meeting-test",version:"1.0.0"});
 const transport=new StdioClientTransport({command:process.execPath,args:["--import","tsx",resolve("src/mcp/server.ts")],stderr:"pipe"});
 let stderr="";transport.stderr?.on("data",chunk=>{stderr+=String(chunk);});
 try{
  await client.connect(transport);
  expect((await client.listTools()).tools.map(t=>t.name).sort()).toEqual(["get_meeting_schema","prepare_meeting","render_report","split_transcript","validate_analysis"]);
  const response=await client.callTool({name:"prepare_meeting",arguments:{fileName:"x.txt",content:"private transcript"}});
  expect(response.isError).not.toBe(true);
  const items=response.content as {type:string;text:string}[];
  const input=JSON.parse(items[0]!.text);expect(input.segments[0].text).toBe("private transcript");
  const bad=await client.callTool({name:"prepare_meeting",arguments:{fileName:"x.txt",content:"PRIVATE",unknown:true}});
  expect(bad.isError).toBe(true);expect(JSON.stringify(bad)).not.toContain("PRIVATE");
  expect((await client.callTool({name:"split_transcript",arguments:{input,maxChars:100}})).isError).not.toBe(true);
  expect((await client.callTool({name:"get_meeting_schema",arguments:{contractVersion:"1.0"}})).isError).not.toBe(true);
 }finally{await client.close();}
 expect(stderr).toBe("");
},15_000);

import {spawn} from "node:child_process";
import {MAX_REQUEST_BYTES} from "../src/mcp/tools.js";
it("closes oversized transport input with redacted diagnostics",async()=>{
 const child=spawn(process.execPath,["--import","tsx",resolve("src/mcp/server.ts")],{stdio:["pipe","pipe","pipe"]});
 let stderr="",stdout="";
 child.stderr.on("data",c=>{stderr+=String(c);});child.stdout.on("data",c=>{stdout+=String(c);});
 child.stdin.on("error",()=>{});
 const closed=new Promise<void>((resolve,reject)=>{child.once("close",()=>resolve());child.once("error",reject);});
 const timeout=setTimeout(()=>child.kill(),5000);
 try{
  child.stdin.end("PRIVATE_TRANSCRIPT"+"x".repeat(MAX_REQUEST_BYTES));
  await closed;
  expect(stderr).toContain("MCP_PROTOCOL_ERROR");
  expect(stderr).not.toContain("PRIVATE_TRANSCRIPT");expect(stdout).toBe("");
 }finally{clearTimeout(timeout);if(child.exitCode===null)child.kill();}
},10_000);
