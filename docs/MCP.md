# Local stdio MCP

This checkout provides five stateless tools using the official [TypeScript MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x). Node.js 20+ is required. No model credentials or server deployment are needed. This MCP does not call the standalone provider.

## Build and verify

```sh
npm ci
npm run typecheck
npm test
npm run mcp:smoke
```

The smoke command builds the runtime and launches `dist/mcp/server.js` with the SDK client, discovers all five tools and exercises the full workflow including rejection. It does not alter client configuration or call a model. Use `node /absolute/path/to/meeting-to-action/dist/mcp/server.js` as the client subprocess command. Running it directly waits for protocol input; it is not an interactive CLI.

Avoid using `npm run mcp` as a client command: npm may print banners to stdout. Launch Node directly. Development-only entrypoint: `npm run mcp:dev`.

## Client configuration examples

These are examples, not an assertion that this checkout has been enabled in the user's clients. Replace the absolute runtime path. If Node is not on the client's PATH, use its actual executable path. No shell, npx download or credentials are needed.

Codex MCP configuration entry:

```toml
[mcp_servers.meeting_to_action]
command = "node"
args = ["C:/path/to/meeting-to-action/dist/mcp/server.js"]
```

Cursor project `.cursor/mcp.json` entry:

```json
{
  "mcpServers": {
    "meeting-to-action": {
      "command": "node",
      "args": ["C:/path/to/meeting-to-action/dist/mcp/server.js"]
    }
  }
}
```

Merge entries with existing configuration rather than replace it. Follow the current [Codex MCP documentation](https://developers.openai.com/codex/mcp) and [Cursor MCP documentation](https://cursor.com/docs/mcp) for your installed client. Record client/version and confirm five discovered tools before claiming client compatibility. These manual examples do not themselves change user-wide settings. Plugin registration is a separate installation method described in [PLUGIN-INSTALL.md](PLUGIN-INSTALL.md).

## Tools and flow

All arguments are inline JSON, not filesystem paths. Objects reject unknown fields.

| Tool | Arguments | Result in JSON text |
|---|---|---|
| prepare_meeting | content, fileName, optional title | Normalized MeetingInput |
| split_transcript | input, maxChars | `{chunks: [{fragments, charCount}]}` |
| get_meeting_schema | contractVersion: "1.0" | contractVersion, input JSON Schema, analysis JSON Schema |
| validate_analysis | input, analysis | `{valid: true, analysis}` |
| render_report | input, analysis; optional minutes, mode ("minutes"\|"actions"\|"evidence"), appendix (boolean) | `{markdown}` after full validation; with `minutes` the minutes-contract reading mode is rendered, otherwise the evidence report |

1. The host reads the user-selected file and calls prepare_meeting with its text and a supported TXT/Markdown filename.
2. Get the contract; the host model authors full analysis JSON using the returned IDs. No second model invocation occurs in MCP.
3. For long content, split_transcript returns line-preserving fragments. Every fragment retains the original sourceId and segmentId; do not normalize chunks separately or invent new IDs. maxChars counts UTF-16 characters including a newline separator between fragments. A single line exceeding that budget is rejected. The full original input is still needed for validation.
4. Call validate_analysis or render_report with original input and analysis. The latter validates independently, so rendering cannot bypass validation. A result with isError is a failure, not a report. `render_report` accepts an optional `minutes` argument as a JSON-encoded minutes-contract document (see [the minutes contract](MINUTES-CONTRACT.md)); `mode` defaults to "minutes" when minutes are supplied and to "evidence" otherwise, and `appendix: false` omits the trace appendix. Supplying `mode: "minutes"` or `"actions"` without `minutes` is rejected with MINUTES_MISSING, and any supplied minutes document is validated even in evidence mode.
5. The host saves Markdown only at the user's selected destination. This MCP has no write tool.

JSON Schema describes shape only; cross-field identity, duplicate IDs, source relationships and quotes are checked by runtime code. The normalized input itself is supplied by the client; matching evidence is not proof that an input or interpretation is authentic.

## Limits and errors

- Maximum raw transport read buffer and serialized tool arguments: 4 MiB.
- Transcript/combined segment text: 2 MiB UTF-8; at most 10,000 segments. Limits are counted in UTF-8 bytes, so oversized ASCII and CJK content is rejected consistently as INPUT_SIZE_LIMIT with the actual bytes and limit.
- maxChars: integer 1 through 2,097,152. An inconsistent segment line count is rejected by splitting.
- Oversized transport input closes the connection. Other tool validation failures return `isError: true` with a stable code and do not expose arguments.
- The optional `minutes` argument is a JSON-encoded minutes document and counts against the same 2 MiB UTF-8 content limit; malformed JSON is rejected as INPUT_INVALID. Rendering a minutes draft never skips analysis validation.
- Known codes include INPUT_INVALID, INPUT_SIZE_LIMIT, INPUT_SEGMENT_LIMIT, CHUNK_LINE_TOO_LONG, SEGMENT_LINE_COUNT_INVALID, ANALYSIS_MEETING_MISMATCH, ANALYSIS_DUPLICATE_ID, ANALYSIS_EVIDENCE_INVALID, MINUTES_MISSING, MINUTES_SCHEMA_INVALID, MINUTES_CONTRACT_UNSUPPORTED, MINUTES_MEETING_MISMATCH, MINUTES_REF_UNKNOWN, MINUTES_KIND_MISMATCH, MINUTES_ACTION_COVERAGE, RENDER_MODE_INVALID and TOOL_UNKNOWN. Schema-level failures (for example an unknown enum value or a non-string `minutes`) are reported as INPUT_INVALID.

No default persistence, arbitrary disk reads/writes, GitHub access, model calls or network listeners. Stdout is protocol-only; stderr contains only a generic protocol error code. Transcript content is returned to the calling host as requested, so host privacy settings still apply. No npm package, historical store, HTTP transport or client plugin is published by this stage.

## Verification status

Local SDK source/compiled subprocess tests are passing. Actual Codex CLI/App Server Skill and five-tool discovery has also passed; [acceptance details and project setup](CLIENT-SETUP.md) distinguish invocation overrides from trusted project config loading. Cursor UI and model-level behavior remain separate release checks. The server and local plugin bundle are implemented. Public package distribution and full client/model acceptance remain pending.
