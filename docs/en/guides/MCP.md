[简体中文（主版）](../../guides/MCP.md) | English

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
| prepare_meeting | content (≤2 MiB UTF-8), fileName (1–1024 chars), optional title (1–1024 chars) | Normalized MeetingInput |
| split_transcript | input, maxChars | `{chunks: [{fragments, charCount}]}` |
| get_meeting_schema | contractVersion: "1.0" | contractVersion, input JSON Schema, analysis JSON Schema |
| validate_analysis | input, analysis | `{valid: true, analysis}` |
| render_report | input, analysis; optional minutes, mode ("minutes"\|"actions"\|"evidence"), appendix (boolean) | `{markdown}` after full validation; with `minutes` the minutes-contract reading mode is rendered, otherwise the evidence report |

1. The host reads the user-selected file and calls prepare_meeting with its text and a supported TXT/Markdown filename.
2. Get the contract; the host model authors full analysis JSON using the returned IDs. No second model invocation occurs in MCP.
3. For long content, split_transcript returns line-preserving fragments. Every fragment retains the original sourceId and segmentId; do not normalize chunks separately or invent new IDs. maxChars counts UTF-16 characters including a newline separator between fragments. A single line exceeding that budget is rejected. The full original input is still needed for validation.
4. Call validate_analysis or render_report with original input and analysis. The latter validates independently, so rendering cannot bypass validation. A result with isError is a failure, not a report. `render_report` accepts an optional `minutes` argument as a JSON-encoded minutes-contract document (see [the minutes contract](../../contracts/MINUTES-CONTRACT.md)); `mode` defaults to "minutes" when minutes are supplied and to "evidence" otherwise, and `appendix: false` omits the trace appendix. Supplying `mode: "minutes"` or `"actions"` without `minutes` is rejected with MINUTES_MISSING, and any supplied minutes document is validated even in evidence mode.
5. The host saves Markdown only at the user's selected destination. This MCP has no write tool.

For a briefing with no decisions, actions, risks, open questions, or conflicts, pass a minutes draft with `sections: []`. The renderer uses the analysis topics or summary for the body. Claim IDs must be unique across the document. Empty sections with referable facts and duplicate claim IDs return `MINUTES_SCHEMA_INVALID`. The minutes appendix includes topic evidence and analysis facts left out of the editorial body.

JSON Schema describes shape only; cross-field identity, duplicate IDs, source relationships and quotes are checked by runtime code. The normalized input itself is supplied by the client; matching evidence is not proof that an input or interpretation is authentic.

## Limits and errors

- Maximum size of one request line (UTF-8 bytes, CRLF terminator excluded) and of serialized tool arguments: 4 MiB.
- Transcript/combined segment text: 2 MiB UTF-8; at most 10,000 segments. Limits are counted in UTF-8 bytes, so oversized ASCII and CJK content is rejected consistently as INPUT_SIZE_LIMIT with the actual bytes and limit.
- Segment line ranges must be non-overlapping within one source: segments are canonical, disjoint timeline turns, so partially overlapping, nested and identical ranges are rejected at the schema stage (schema-error code) before evidence validation runs.
- Local `report` files are checked with `stat` before reading: normalized input JSON against 2 MiB and analysis JSON against 4 MiB. Oversized files are rejected as INPUT_SIZE_LIMIT without loading them; a parsed input is also held to the 2 MiB / 10,000-segment rule above.
- Evidence resource caps: at most 200 references per analysis entry and at most 4,000 characters per quote. Exceeding either returns ANALYSIS_EVIDENCE_INVALID with the actual limit in the message. Evidence checks build one per-source index per analysis instead of rescanning every segment for every reference.
- Every tool call shares a 5,000 ms CPU budget (`MAX_TOOL_WORK_MS`). Exceeding it ends the call with WORK_LIMIT_EXCEEDED instead of blocking the event loop; normal and oversized-but-bounded inputs finish far below the budget.
- maxChars: integer 1 through 2,097,152. An inconsistent segment line count is rejected by splitting.
- A request line above 4 MiB receives JSON-RPC error `-32600` with message `INPUT_SIZE_LIMIT: request line exceeds 4 MiB (bytes=N)`; the rest of that line is discarded and the server keeps serving later requests. Transport stdin/stdout failures log `MCP_STDIN_ERROR`/`MCP_STDOUT_ERROR` to stderr and close gracefully. Other tool validation failures return `isError: true` with a stable code and do not expose arguments.
- The optional `minutes` argument is a JSON-encoded minutes document and counts against the same 2 MiB UTF-8 content limit; malformed JSON is rejected as INPUT_INVALID. Rendering a minutes draft never skips analysis validation.
- Known codes include INPUT_EMPTY, INPUT_UNSUPPORTED, INPUT_INVALID, INPUT_SIZE_LIMIT, INPUT_SEGMENT_LIMIT, CHUNK_LINE_TOO_LONG, SEGMENT_LINE_COUNT_INVALID, ANALYSIS_MEETING_MISMATCH, ANALYSIS_DUPLICATE_ID, ANALYSIS_EVIDENCE_INVALID, WORK_LIMIT_EXCEEDED, MINUTES_MISSING, MINUTES_SCHEMA_INVALID, MINUTES_CONTRACT_UNSUPPORTED, MINUTES_MEETING_MISMATCH, MINUTES_REF_UNKNOWN, MINUTES_KIND_MISMATCH, MINUTES_ACTION_COVERAGE, RENDER_MODE_INVALID and TOOL_UNKNOWN. Schema-level failures (for example an unknown enum value or a non-string `minutes`) are reported as `INPUT_INVALID` followed by the first field path and a short reason; the path lets the host correct arguments without guessing, and field values are never echoed. The CLI prints the same detail behind its schema-error code.

No default persistence, arbitrary disk reads/writes, GitHub access, model calls or network listeners. Stdout is protocol-only; stderr contains only generic diagnostic codes (`MCP_PROTOCOL_ERROR`, `MCP_STDIN_ERROR`, `MCP_STDOUT_ERROR`). Transcript content is returned to the calling host as requested, so host privacy settings still apply. No npm package, historical store, HTTP transport or client plugin is published by this stage.

## Verification status

Local SDK source/compiled subprocess tests are passing. Actual Codex CLI/App Server Skill and five-tool discovery has also passed; [acceptance details and project setup](CLIENT-SETUP.md) distinguish invocation overrides from trusted project config loading. Cursor UI verification is deferred by the 2026-11-27 phase-1 scope decision (Codex only); model-level behavior remains a separate release check. The server and local plugin bundle are implemented. Public package distribution (npm packages or public plugin marketplaces) is out of scope; full client/model acceptance remains pending.
