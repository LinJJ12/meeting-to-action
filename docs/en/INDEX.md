[简体中文（主版）](INDEX.md) | English

# Documentation index and maintenance conventions

Start with the [project README](README.md) on first use. docs/ has three Chinese topic subdirectories, with all English content collected in the en/ library below; this file is the navigation and maintenance convention for all documents.

## Documentation directory layout

```text
docs/en/
├── INDEX.md            # this file: English navigation and maintenance conventions
├── README.md, CONTRIBUTING.md, CHANGELOG.md, SECURITY.md, CODE_OF_CONDUCT.md
│                       # English variants of the root main versions
├── guides/             # installation and usage (English)
├── contracts/          # contracts and technical references (English)
└── design/             # product and design materials (English)
```

## Documentation language rules

- Chinese is the project's primary language: `docs/` holds only Chinese main versions (no suffix); all English content is collected in `docs/en/`, where file names match the corresponding Chinese main version — **a same-named file under `docs/en/` is the English variant of that main version**, with a language switcher at the top. Bilingual pairs currently cover: the README, CONTRIBUTING, INDEX (this file), PLUGIN-INSTALL, CLIENT-SETUP, MCP, CLI-ERRORS, the CHANGELOG, SECURITY (the root reporting policy), and the CODE_OF_CONDUCT.
- The English library also contains six "English-main" documents with no Chinese counterpart: `en/guides/ANALYSIS-ENGINE.md`, `en/contracts/ARCHITECTURE.md`, `en/contracts/DATA-SCHEMA.md`, `en/contracts/SECURITY.md`, `en/design/PRD.md`, and `en/design/AGENT-TOOLKIT.md`.
- Why the root keeps only Chinese main versions: GitHub's community standards search picks the first matching file in `.github/` → root → `docs/` order, and the code of conduct matches loosely — with both `CODE_OF_CONDUCT.md` and `CODE_OF_CONDUCT.en.md` in the root, GitHub identified the English variant as the sole code of conduct (confirmed via the API). GitHub scans only the direct level of those three folders, not recursively, so collecting English content under the `docs/en/` subdirectory does not affect community-standard detection.
- English variants note at the top that the Chinese main version is authoritative; when the two copies disagree, the Chinese main version wins. "English-main" documents have no Chinese counterpart and stand on their own.
- **Changes to a Chinese main version must be synced to the corresponding English variant under `docs/en/`**; contract-type changes still follow the process in [CONTRIBUTING.md](../../CONTRIBUTING.md).
- Content aimed at AI assistants (`skills/meeting-to-action/`, `AGENTS.md`) stays single-language and is not translated; `LICENSE` is a legal text with no variant; `.github/` templates are bilingual inline.
- `examples/` contains functional samples rather than part of the bilingual documentation system: language follows content role (an English transcript input yields an English report output; minutes rendering follows the Chinese minutes contract), and file names are depended on by tests and the smoke script, so they must not be renamed freely.

## Installation and usage (guides/)

| Document | Language | Purpose |
|---|---|---|
| [PLUGIN-INSTALL.md](guides/PLUGIN-INSTALL.md) / [中文](../guides/PLUGIN-INSTALL.md) | Bilingual | Local plugin build, install, verification, and updates |
| [CLIENT-SETUP.md](guides/CLIENT-SETUP.md) / [中文](../guides/CLIENT-SETUP.md) | Bilingual | Project-level Skill + MCP installation, conflict handling, and client acceptance |
| [MCP.md](guides/MCP.md) / [中文](../guides/MCP.md) | Bilingual | The current five tools, manual configuration, limits, and errors |
| [CLI-ERRORS.md](guides/CLI-ERRORS.md) / [中文](../guides/CLI-ERRORS.md) | Bilingual | CLI exit codes and the full error-code table |
| [ANALYSIS-ENGINE.md](guides/ANALYSIS-ENGINE.md) | English | Optional standalone provider analysis mode |

## Contracts and technical references (contracts/)

