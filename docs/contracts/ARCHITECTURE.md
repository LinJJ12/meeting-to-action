# Architecture

## Implemented layers

Meeting-to-Action is one TypeScript package, with a portable Skill and a separately bundled local plugin. It is not a multi-package workspace.

| Location | Responsibility |
|---|---|
| `src/domain/schema.ts` | Authoritative versioned Zod contracts |
| `src/core/` | Normalize, split, prompt, ingest analysis and validate evidence |
| `src/render/markdown.ts` | Render escaped Markdown with evidence references |
| `src/providers/` | Optional standalone OpenAI-compatible model adapter |
| `src/cli.ts` | File-based inspect, report and analyze commands |
| `src/mcp/` | Five stateless stdio tools around Core |
| `src/integrations/setup.ts`, `src/setup.ts` | Project-local Skill/MCP installer and entrypoint |
| `skills/meeting-to-action/` | Host analysis workflow and generated schema |
| `plugin/`, `scripts/build-plugin.mjs` | Local plugin metadata and standalone bundle builder |

## Data flow

```text
Transcript -> normalize -> MeetingInput
                              |
                  Host assistant + Skill
                  (or optional Provider)
                              |
                       MeetingAnalysis
                              |
                Schema + identity + evidence checks
                              |
                       Markdown report
```

CLI handles local file input/output. MCP accepts inline JSON and returns data; the host reads files, interprets content and saves reports. The MCP process does not call a model. Its five tools are documented in [MCP.md](../guides/MCP.md).

`split_transcript` preserves original source coordinates for bounded host analysis. It does not implement automatic chunked model calls in standalone `analyze`.

## Packaging

`npm run build` compiles runtime entrypoints into `dist/`. `npm run plugin:build` separately bundles the MCP server and copies the canonical Skill into `dist/plugin-marketplace/`. Generated output is not source and is ignored by Git. Project installations reference absolute runtime paths; plugin installations use their bundled server. See [project setup](../guides/CLIENT-SETUP.md) and [plugin setup](../guides/PLUGIN-INSTALL.md).

## Trust boundaries and future scope

Treat transcripts and retrieved content as untrusted data. Contract and quote checks establish traceability, not semantic truth or speaker identity. Raw transcript processing in Core is local; optional providers and host models may send content remotely. See [security](SECURITY.md) and [data contracts](DATA-SCHEMA.md).

GitHub search/write adapters, historical persistence, document integrations and new report reading modes are future work. They are not current MCP tools or packages. See [roadmap](../design/ROADMAP.md).
