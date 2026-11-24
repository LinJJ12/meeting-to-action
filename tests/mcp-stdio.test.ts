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

import {MAX_REQUEST_BYTES} from "../src/mcp/tools.js";
import {startStdioServer} from "./stdio-harness.js";
it("rejects oversized transport input with a JSON-RPC error and keeps serving",async()=>{
 const server=startStdioServer();
 try{
  server.write("PRIVATE_TRANSCRIPT"+"x".repeat(MAX_REQUEST_BYTES)+"\n");
  const errorFrame=await server.nextFrame(frame=>frame?.error?.code===-32600,25_000);
  expect(errorFrame.id).toBeNull();
  expect(errorFrame.error.message).toMatch(/^INPUT_SIZE_LIMIT: request line exceeds 4 MiB \(bytes=\d+\)$/);
  expect(server.stdout()).not.toContain("PRIVATE_TRANSCRIPT");
  expect(server.stderr()).not.toContain("PRIVATE_TRANSCRIPT");
  server.write(JSON.stringify({jsonrpc:"2.0",id:2,method:"tools/list"})+"\n");
  const listFrame=await server.nextFrame(frame=>frame?.id===2);
  expect(listFrame.result.tools).toHaveLength(5);
  expect(server.invalidFrames()).toEqual([]);
 }finally{server.kill();}
},20_000);
