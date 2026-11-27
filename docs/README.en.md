[简体中文（主版）](../README.md) | English

# Meeting-to-Action

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

**Turn meeting transcripts into traceable decisions, action items, and minutes — with evidence.**

[Contributing](CONTRIBUTING.en.md) · [Security](SECURITY.en.md) · [Code of Conduct](CODE_OF_CONDUCT.en.md) · [Changelog](CHANGELOG.en.md)

Turn existing TXT / Markdown meeting transcripts into traceable topics, decisions, action items, risks, disagreements, and open questions. Ships a portable Skill, five local MCP tools, and an optional standalone CLI analysis mode. No meeting recording or speech recognition is included.

## Choosing a usage mode

| Mode | When to use | Model & credentials |
|---|---|---|
| Local desktop plugin (Skill + MCP) | Codex clients that support a local plugin marketplace | Uses the host assistant model; no extra API key for this tool |
| Project-level Skill + MCP | Installing into a Codex / Cursor project | Uses the host assistant model; client discovery needs separate confirmation |
| Skill only | You only need analysis guidance and citation-backed drafts | Uses the host model; without a runtime there is no programmatic validation |
| CLI `analyze` | Calling a compatible model API without an assistant | You configure the API key, model, and optional service endpoint yourself |

This repository is public source code under the MIT license, and `package.json` stays `private: true`: no npm package or public plugin marketplace is or will be published — installation always goes through cloning this repository, building locally, and the local plugin marketplace. Cloning the repo or building the plugin does not automatically install, register, or enable anything; an install state on another machine never means yours is configured.

## Getting started from source

