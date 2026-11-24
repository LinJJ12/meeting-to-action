# Agent toolkit architecture and delivery plan

Status: implementation baseline, 2026-11-24. Contract: `analysis-schema@1.0`.

## Product and boundaries

Meeting-to-Action turns supplied meeting transcripts into evidence-backed draft decisions and work items inside an AI coding assistant. The first delivery uses the host assistant's model. No second API key, server deployment, web UI, account system, automatic issue creation, or remote MCP is needed for this mode.

| Layer | Owns | Does not own |
|---|---|---|
| Skill | Interpretation, uncertainty handling, review workflow | Deterministic validation or credentials |
| Core | Normalization, versioned contracts, evidence checks, rendering | Client UI or implicit external approval |
| CLI | Local file input/output around Core | Semantic analysis without a host or configured provider |
| MCP (planned) | Thin stdio tools around the same Core | A second model call in Agent mode |
| Provider (optional) | Explicit standalone model analysis | Default Agent workflow |

Two modes share contracts: Agent mode authors JSON using Codex/Cursor's model; standalone `analyze` uses the existing configured provider. Local processing does not mean the host model runs offline: transcript privacy also depends on the chosen assistant and its settings.

## Current verified baseline

Core PR #3 is merged remotely and integrated locally. Skill PR #4 is open at `LinJJ12/skills`, path `skills/meeting-to-action/SKILL.md`. Keep that repository as the sole Skill authority; do not maintain a second independent Skill in this runtime repository. No npm MCP package or plugin has been published.

Runtime modules:

- `domain/schema.ts`: authoritative Zod contracts.
- `core/normalize.ts`: original checksum and stable line/segment references.
- `core/evidence.ts`: source/segment, bounds and verbatim quote checks.
- `core/analysis.ts`: full externally authored analysis ingestion, meeting identity and duplicate ID checks.
- `core/analyze.ts`, `core/prompt.ts`, `providers/`: optional standalone engine.
- `render/markdown.ts`: escaped Markdown with traceable citations.
- `cli.ts`: local inspect, report and optional analyze workflows.

## Agent workflow available locally

From the runtime checkout after `npm ci`:

```sh
npm run dev -- inspect examples/sample-meeting.md --out normalized.json
# The host assistant reads normalized.json and authors analysis.json.
npm run dev -- report normalized.json --analysis analysis.json --out report.md
```

The assistant must preserve `schemaVersion: "1.0"` and the exact `meetingId`, supply an ISO UTC `generatedAt`, and include all contract arrays (empty when nothing was extracted). Material items require nonempty evidence arrays. Use actual source and segment IDs, paired line bounds and exact short quotes. Do not infer ownership from speaker labels or invent dates. Unsupported interpretations remain questions or explicitly labeled suggestions, outside factual claims. Summary prose currently has no citation field; human review remains necessary.

The report command rejects malformed/schema-invalid JSON, mismatched meetings, duplicate item IDs within a category and invalid evidence, before opening output. Outputs use exclusive creation. Validation proves traceability and contract conformance, not semantic truth, source authenticity or correctness of owner/date interpretations.

## Skill productization in the canonical repository

Extend PR #4 rather than duplicating it here:

1. Keep one `meeting-to-action` Skill, with analysis, historical comparison and issue-draft modes. Load history only when supplied/authorized; absence of history must not imply no previous decisions.
2. Add conditional references for analysis/evidence rules and `analysis-schema@1.0`. Preserve instructions for unknown owners/dates and transcript prompt injection.
3. With Core available, use inspect -> host-authored JSON -> report. If neither CLI nor MCP exists, produce a human-readable report with source/line citations and explicitly state that programmatic validation was not performed. Do not invent IDs or pretend tools ran.
4. Long transcripts: inventory files/line ranges, process bounded sections, retain global source locations, reconcile contradictions and duplicate tasks across sections, and declare unread ranges. Never silently truncate.
5. Issue mode produces reviewable drafts only. Search through an already installed GitHub connector when authorized. External writes require the exact target and content approved by the user.
6. Add synthetic fixtures covering ambiguous owners, relative deadlines, contradictions and embedded instructions. Use real meeting content only with explicit permission to distribute it.

