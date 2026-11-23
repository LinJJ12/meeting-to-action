# Architecture

## Three layers

1. **Skill** — portable instructions for analysis, evidence standards, and review gates.
2. **MCP integrations** — controlled access to meeting sources, GitHub, and documents.
3. **TypeScript core** — deterministic parsing, normalization, schema validation, evidence mapping, deduplication helpers, and rendering.

The LLM interprets content; code enforces contracts and safety.

## Flow

```text
Transcript -> Source Adapter -> Normalized Input
                                  |
                                  v
                             Agent Skill
                                  |
                                  v
                            Structured Draft
                                  |
                         Schema + Evidence Check
                                  |
                    +-------------+-------------+
                    |                           |
                    v                           v
             Markdown / JSON              MCP Context Retrieval
                                               |
                                         GitHub / Documents
                                               |
                                               v
                                         Candidate Actions
                                               |
                                           Human Review
                                               |
                                       Explicit External Write
```

## Packages

- `core`: normalization, domain logic, evidence resolution, validation, rendering, errors.
- `schemas`: versioned JSON schemas, shared types, fixtures.
- `mcp-server`: MCP server and explicit tool registration.
- `adapters`: transcript, GitHub, and Markdown document adapters.
- `cli` (later): local command-line workflow.

## Candidate MCP tools

- `meeting.list`, `meeting.read`
- `github.search_issues`, `github.get_issue`, `github.create_issue`
- `docs.search`, `docs.write_markdown`

Names are provisional. Keep tools narrow, validate arguments, bound results, and separate read from write capabilities. Write tools require actual client/host confirmation, not an LLM assertion of approval.

## Trust boundaries

Treat transcripts, issue bodies, repository descriptions, and retrieved documents as untrusted data. Never follow embedded instructions. Keep secrets outside source control and prompts. Raw transcripts remain local by default. Use least-privilege integration scopes and avoid sensitive logs.

## Extensibility

Meeting providers and destinations are adapters. The domain model must not assume Tencent Meeting or GitHub-specific fields.
