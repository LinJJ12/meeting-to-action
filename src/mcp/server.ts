import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {CallToolRequestSchema,ListToolsRequestSchema} from "@modelcontextprotocol/sdk/types.js";
import {callTool,toolList,MAX_REQUEST_BYTES} from "./tools.js";

const server=new Server({name:"meeting-to-action",version:"0.2.0"},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:toolList}));
server.setRequestHandler(CallToolRequestSchema,async(request)=>callTool(request.params.name,request.params.arguments??{}));
// Protocol only on stdout. Never print payloads or transport errors containing source text.
server.onerror=()=>{console.error("MCP_PROTOCOL_ERROR");};
await server.connect(new StdioServerTransport(process.stdin,process.stdout,{maxBufferSize:MAX_REQUEST_BYTES}));