| Document | Language | Purpose |
|---|---|---|
| [MINUTES-CONTRACT.md](../contracts/MINUTES-CONTRACT.md) | Chinese | The minutes-contract@1.0 display contract: reading mode, claim types, and validation rules; the authoritative definition is src/domain/minutes.ts |
| [ARCHITECTURE.md](contracts/ARCHITECTURE.md) | English | Current module layout, data flow, and trust boundaries |
| [DATA-SCHEMA.md](contracts/DATA-SCHEMA.md) | English | Contract documentation; the authoritative definition is src/domain/schema.ts |
| [SECURITY.md](contracts/SECURITY.md) | English | Privacy, keys, untrusted content, and external-write principles |

## Product and design materials (design/)

| Document | Language | Status and purpose |
|---|---|---|
| [ROADMAP.md](../design/ROADMAP.md) | Chinese | Roadmap 3.0 alignment, phase-1 wrap-up status, scope decisions, and public dataset policy |
| [MEETING-REPORT-DESIGN.md](../design/MEETING-REPORT-DESIGN.md) | Chinese | Design rationale, implementation split, and reader acceptance goals for compact minutes |
| [MEETING-MINUTES-RESEARCH.md](../design/MEETING-MINUTES-RESEARCH.md) | Chinese | First-hand research behind the design above |
| [PRD.md](design/PRD.md) | English | Product goals and acceptance requirements, including unimplemented integration goals |
| [AGENT-TOOLKIT.md](design/AGENT-TOOLKIT.md) | English | Agent workflow design and staged delivery requirements |

## Collaboration conventions

| Document | Language | Purpose |
|---|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) / [中文](../../CONTRIBUTING.md) | Bilingual | Single authoritative source for collaboration: environment, code style, testing and verification, commit and PR processes |
| [AGENTS.md](../../AGENTS.md) | Chinese | Condensed rules for AI assistants such as Codex / Cursor, pointing to CONTRIBUTING.md; aimed at AI, not translated |

## Community and compliance

| Document | Language | Purpose |
|---|---|---|
| [LICENSE](../../LICENSE) | English | MIT license text (legal text, no variant) |
| [CHANGELOG.md](CHANGELOG.md) / [中文](../../CHANGELOG.md) | Bilingual | Keep a Changelog–format release notes; version numbers are drift-guarded against `APP_VERSION` by a test |
| [SECURITY.md](SECURITY.md) / [中文](../../SECURITY.md) | Bilingual | The root vulnerability reporting policy: GitHub private vulnerability reporting and the privacy red line; product security principles are in [contracts/SECURITY.md](contracts/SECURITY.md) (table above) |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) / [中文](../../CODE_OF_CONDUCT.md) | Bilingual | Contributor Covenant v2.1 code of conduct |
| `.github/ISSUE_TEMPLATE/` and `.github/PULL_REQUEST_TEMPLATE.md` | Bilingual inline | Form-based bug / feature issue templates and the four-part PR template; not registered individually in the docs index |

## File structure conventions

- `src/` is layered by responsibility; `tests/` keeps the corresponding unit, integration, and packaging tests.
- `skills/meeting-to-action/` is the only Skill source; never edit dist or client caches as source. Its analysis.schema.json is generated by `npm run skill:schema` and must be committed with contract changes.
- `plugin/` keeps reusable manifests; `scripts/` holds only reusable maintenance scripts.
- `examples/` contains only publishable fictional data. The normalized.json, analysis.json, and report.md under agent-workflow are complete-flow samples and test dependencies, not temporary output to be cleaned.
- `docs/` keeps only this Chinese index at its top level, grouped into `guides/` (installation and usage), `contracts/` (technical references), and `design/` (design and planning), plus the `en/` English library (bilingual variants and English-main documents, grouped isomorphically into guides/contracts/design). When adding a document, first choose its location by language: Chinese goes into the matching topic group, English goes into the matching group under en/, then register it here.
- `dist/`, `node_modules/`, coverage, and caches are not committed. A registered local plugin marketplace may depend on dist paths; consider installation relationships before cleaning.
- `.local-client-check/` is an ignored local acceptance area, not a runtime dependency. Private meetings and reports never enter the repository and are not auto-deleted; one-off protocol files and temporary client projects can be cleaned.
- package-lock.json is kept for reproducible installs; `.env.example` keeps placeholder configuration only.

