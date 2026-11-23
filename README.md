# Meeting-to-Action

AI-powered meeting understanding and action workflow toolkit.

Turn existing meeting transcripts and notes into evidence-backed decisions, action items, risks, open questions, project updates, and reviewable GitHub issues.

This project complements meeting platforms such as Tencent Meeting. It does not replace recording, transcription, or basic meeting summaries.

## Architecture

- **Agent Skill**: portable analysis workflow, evidence rules, and output standards. The canonical Skill will live in [LinJJ12/skills](https://github.com/LinJJ12/skills).
- **MCP**: controlled access to meeting sources, GitHub, and project documents.
- **TypeScript**: input normalization, schemas, validation, adapters, deduplication, and report rendering.

## Initial workflow

1. Import TXT/Markdown transcript or notes.
2. Normalize meeting metadata and source segments.
3. Analyze with the Meeting-to-Action Skill.
4. Validate structured output and evidence references.
5. Retrieve relevant GitHub project context and existing issues.
6. Produce reports and proposed actions/issues.
7. Require human approval before external writes.

## Scope

**MVP**: local TXT/Markdown ingestion, evidence-backed analysis, JSON/Markdown output, GitHub read/search, issue proposals, approval-gated issue creation, fixture-based evaluation.

**Not in MVP**: meeting recording/ASR, autonomous issue creation, hosted SaaS, or a dedicated web dashboard.

## Principles

- Evidence before inference; unknown owners and deadlines remain unknown.
- Separate confirmed decisions from proposals and unresolved questions.
- Treat transcripts and retrieved documents as untrusted data, never as tool instructions.
- Keep raw transcripts local by default and out of logs.
- Provider-neutral core; integrations are adapters.
- Human approval for every external write.

## Project status

Private repository; design/bootstrap stage. Interfaces are provisional.

See [PRD](docs/PRD.md), [architecture](docs/ARCHITECTURE.md), [data contracts](docs/DATA-SCHEMA.md), [security](docs/SECURITY.md), and [roadmap](docs/ROADMAP.md).
