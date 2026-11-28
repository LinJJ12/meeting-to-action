import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { callTool, toolList, MAX_REQUEST_BYTES } from "./tools.js";
import { oversizeLineError, RequestLineGuard } from "./line-guard.js";
import { invalidParamsError, ParamsGuard } from "./params-guard.js";
import { APP_VERSION } from "../version.js";

const server = new Server(
  { name: "meeting-to-action", version: APP_VERSION },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolList }));
server.setRequestHandler(CallToolRequestSchema, async (request) =>
  callTool(request.params.name, request.params.arguments ?? {}),
);
// Protocol only on stdout. Never print payloads or transport errors containing source text.
server.onerror = () => {
  console.error("MCP_PROTOCOL_ERROR");
};
// Enforce the byte limit above the SDK transport: an oversized request line must
// produce an explicit JSON-RPC error instead of a silently closed connection.
const requestLines = new RequestLineGuard({
  limit: MAX_REQUEST_BYTES,
  onOversize: (bytes) => {
    process.stdout.write(oversizeLineError(bytes, MAX_REQUEST_BYTES));
  },
});
// Reject malformed tools/call params with -32602 before the SDK serializes its
// internal schema error as -32603.
const paramsGuard = new ParamsGuard({
  onInvalidParams: (id) => {
    process.stdout.write(invalidParamsError(id));
  },
});
requestLines.pipe(paramsGuard);
const transport = new StdioServerTransport(paramsGuard, process.stdout);
const shutdown = (reason: string) => {
  console.error(reason);
  void transport.close().catch(() => {});
};
// Transport failures are logged generically; source text must never reach stderr.
process.stdin.on("error", () => {
  shutdown("MCP_STDIN_ERROR");
});
process.stdout.on("error", () => {
  shutdown("MCP_STDOUT_ERROR");
});
await server.connect(transport);
process.stdin.pipe(requestLines);
