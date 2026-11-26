import {it,expect} from "vitest";
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";
import {buildPlugin} from "../scripts/build-plugin.mjs";
import {APP_VERSION} from "../src/version.js";
it("ships a relocatable plugin with its Skill and a standalone MCP bundle",async()=>{
 const root=await mkdtemp(join(tmpdir(),"meeting-plugin space-"));
  // 预置一个上一轮的残留文件：重建输出目录时应被清掉
  await mkdir(join(root,"plugins","meeting-to-action"),{recursive:true});
  await writeFile(join(root,"plugins","meeting-to-action","stale-from-previous-build.txt"),"stale");
 const client=new Client({name:"plugin-package-test",version:"1.0.0"});let connected=false;
 try{
  const output=await buildPlugin(root);
  const manifest=JSON.parse(await readFile(join(output.plugin,"plugin.json"),"utf8"));
  expect(manifest.name).toBe("meeting-to-action");
  // 产物清单版本必须来自 src/version.ts（#17：构建盖写，不允许源清单漂移进产物）
  expect(manifest.version).toBe(APP_VERSION);
  const config=JSON.parse(await readFile(join(output.plugin,"mcp.json"),"utf8"));
  const server=config.mcpServers["meeting-to-action"];
  expect(server.type).toBe("stdio");expect(server.args[0]).toBe("${PLUGIN_ROOT}/server/mcp.mjs");
  // command 必须保持裸 `node`：Codex app-server 不启动绝对路径 command（回归见 #24），
  // 产物里出现盘符或路径分隔符会让插件装上了但工具不可见。
  expect(server.command).toBe("node");
  expect(server.command).not.toMatch(/[\\/]|^[A-Za-z]:/);
  expect(await readFile(join(output.plugin,"skills","meeting-to-action","SKILL.md"),"utf8")).toContain("name: meeting-to-action");
  expect(await readFile(join(output.plugin,"THIRD-PARTY-NOTICES.txt"),"utf8")).toContain("@modelcontextprotocol/sdk");
  expect(await readdir(output.plugin)).not.toContain("node_modules");
  expect(await readdir(output.plugin)).not.toContain("stale-from-previous-build.txt");
  const transport=new StdioClientTransport({command:process.execPath,args:[server.args[0].replace("${PLUGIN_ROOT}",output.plugin)],cwd:root,stderr:"pipe"});
  let stderr="";transport.stderr?.on("data",c=>{stderr+=String(c);});
  await client.connect(transport);connected=true;
  expect((await client.listTools()).tools).toHaveLength(5);
  const result=await client.callTool({name:"prepare_meeting",arguments:{content:"Team: review.",fileName:"x.txt"}});
  expect(result.isError).not.toBe(true);expect(JSON.stringify(result)).toContain("Team: review.");
  await client.close();connected=false;expect(stderr).not.toMatch(/transcript|sk-|Bearer/i); // stderr 需保持安静：只断言无敏感回显，容忍无害告警（#19）
 }finally{if(connected)await client.close();await rm(root,{recursive:true,force:true});}
},20_000);
