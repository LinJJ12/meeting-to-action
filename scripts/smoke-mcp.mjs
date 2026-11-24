import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";
const fixture=async name=>JSON.parse(await readFile(new URL("../examples/agent-workflow/"+name,import.meta.url),"utf8"));
const input=await fixture("normalized.json"),analysis=await fixture("analysis.json");
const client=new Client({name:"meeting-smoke",version:"1.0.0"});
const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL("../dist/mcp/server.js",import.meta.url))],stderr:"pipe"});
let stderr="";transport.stderr?.on("data",chunk=>{stderr+=String(chunk);});
const call=async(name,args)=>{
 const result=await client.callTool({name,arguments:args});
 assert.notEqual(result.isError,true);
 return JSON.parse(result.content[0].text);
};
try{
 await client.connect(transport);
 assert.equal((await client.listTools()).tools.length,5);
 const prepared=await call("prepare_meeting",{content:"Team: review.",fileName:"x.txt"});
 assert.equal(prepared.segments[0].text,"Team: review.");
 assert.equal((await call("get_meeting_schema",{contractVersion:"1.0"})).contractVersion,"1.0");
 assert.ok((await call("split_transcript",{input,maxChars:500})).chunks.length>0);
 assert.equal((await call("validate_analysis",{input,analysis})).valid,true);
 assert.match((await call("render_report",{input,analysis})).markdown,/Evidence:/);
 const bad=await client.callTool({name:"render_report",arguments:{input,analysis:{...analysis,meetingId:"wrong"}}});
 assert.equal(bad.isError,true);
}finally{await client.close();}
assert.equal(stderr,"");
console.log("Compiled stdio smoke passed: five tools, validation failure, clean stderr.");
