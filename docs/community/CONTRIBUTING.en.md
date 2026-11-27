[简体中文（主版）](../../CONTRIBUTING.md) | English

# Contributing Guide

This document is the single authoritative source for collaboration: code style, directory responsibilities, testing and verification, and commit/PR processes all defer to it. For the condensed version aimed at AI assistants see [AGENTS.md](../../AGENTS.md); in case of conflict this document wins.

This project's collaboration conventions originate from issue #32. The conventions take effect for new code from the moment that issue was finalized; changes to this document go through a PR, not verbal changes in comments.

## Requirements

- Node.js ≥ 20 (matching the `engines` field in `package.json`) and npm
- Plugin packaging and its regression tests need system `tar`; formatting and other tests are provided by in-repo dependencies

## Quick start

```sh
npm ci
npm run preflight
```

`preflight` is the only full gate in this repository, executed in order:

| Step | Command | Purpose |
|---|---|---|
| 1 | `npm run typecheck` | Strict TypeScript compilation (`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`) |
| 2 | `npm run build` | Build `dist/` |
| 3 | `npm test` | Full vitest suite |
| 4 | `npm run mcp:smoke` | stdio MCP smoke test on compiled artifacts |
| 5 | `npm run plugin:build` | Build the single-plugin upload archive and the local plugin marketplace |
| 6 | `npm run format:check` | Prettier format check (`src tests scripts`) |

Run the full preflight before committing. Once CI is restored, CI passing is authoritative; CI is currently unable to run due to GitHub Actions billing, so PRs must include local preflight results in the "Verification" section.

For individual scripts: `npm run format` auto-formats, `npm run skill:schema` regenerates the contract schemas inside the Skill, and `npm run plugin:check-installed` verifies the plugin installation on a local Codex.

## Code style

- 2-space indent, UTF-8, LF, trailing newline at end of file; soft line-width limit of 100 characters (set by `.editorconfig` and `.prettierrc.json`)
- **Formatting is enforced by Prettier**: `src`, `tests`, and `scripts` must pass `format:check`; do not hand-write "Prettier-looking" code to bypass it
- Double quotes, semicolons at statement ends
- No large-scale reformatting: when editing an existing file, format only the lines you touch; if a whole-file reformat is truly needed, make it a **separate format commit** (history is protected via `.git-blame-ignore-revs`)
- Comments are primarily Chinese, explaining the "why" (trade-offs, reasons, boundaries) rather than restating code; code identifiers are English
- Public contract modules (schema, limits, error handling) must have comments explaining purpose and boundaries

### TypeScript

- The strict options in `tsconfig.json` must not be relaxed
- Named exports only; do not add `export default`
- ESM relative imports must include the `.js` suffix (required by NodeNext)
- Use `!` non-null assertions only when the invariant is locally provable; prefer explicit guards in production code; allowed in tests
- External errors follow `stable error code: one-line detail`; details must not echo user field values; **new error codes must be synced to `docs/MCP.md`**

### Naming

| Object | Convention |
|---|---|
| File names | kebab-case |
| Types / classes | PascalCase |
| Constants | SCREAMING_SNAKE_CASE |
| Functions / variables | camelCase |

## Generated artifacts and dependency boundaries

- Do not hand-edit generated artifacts such as `dist/` or `skills/meeting-to-action/references/*.schema.json`
- After changing `MeetingAnalysisSchema` / `MinutesDocumentSchema`, run `npm run skill:schema` and commit the regenerated schemas in the **same PR**
- Plugin artifacts are produced only via `npm run plugin:build`; the manifests under `plugin/` are the source
- New runtime/dev dependencies must be justified and license-checked in the PR
- Do not introduce: databases, network listeners, persistent storage, or a self-built model pipeline. For a new model provider, open an issue first and reuse the abstraction in `src/providers/`

## Test data and privacy red lines

- **Samples containing real meeting content or personal information must never be committed** (this includes test fixtures, examples, and doc samples)
- Verification records in issues/PRs only include aggregate numbers (e.g., "10 of 12 fully preserved"), never transcript excerpts
- Third-party datasets must have their license and authorized use checked before entering the repository; data without commit authorization is used for local verification only
- Fixtures and examples must not contain credentials, keys, or real accounts

## Testing and verification

- Any behavior change comes with tests; a pure refactor must prove tests are unchanged (or only moved)
- Contract changes (`analysis-schema@1.0` / `minutes-contract@1.0`, `src/domain/schema.ts`, the error-code set) must:
  - Sync `docs/DATA-SCHEMA.md` / `docs/MINUTES-CONTRACT.md` / `docs/MCP.md`
  - Re-run `npm run skill:schema` when `MeetingAnalysisSchema` / `MinutesDocumentSchema` are involved
  - Note the contract impact in the PR title
- Run the full `npm run preflight` before committing; include local results in the PR "Verification" section (tsc / vitest summary lines / build / smoke / format:check)
- Once CI is restored, CI results are authoritative and local evidence is transitional only

## Documentation conventions

- Distinguish "currently implemented" from "future plans"; never present plans as existing features
- Behavior or contract changes must sync the corresponding documents (DATA-SCHEMA / MINUTES-CONTRACT / MCP / PLUGIN-INSTALL / CLIENT-SETUP, etc., chosen by scope of impact)
- Core user-facing documents exist as bilingual pairs: Chinese main version (no suffix) + English variant (`.en.md`); **changes to a main version must be synced to the English variant**. Naming and authority conventions are in the "documentation language rules" section of [INDEX.md](../INDEX.md)
- New documents must be registered in the [INDEX.md](../INDEX.md) index
- Directory responsibilities are in the "file structure conventions" section of [INDEX.md](../INDEX.md); architecture and delivery plans are in [AGENT-TOOLKIT.md](../design/AGENT-TOOLKIT.md)

## Branches, commits, and PRs

- Branches: `<type>/<short-topic>`; common types: `feat` / `fix` / `docs` / `style` / `test` / `improve` / `integration` / `project`; one branch, one topic
- Commits: `<type>(<scope>): <topic>`, scope is the module name (`core` / `mcp` / `plugin` / `normalize` / `cli`, etc.); module-level changes must carry a scope; cross-module behavior fixes carry an issue reference (e.g., `fix(mcp): ... (#24)`)
- PRs use the four-part structure: **What was done / Changes / Verification / Scope**; the "Scope" section states explicitly what is NOT done
- At least one maintainer approval before merging; keep the merge-commit style

## Pre-commit checklist

- [ ] `npm run preflight` fully passes
- [ ] Behavior changes come with tests; contract changes synced docs and generated schemas
- [ ] No real meeting content, personal information, credentials, or unauthorized data was committed
- [ ] `dist/` and generated schemas were not hand-edited
- [ ] PR title, four-part body, and issue references are complete
