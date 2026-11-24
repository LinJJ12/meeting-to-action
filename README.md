# Meeting-to-Action

Evidence-backed meeting analysis and action workflow toolkit.

This project transforms existing meeting transcripts and notes into structured, traceable work products. It complements meeting platforms; it does not record meetings or perform speech recognition.

## Current capabilities

- TXT / Markdown transcript normalization with SHA-256 source checksums and line-based segments.
- Versioned Zod schemas for meeting input and analysis output.
- Model-neutral analysis provider interface.
- OpenAI-compatible chat completions provider.
- Skill-guided analysis prompt for topics, decisions, action items, risks, conflicts, and open questions.
- Strict output schema validation and evidence-reference validation.
- Markdown report rendering and local CLI.
- Unit tests and GitHub Actions CI for Node.js 20 and 22.

## Quick start

Requires Node.js 20+.

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Inspect a transcript without calling a model:

```bash
npm run dev -- inspect examples/sample-meeting.md
```

Run model-assisted analysis (the CLI loads a local `.env` file when present):

```bash
cp .env.example .env
# Edit .env and set OPENAI_API_KEY and OPENAI_MODEL
npm run dev -- analyze examples/sample-meeting.md --out report.md
```

Alternatively, set the variables directly in your shell or CI secret store.

PowerShell:

```powershell
$env:OPENAI_API_KEY = "your-api-key"
$env:OPENAI_MODEL = "your-model"
$env:OPENAI_BASE_URL = "https://api.openai.com/v1"
npm run dev -- analyze examples/sample-meeting.md --out report.md
```

The CLI never overwrites an existing output file. Keep API keys in environment variables or a local secrets manager; do not commit them.

## Analysis safety and limitations

- The model receives transcript content as untrusted data, never as executable instructions.
- Material extracted items must cite exact source segments and line ranges.
- Evidence references are checked against the original normalized transcript; invented segment IDs, mismatched line ranges, and non-verbatim quotes are rejected.
- Owners and deadlines remain absent unless the transcript explicitly supports them.
- A model response is a draft for human review, not an authoritative record.
- The current OpenAI-compatible adapter uses Chat Completions JSON mode. Provider-specific differences may require an adapter.
- No GitHub issue is created automatically. External writes remain a later, approval-gated capability.

## Architecture

- **Skill**: portable analysis workflow, evidence standards, and human-review gates. Canonical source: [skills/meeting-to-action](skills/meeting-to-action/SKILL.md) in this repository.
- **Provider**: model-neutral `AnalysisProvider` interface with an OpenAI-compatible implementation.
- **TypeScript core**: normalization, contracts, prompt construction, analysis validation, evidence checks, and rendering.
- **MCP**: planned integration for project context and approval-gated GitHub issue creation.

## Principles

- Evidence before inference.
- Unknown owners and deadlines remain unknown.
- Meeting content is untrusted data, not instructions.
- Human approval before external writes.
- Provider-neutral core and adapter-based integrations.

See [PRD](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), [data schema](docs/DATA-SCHEMA.md), [security](docs/SECURITY.md), and [roadmap](docs/ROADMAP.md).

Reports preserve evidence references and escape source Markdown/HTML. See the runtime validation limitations in [data contracts](docs/DATA-SCHEMA.md).


## Use with an AI coding assistant (no extra API key)

The implementation and release plan is [Agent toolkit architecture](docs/AGENT-TOOLKIT.md). Skill source is [skills/meeting-to-action](skills/meeting-to-action/SKILL.md) in this repository; it is not a published MCP package.

```sh
npm run dev -- inspect examples/sample-meeting.md --out normalized.json
# Ask your coding assistant to author analysis.json using the normalized IDs
# and the full MeetingAnalysisSchema in src/domain/schema.ts.
npm run dev -- report normalized.json --analysis analysis.json --out report.md
```

`report` validates the meeting identity, schema, duplicate item IDs and every claim's evidence before rendering. It makes no model/API call. `analyze` remains the optional standalone provider mode. Source matching does not prove that an interpretation is correct; review the result before acting on it.

## Install the bundled Skill

The canonical Skill, runtime and future MCP are maintained together in this repository. Copy the entire `skills/meeting-to-action` folder into your target project's Skill directory. Do not copy just SKILL.md: its references and schema are required.

PowerShell examples (run from this checkout; replace the target path):

```powershell
# Codex: install into the target project
New-Item -ItemType Directory -Force 'C:\path\to\project\.agents\skills' | Out-Null
Copy-Item -LiteralPath '.\skills\meeting-to-action' -Destination 'C:\path\to\project\.agents\skills\meeting-to-action' -Recurse
# Cursor: use .cursor\skills instead of .agents\skills
```

Use an empty destination; compare existing installations before replacing them. No user-wide configuration is changed by these instructions. Discovery locations are documented by [OpenAI](https://learn.chatgpt.com/docs/customization/overview) and [Cursor](https://cursor.com/docs/skills); actual discovery depends on the client version and remains to be smoke-tested.

In Codex, request: `Use $meeting-to-action to analyze meeting.md, preserve evidence and generate a Markdown report. Do not create GitHub issues.` In other assistants, explicitly ask it to read the installed SKILL.md if discovery is unavailable. The Skill works without MCP or the Core checkout by producing a cited Markdown draft; that fallback is not programmatically validated.

With this runtime available, use the inspect/report flow above for strict schema and evidence validation. Tell the assistant the runtime checkout path when it differs from the meeting project. No extra model key is needed; the optional `analyze` provider mode remains separate.

For maintainers: run `npm run skill:schema` after contract changes, then `npm test` to verify the bundled schema still matches Core. The behavior rubric and synthetic edge-case fixture are linked from the Skill.