Requires Node.js 20+ and npm (Node.js 22+ is recommended on Windows for the project-level installer; see [Project-level installation](#project-level-installation) for why). From the repository root:

```sh
npm ci
npm run build
```

### Local desktop plugin

```sh
npm run plugin:build
```

The build outputs a `dist/meeting-to-action-v<version>.tar.gz` single-plugin archive for upload via Codex "create plugin", plus `dist/plugin-marketplace/` for CLI registration. Both contain the Skill, the MCP bundle, and third-party licenses. For installation and verification steps see [local plugin installation and usage](PLUGIN-INSTALL.en.md).

### Project-level installation

Preview first, then apply (the target project must already exist; quote paths containing spaces):

```sh
npm run setup:client -- --client codex --project /absolute/path/to/project
npm run setup:client -- --client codex --project /absolute/path/to/project --apply
```

For Cursor use `--client cursor`. A different existing configuration is reported as a conflict, never auto-merged. See [project setup instructions](CLIENT-SETUP.en.md) and [manual MCP configuration](MCP.en.md). Plugin installation and project installation are alternatives; pick one to avoid loading the tools twice.

Before previewing and before every write, the installer validates containment of the project root and target paths with `realpath`: `..` traversal, UNC/device/ADS path forms are rejected as `SETUP_PATH_ESCAPE` and `SETUP_PATH_INVALID` respectively, and a junction/symlink resolving outside the project is rejected as `SETUP_LINK_REJECTED`; a failed preview produces no partial writes. This protection no longer relies on `lstat` symlink flags, so Node 20 and Node 22 behave the same; Node 22+ is still recommended on Windows because Node 20's `lstat` misreports directory junctions as regular directories (fixed in Node 22), which can confuse other scripts that depend on that flag.

When installing the Skill only, copy the whole `skills/meeting-to-action/` directory (including references and agents) into the target project's `.agents/skills/` (Codex) or `.cursor/skills/` (Cursor). Copying only SKILL.md is incomplete. Discovery behavior depends on the client version; you can also explicitly ask the assistant to read the file.

### Analysis flow without an extra API key

Ask an assistant with the installed Skill to analyze transcripts you authorize it to read, for example:

```text
Please use Meeting-to-Action to analyze examples/agent-workflow/edge-cases.md.
Validate evidence via MCP and generate a Markdown report saved as edge-cases.report.md.
Keep owners and dates unknown when uncertain, preserve contradictions, do not create GitHub issues.
```

You can also use the CLI, with the assistant authoring a contract-compliant analysis.json between the two steps:

```sh
npm run dev -- inspect examples/sample-meeting.md --out normalized.json
# The assistant reads normalized.json and the schema in the Skill, then writes analysis.json
npm run dev -- report normalized.json --analysis analysis.json --out report.md
```

A ready-made validation example that calls no model (output to the terminal):

```sh
npm run dev -- report examples/agent-workflow/normalized.json --analysis examples/agent-workflow/analysis.json
```

Compare with the transcript, edited draft, and generated minutes in the [fictional meeting example](../examples/agent-workflow/README.md).

`inspect` and `report` do not call a model. `report` validates the meeting ID, structure, duplicate IDs within categories, and evidence before rendering. CLI commands with `--out` refuse to overwrite existing files.

For a more compact Chinese minutes document or an action list, supply a minutes editorial draft on top of the validated analysis (`minutes-contract@1.0`, see the [minutes display contract](MINUTES-CONTRACT.md)):

```sh
npm run dev -- report normalized.json --analysis analysis.json --minutes minutes.json --out minutes.md
```

When `--minutes` is present the minutes mode is rendered by default (main draft + trace appendix); `--mode` selects `minutes`, `actions` (action list only), or `evidence` (the original evidence report); `--no-appendix` drops the trace appendix. Without `--minutes` the original evidence report is emitted, so existing scripts behave unchanged; requesting `minutes`/`actions` mode without a draft fails with `MINUTES_MISSING`. The MCP `render_report` tool accepts the same optional arguments (`minutes` as a JSON string); see the [MCP documentation](MCP.en.md).

### Optional: standalone model analysis

Copy `.env.example` to `.env`, fill in `OPENAI_API_KEY` and `OPENAI_MODEL`, optionally configure `OPENAI_BASE_URL`, then run:

```sh
npm run dev -- analyze examples/sample-meeting.md --out report.md
```

The CLI only reads an env file when `analyze --env <path>` names one explicitly; otherwise it uses shell environment variables only — a `.env` in the working directory is never loaded implicitly. This mode sends the transcript to the configured model service and may incur charges; do not submit credentials or private meeting material. The current adapter uses Chat Completions-compatible JSON mode: JSON/schema parse failures are retried once by default (`0-5` attempts, configurable; `0` disables), and each retry resends the transcript to the provider; evidence-validation failures are not retried; long-text chunking, rate-limit backoff, and token budgets are not implemented yet. `analyze` enforces a 2 MiB UTF-8 limit on transcripts: files above the limit are rejected with `INPUT_SIZE_LIMIT` before being read into memory; `report` calls no model but likewise rejects normalized JSON over 2 MiB and analysis JSON over 4 MiB by file size first, and parsed inputs must additionally satisfy the 2 MiB / 10,000-segment limits; `inspect` has no such limit. See [analysis engine](ANALYSIS-ENGINE.md) for details.

### CLI error codes and exit codes

Exit codes: `0` success; `1` runtime error (including an invalid `--mode` value); `2` usage error (unknown flag, missing argument, or analyze-only flags used without the analyze command).

| Error code | Meaning |
|---|---|
| `CONFIG_MISSING` | `analyze` is missing `OPENAI_API_KEY` / `OPENAI_MODEL` |
| `CONFIG_INVALID` | env file unreadable, `OPENAI_TIMEOUT_MS` out of range, or `OPENAI_BASE_URL` scheme not allowed (not https and not loopback plain http) |
| `INPUT_UNSUPPORTED` / `INPUT_EMPTY` | unsupported transcript extension / empty content |
| `INPUT_SIZE_LIMIT` | input exceeds 2 MiB (analysis 4 MiB) or 10,000 segments |
| `INPUT_SEGMENT_LIMIT` | segment count over limit after normalization |
| `INPUT_JSON_INVALID` | normalized / analysis / minutes JSON failed to read or parse |
| `OUT_PATH_INVALID` | `--out` in UNC/device-namespace/drive-relative/alternate-data-stream form |
| `INPUT_SCHEMA_INVALID` | normalized JSON fails schema validation (report input) |
| `ANALYSIS_MEETING_MISMATCH` / `ANALYSIS_DUPLICATE_ID` / `ANALYSIS_EVIDENCE_INVALID` | analysis does not match the input meeting / duplicate entry IDs / evidence validation failed |
| `ANALYSIS_INVALID_JSON` / `ANALYSIS_SCHEMA_INVALID` | model output not parseable as JSON / valid JSON that fails the schema (after retries exhausted) |
| `MINUTES_MISSING` / `MINUTES_*` / `RENDER_MODE_INVALID` | minutes contract and render mode errors (see the [display contract](MINUTES-CONTRACT.md)) |
| `HTTP_ERROR` / `REQUEST_FAILED` / `REQUEST_TIMEOUT` / `REQUEST_ABORTED` | provider returned non-2xx / network failure / timeout / external abort |
| `RESPONSE_TOO_LARGE` / `BODY_READ_FAILED` / `INVALID_JSON` / `EMPTY_COMPLETION` / `PROVIDER_RESPONSE_INVALID` | provider response body over limit / read failed / not JSON / empty completion / invalid shape |
| `SETUP_*` | `setup:client` installer errors (path forms, traversal, conflicts, missing build artifacts, etc.) |

## Capabilities and boundaries

- Normalizes transcripts, preserving SHA-256 checksums, line numbers, fragment IDs, and speaker labels/timecodes from supported export formats.
- Uses versioned Zod contracts to validate structure, citation locations, and verbatim quotes; a label does not prove real identity or task ownership.
- Five MCP tools: `prepare_meeting`, `split_transcript`, `get_meeting_schema`, `validate_analysis`, `render_report`. Arguments are inline data; file paths are not accepted. Reading files and saving reports is done by the host.
- Unknown owners/dates stay unknown; instructions embedded in the transcript are treated as untrusted data.
- Passing validation proves structure and citations follow the rules, not that the interpretation is correct. Summaries currently have no per-item evidence fields; reports still need human review.
- MCP does not call a model, read/write arbitrary files, access GitHub, or create issues automatically. Whether the host model has network access and how data is processed depends on host settings.
- Cross-meeting persistence, GitHub integration, and public distribution remain future plans; compact minutes rendering is already wired into CLI `report` and MCP `render_report` (see the [minutes display contract](MINUTES-CONTRACT.md)).

## Demo

Screenshots and an end-to-end demo video will be added at the open-source release. For now, see the complete in-repo fictional sample: the [example walkthrough](../examples/agent-workflow/README.md) contains the transcript, the analysis draft, and the generated [minutes](../examples/agent-workflow/minutes.md) and [evidence report](../examples/agent-workflow/report.md).

## Layout and documentation

```text
src/         TypeScript core, CLI, MCP, provider, and project installer
skills/      authoritative Skill source, workflow references, and generated JSON Schemas
plugin/      local plugin manifests and MCP configuration templates
scripts/     build, schema export, and verification scripts
tests/       automated tests
examples/    publishable fictional inputs and complete analysis/report samples
docs/        installation, technical contracts, design, and roadmap
.github/     CI workflows
```

For full navigation and maintenance conventions see the [documentation index](INDEX.en.md). `dist/` is build output and `node_modules/` holds dependencies; neither is version-controlled. The package version's single source is `APP_VERSION` in `src/version.ts` (kept identical across CLI `--version`, MCP `serverInfo.version`, and plugin manifests; sync with `node scripts/version-sync.mjs <ver>`); the data contract `schemaVersion` evolves independently of the package version.

## Development verification

```sh
npm run typecheck
npm test
npm run mcp:smoke
npm run plugin:build
```

After contract changes run `npm run skill:schema` and inspect the diff. `npm run build` compiles the runtime only; `plugin:build` packages the plugin separately. `plugin:check-installed` is an optional local client-discovery check that requires the plugin to be built and installed first; it is not a general unit test.

## Support

For usage questions, start with this README and the [documentation index](INDEX.en.md); if that doesn't help, open an issue with the [bug template](../.github/ISSUE_TEMPLATE/bug.yml) (feature suggestions use the [feature template](../.github/ISSUE_TEMPLATE/feature.yml)). This project is maintained by an individual in their spare time; there is no live chat or email support channel, and reports must honor the privacy red line — no real meeting content.

## Security

Do **not** open public issues for security vulnerabilities; use the GitHub private vulnerability reporting channel described in the [security policy](SECURITY.en.md).

## Contributing

Issues and PRs are welcome. For the contribution process, code style, and verification gates see the [contributing guide](CONTRIBUTING.en.md) (condensed rules for AI assistants in [AGENTS.md](../AGENTS.md)); PRs follow the template's four-part structure (What was done / Changes / Verification / Scope).

## License

Released under the [MIT license](../LICENSE).