Installation target: copy the canonical folder, not this runtime checkout. Codex project path is `.agents/skills/meeting-to-action/`; Cursor's documented native project path is `.cursor/skills/meeting-to-action/`. Keep identical Skill contents and test discovery separately rather than assume every client version shares directories. Preserve automatic discovery; explicit invocation remains available. Do not automatically edit user-wide configuration.

References checked 2026-11-24: [OpenAI customization](https://learn.chatgpt.com/docs/customization/overview), [Cursor Skills](https://cursor.com/docs/skills). Actual client installation/discovery is a release gate, not something proven by unit tests.

## MCP v0.2 interface proposal (not implemented)

Use the stable official TypeScript SDK and stdio. Stdout carries protocol messages only. No secrets or raw meeting text in diagnostics. Initial tools accept inline data; no arbitrary filesystem read tool is required.

| Tool | Input | Output / validation |
|---|---|---|
| `prepare_meeting` | `{content: string, fileName: string, title?: string}` | `MeetingInputSchema` |
| `split_transcript` | `{input: MeetingInput, maxChars: positive integer}` | Ordered chunks with original segment IDs and source line ranges |
| `get_meeting_schema` | `{contractVersion: "1.0"}` | Generated JSON Schemas for input and full analysis |
| `validate_analysis` | `{input: MeetingInput, analysis: unknown}` | Validated full analysis, or stable error codes |
| `render_report` | `{input: MeetingInput, analysis: unknown}` | Markdown only after the same full validation |

JSON Schemas must be generated from Zod, not hand-maintained. Tool argument objects reject unknown fields. Use bounded request sizes; proposed initial limits: 2 MiB UTF-8 content and 10,000 segments, explicitly tested before release. Splitting must preserve evidence coordinates, split oversized segments on line boundaries, and explicitly reject an oversized single line until a column-aware contract exists. Chunk output is not a source rewrite.

No default persistence/network access or model calls. If later adding path-based tools, require explicit workspace roots and reject traversal, symlink/junction escapes and unauthorized paths. Future writes use separate tools; a boolean `approved` supplied by a model is insufficient authorization.

## Versions and releases

Core owns contract versions and fixtures. Skill declares supported contract version plus a tested Core commit/release. Export schema and fixture artifacts for the Skill repository; compare compatibility locally before tagging either release. Breaking contract changes require a new schema version and explicit migration. Skill content must still work without Core installed.

Keep the existing runtime private until package names, bin entrypoints and packaged file contents are verified. Future client MCP configuration should reference a real released package, never a placeholder that users might execute. Pin releases for reproducibility. Do not automate Actions-based packaging while quota is exhausted; use local checks and manual release artifacts.

## Milestones and acceptance

| Stage | Deliverable | Required evidence |
|---|---|---|
| 1 | Skill v0.1 productization | Canonical PR reviewed; frontmatter validation; no-MCP transcript demo in Codex and Cursor; unknown owner/date and injection rubric; copy/install instructions |
| 1a | Core Agent workflow | inspect/report CLI integration tests; fabricated evidence and mismatched meeting rejection; output never overwritten; no API credentials needed |
| 2 | MCP v0.2 | Five tools; stdio client roundtrip; invalid payload/size tests; no transcript logs; real Codex and Cursor smoke tests; installable package |
| 3 | Continuity | SQLite schema/migrations, opt-in retention, historical provenance, superseded decisions and action status tests |
| 4 | Distribution | Separately verified client manifests; reproducible package; upgrade/rollback instructions; manual release until CI quota restored |

Do not label a stage complete based solely on code generation. Record actual client versions and observed tool discovery/results. Claude Code and other clients remain compatibility targets until tested. No external write, merge, publish or CI run is implied by this plan.
