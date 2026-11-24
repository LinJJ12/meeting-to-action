# Meeting-to-Action

Evidence-backed meeting analysis and action workflow toolkit.

The project transforms existing meeting transcripts and notes into structured, traceable work products. It complements meeting platforms; it does not record meetings or replace transcription/basic summaries.

## Current status

The local TypeScript foundation is implemented on `feat/local-analysis-mvp`.

- TXT / Markdown transcript normalization with source checksums and line-based segments.
- Versioned Zod schemas for meeting input and analysis output.
- Evidence reference creation and validation.
- Markdown report renderer for structured analysis.
- Local CLI for transcript inspection and normalization.
- Unit tests and a sample meeting fixture.

**Important:** the current CLI normalizes input only. It does not call an LLM or claim to automatically extract decisions/actions. The Agent Skill and model-assisted analysis adapter are the next implementation step.

## Quick start

Requires Node.js 20+.

```bash
npm ci
npm run typecheck
npm test
npm run dev -- inspect examples/sample-meeting.md
```

Write normalized JSON to a new file (existing files are not overwritten):

```bash
npm run dev -- inspect examples/sample-meeting.md --out ./meeting.normalized.json
```

## Architecture

- **Skill**: analysis workflow, evidence standards, and human-review gates. Canonical source: [LinJJ12/skills](https://github.com/LinJJ12/skills).
- **MCP**: future integrations for GitHub and document sources.
- **TypeScript core**: deterministic normalization, schemas, evidence validation, and rendering.

## Principles

- Evidence before inference.
- Unknown owners and deadlines remain unknown.
- Meeting content is untrusted data, not instructions.
- Human approval before external writes.
- Provider-neutral core and adapter-based integrations.

See [PRD](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), [data schema](docs/DATA-SCHEMA.md), [security](docs/SECURITY.md), and [roadmap](docs/ROADMAP.md).

Reports preserve evidence references and escape source Markdown/HTML. See the runtime validation limitations in [data contracts](docs/DATA-SCHEMA.md).