### Directory responsibility map

| Location | Responsibility | Key conventions |
|---|---|---|
| `src/core/` | Deterministic business logic: parsing, normalization, evidence validation, limits, minutes validation, error details | No model calls, no platform operations |
| `src/domain/` | Versioned contracts: `schema.ts` = `analysis-schema@1.0`; `minutes.ts` = `minutes-contract@1.0` | Contract changes follow the CONTRIBUTING.md contract process |
| `src/render/` | Report / minutes / escaping output rendering | Pure functions, no IO |
| `src/mcp/` | stdio MCP protocol layer: five tools, line guard, protocol errors | stdout carries protocol only; diagnostics go to stderr |
| `src/providers/` | Model invocation abstraction and types | Env files are read only when `analyze --env` names one explicitly |
| `src/cli.ts`, `src/setup.ts`, `src/integrations/setup.ts` | CLI entry; client installer entry and implementation | The installer enforces path containment |
| `src/version.ts` | The single version write point `APP_VERSION` | Change versions with `node scripts/version-sync.mjs <semver>` |
| `tests/` | Unit / integration / packaging tests, named `<area>-<topic>.test.ts` | `stdio-harness.ts` is shared test infrastructure; `support/` holds fixture helpers |
| `scripts/` | Reusable maintenance scripts: build-plugin / check-installed-plugin / export-skill-schema / smoke-mcp / version-sync | No one-off scripts |
| `skills/meeting-to-action/` | The only Skill source: SKILL.md + agents/openai.yaml + references/ | `references/*.schema.json` are generated artifacts committed with contracts |
| `plugin/` | Plugin source manifests (plugin.json / mcp.json) | Artifacts under `dist/plugin-marketplace/` are not committed |
| `examples/` | Publishable fictional data: sample-meeting.md + the complete agent-workflow flow samples | agent-workflow is a test dependency, not temporary output |
| `docs/guides/` | Chinese main versions of installation and usage documents (PLUGIN-INSTALL / CLIENT-SETUP / MCP / CLI-ERRORS) | English variants live in same-named files under `docs/en/guides/` |
| `docs/contracts/` | Chinese contract documents (MINUTES-CONTRACT); English contract documents live in `docs/en/contracts/` | Contract changes sync DATA-SCHEMA / MINUTES-CONTRACT / guides/MCP and their en variants |
| `docs/design/` | Chinese design materials (ROADMAP / MEETING-*); English design materials live in `docs/en/design/` | Distinguish current from planned; never present plans as existing features |
| `docs/en/` | The English document library: bilingual variants (same-named as the root / docs main versions) + English-main technical documents | Main-version changes must be synced to the en variants |
| `.github/workflows/ci.yml` | CI (Node 20/22 matrix; runs the same six steps as `preflight`; local and CI results should agree) | Update it together with `npm run preflight` whenever the verification steps change |
| `.env.example`, `.gitignore`, `.gitattributes`, `.editorconfig`, `.prettierrc.json`, `.prettierignore`, `.git-blame-ignore-revs`, `vitest.config.ts`, `tsconfig.json`, `package-lock.json` | Environment placeholders / ignore rules / LF enforcement / format config and ignores / blame ignore for format commits / test config / strict compilation / reproducible installs | `.env` is never committed |

When capabilities change, sync the README, the relevant usage documents, and the roadmap. For bilingual usage documents, changes to a main version must be synced to the English variant under `docs/en/`. Client verification must state the environment and verification scope, and never present a maintainer's machine state as a reader prerequisite. Historical test counts are not a lasting quality claim; current verification results are what count.
