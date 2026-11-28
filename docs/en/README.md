[简体中文（主版）](../../README.md) | English

# Meeting-to-Action

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

**Turn meeting transcripts into traceable decisions, action items, and minutes — with evidence.**

[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Code of Conduct](CODE_OF_CONDUCT.md) · [Changelog](CHANGELOG.md)

Turn existing TXT / Markdown meeting transcripts into traceable topics, decisions, action items, risks, disagreements, and open questions. Ships a portable Skill, five local MCP tools, and an optional standalone CLI analysis mode. No meeting recording or speech recognition is included.

## Features

- **Provenance first**: SHA-256 checksums, line numbers, fragment IDs, speaker labels, and timecodes are preserved end to end, so every conclusion can be traced back to the source text.
- **Versioned contracts**: `analysis-schema@1.0` and `minutes-contract@1.0` — one validator shared by the CLI and MCP.
- **Multiple integration modes**: local desktop plugin / project-level Skill + MCP / Skill only / standalone CLI — pick what fits your environment.
- **Privacy red lines**: MCP does not call a model, read/write arbitrary files, access GitHub, or persist anything; instructions embedded in the transcript are treated as untrusted data.

## Choosing a usage mode

| Mode | When to use | Model & credentials |
|---|---|---|
| Local desktop plugin (Skill + MCP) | Codex clients that support a local plugin marketplace | Uses the host assistant model; no extra API key for this tool |
| Project-level Skill + MCP | Installing into a Codex / Cursor project | Uses the host assistant model; client discovery needs separate confirmation |
| Skill only | You only need analysis guidance and citation-backed drafts | Uses the host model; without a runtime there is no programmatic validation |
| CLI `analyze` | Calling a compatible model API without an assistant | You configure the API key, model, and optional service endpoint yourself |

Plugin installation and project installation are alternatives — usually pick one. `package.json` stays `private: true`: no npm package or public plugin marketplace is or will be published; cloning the repo or building the plugin does not automatically install, register, or enable anything, and an install state on another machine never means yours is configured.

## Getting started

Requires Node.js 20+ and npm (Node.js 22+ is recommended on Windows for the project-level installer; see [project setup](guides/CLIENT-SETUP.md) for why). Clone and build:

```sh
git clone https://github.com/LinJJ12/meeting-to-action.git
cd meeting-to-action
npm ci
npm run build
```

Then install according to the mode you chose:

- **Local desktop plugin**: `npm run plugin:build` produces the upload archive and the local marketplace; see [local plugin installation and usage](guides/PLUGIN-INSTALL.md).
- **Project-level Skill + MCP**: preview first, then apply (the target project must already exist; quote paths containing spaces). For Cursor use `--client cursor`:

```sh
npm run setup:client -- --client codex --project /absolute/path/to/project
npm run setup:client -- --client codex --project /absolute/path/to/project --apply
```

- **Skill only**: copy the whole `skills/meeting-to-action/` directory (including references and agents) into the target project's `.agents/skills/` (Codex) or `.cursor/skills/` (Cursor). Copying only SKILL.md is incomplete.

### Your first analysis (no API key required)

Ask an assistant with the installed Skill to analyze transcripts you authorize it to read:

```text
Please use Meeting-to-Action to analyze examples/agent-workflow/edge-cases.md.
Validate evidence via MCP and generate a Markdown report saved as edge-cases.report.md.
Keep owners and dates unknown when uncertain, preserve contradictions, do not create GitHub issues.
```

Or use the CLI two-step flow, with the assistant authoring a contract-compliant analysis.json in between:

```sh
npm run dev -- inspect examples/sample-meeting.md --out normalized.json
# The assistant reads normalized.json and the schema in the Skill, then writes analysis.json
npm run dev -- report normalized.json --analysis analysis.json --out report.md
```

For a more compact Chinese minutes document or an action list, append `--minutes minutes.json` on top of the validated analysis (see the [minutes display contract](../contracts/MINUTES-CONTRACT.md)); `--mode` selects `minutes` / `actions` / `evidence`. Compare with the [fictional meeting example](../../examples/agent-workflow/README.md).

## Optional: standalone model analysis

Copy `.env.example` to `.env`, fill in `OPENAI_API_KEY` and `OPENAI_MODEL`, optionally configure `OPENAI_BASE_URL`:

```sh
npm run dev -- analyze examples/sample-meeting.md --out report.md
```

The CLI only reads an env file when `analyze --env <path>` names one explicitly; a `.env` in the working directory is never loaded implicitly. This mode sends the transcript to the configured model service and may incur charges — do not submit credentials or private meeting material. Retry policy, input limits, and provider adaptation details are in [analysis engine](guides/ANALYSIS-ENGINE.md).

## Capabilities and boundaries

- Normalizes transcripts, preserving SHA-256 checksums, line numbers, fragment IDs, and speaker labels/timecodes from supported export formats.
- Uses versioned Zod contracts to validate structure, citation locations, and verbatim quotes; a label does not prove real identity or task ownership.
- Five MCP tools: `prepare_meeting`, `split_transcript`, `get_meeting_schema`, `validate_analysis`, `render_report`. Arguments are inline data; file paths are not accepted. Reading files and saving reports is done by the host.
- Unknown owners/dates stay unknown; instructions embedded in the transcript are treated as untrusted data.
- Passing validation proves structure and citations follow the rules, not that the interpretation is correct. Summaries currently have no per-item evidence fields; reports still need human review.
- MCP does not call a model, read/write arbitrary files, access GitHub, or create issues automatically. Whether the host model has network access and how data is processed depends on host settings.
- Cross-meeting persistence, GitHub integration, and public distribution remain future plans; compact minutes rendering is already wired into CLI `report` and MCP `render_report`.

## Demo

Screenshots and an end-to-end demo video will be added at the open-source release. For now, see the complete in-repo fictional sample: the [example walkthrough](../../examples/agent-workflow/README.md) contains the transcript, the analysis draft, and the generated [minutes](../../examples/agent-workflow/minutes.md) and [evidence report](../../examples/agent-workflow/report.md).

## Repository layout

```text
meeting-to-action/
├── src/                 # TypeScript core: core / domain / render / mcp / providers / cli / setup
├── skills/              # portable Skill source (SKILL.md + references + agents)
├── plugin/              # plugin source manifests (plugin.json / mcp.json)
├── scripts/             # build, schema export, smoke, and version-sync scripts
├── tests/               # vitest unit / integration / packaging tests
├── examples/            # publishable fictional samples (sample-meeting + agent-workflow flows)
├── docs/                # documentation: Chinese in guides / contracts / design, all English in en/
└── .github/             # CI workflows and issue / PR templates
```

Documents are split by language: Chinese lives in `docs/guides/` (installation and usage), `docs/contracts/` (contracts and technical references), and `docs/design/` (product and design materials); all English content lives in `docs/en/` (bilingual variants and English-main documents, grouped the same way). For full navigation see the [documentation index](INDEX.md).

## CLI error codes and exit codes

Exit codes: `0` success; `1` runtime error (including an invalid `--mode` value); `2` usage error (unknown flag, missing argument, or analyze-only flags used without the analyze command).

For the full meaning of `CONFIG_MISSING`, `INPUT_SIZE_LIMIT`, `SETUP_*`, and all other codes see the [CLI error codes reference](guides/CLI-ERRORS.md).

## Development verification

```sh
npm run typecheck
npm test
npm run mcp:smoke
npm run plugin:build
```

After contract changes run `npm run skill:schema` and inspect the diff. `npm run build` compiles the runtime only; `plugin:build` packages the plugin separately. `plugin:check-installed` is an optional local client-discovery check that requires the plugin to be built and installed first; it is not a general unit test.

## Support

For usage questions, start with this README and the [documentation index](INDEX.md); if that doesn't help, open an issue with the [bug template](../../.github/ISSUE_TEMPLATE/bug.yml) (feature suggestions use the [feature template](../../.github/ISSUE_TEMPLATE/feature.yml)). This project is maintained by an individual in their spare time; there is no live chat or email support channel, and reports must honor the privacy red line — no real meeting content.

## Security

Do **not** open public issues for security vulnerabilities; use the GitHub private vulnerability reporting channel described in the [security policy](SECURITY.md).

## Contributing

Issues and PRs are welcome. For the contribution process, code style, and verification gates see the [contributing guide](CONTRIBUTING.md) (condensed rules for AI assistants in [AGENTS.md](../../AGENTS.md)); PRs follow the template's four-part structure (What was done / Changes / Verification / Scope).

## License

Released under the [MIT license](../../LICENSE).
