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

- **Skill**: portable analysis workflow, evidence standards, and human-review gates. Canonical source: [LinJJ12/skills](https://github.com/LinJJ12/skills).
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

