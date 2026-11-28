[简体中文（主版）](../../CHANGELOG.md) | English

# Changelog

All notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

(empty)

## [0.1.2] - 2026-11-28

### Added

- A bilingual documentation system for core documents: Chinese main versions (at the repo root and in docs/, no suffix) plus the `docs/en/` English library (same-named English variants and six English-main technical documents) covering the README, CONTRIBUTING, the docs index, plugin installation, project setup, and the MCP documentation.
- Open-source community files: the MIT `LICENSE`, this changelog, a root `SECURITY.md` vulnerability reporting policy, a Code of Conduct (Contributor Covenant v2.1), and bilingual Issue / PR templates.
- Open-source standard README sections: License badge and section, Contributing / Security links, an English tagline, a demo placeholder, and a Support section.
- ESLint correctness gate: `npm run lint` (`@eslint/js` + typescript-eslint recommended + two type-aware rules) is now the second `preflight` step; `#36`.

### Changed

- Support floor bumped: the CI matrix and `engines` move from Node 20/22 (20 reached EOL in April 2026) to Node 22/24, with the README / CONTRIBUTING / AGENTS / MCP / PLUGIN-INSTALL / CLIENT-SETUP bilingual guidance synced; CI actions upgraded to node24-runtime versions (checkout v5.1.0, setup-node v6.5.0, SHA-pinned).
- CI now runs an Ubuntu/Windows × Node 20/22 four-job matrix with `permissions`, `concurrency`, `timeout` and SHA-pinned actions; the PR template and the README / CLIENT-SETUP Node guidance are aligned; `package.json` gained `description` / `license` / `repository` metadata.
- Documentation layout reorganized: all English content (bilingual variants and English-main documents) is now collected under `docs/en/`, replacing the `.en.md` suffix convention; stale document paths in AGENTS / CONTRIBUTING and the ROADMAP broken link in the issue template were fixed along the way.
- The README's "source and local distribution" wording now reflects the post-open-source state: the repository is public (MIT), but no npm package or public plugin marketplace is published.

### Fixed

- Fix: the MCP request-line limit now counts CR bytes, closing a CR-padding bypass of the 4 MiB bound.
- Fix: malformed `tools/call` params return JSON-RPC `-32602` instead of surfacing the SDK's serialized Zod error as an internal error.
- Fix: `normalizeTranscript` keeps each line's original whitespace so verbatim quotes are no longer rejected by normalization trimming; evidence and rendered locators truncate by Unicode code point and never split emoji.
- Fix: CLI input read/parse failures, `--out` collisions and `--version` combined with other arguments use stable codes (`INPUT_JSON_INVALID` / `OUT_PATH_UNUSABLE` / exit 2) and no longer echo user field values; minutes now share the MCP 2 MiB limit.
- Fix: `setup:client` gained preflight checks and a transactional rollback (`SETUP_PROJECT_INVALID` / `SETUP_CONFLICT` / `SETUP_APPLY_FAILED`); a failed `--apply` only removes what that run created.
- Fix: `version-sync` preflights and verifies writes; plugin archives are byte-reproducible (fixed mtime, permissions and member order); `smoke-mcp` asserts the exact tool contract instead of only the tool count.
- After CI resumed automatic runs, updated the stale "CI cannot run due to billing" notes in AGENTS / CONTRIBUTING / the docs index / the PRD, and added the missing `format:check` and `lint` steps to the CI workflow so it matches the seven steps of `npm run preflight`.
- Removed the stale "will be added at the open-source release" placeholder from the README demo section; SECURITY now states that the repository is public and private vulnerability reporting is enabled.

## [0.1.1] - 2026-11-27

### Added

- Plugin: a single-plugin upload archive `meeting-to-action-v<version>.tar.gz` for the Codex desktop client, containing the Skill, the MCP bundle, and third-party license information.

### Fixed

- Contracts: same-source segment line-range disjointness — partially overlapping, nested, and identical ranges are rejected (closing #13, contract tightened).
- Plugin: fixed minutes delivery and trace-contract issues (#41, #42, #43).

### Documentation

- ROADMAP aligned with Roadmap 3.0, recording the phase-1 wrap-up status.
- Synced the plugin minutes-delivery documentation and example acceptance notes.

## [0.1.0] - 2026-11-26

First tagged release.

### Added

- A portable Skill (`skills/meeting-to-action/`) and five local stdio MCP tools: `prepare_meeting`, `split_transcript`, `get_meeting_schema`, `validate_analysis`, `render_report`.
- CLI: the deterministic `inspect` / `report` two-step flow and the optional standalone-model `analyze` command.
- Versioned contracts: `analysis-schema@1.0` and `minutes-contract@1.0` (with minutes rendering, the action list, and the trace appendix).
- Transcript format support: Tencent Meeting, Feishu Minutes, standalone speaker + MM:SS header lines, and inline speaker formats, preserving SHA-256 checksums and line-number provenance.
- The project-level installer `setup:client` (Codex / Cursor) with `realpath` containment checks and conflict preflight.
- Local plugin marketplace builds and the `plugin:check-installed` discovery check.

### Security hardening

- Explicit `--env` env-file loading, https-only endpoints (plain http on loopback only), and redirects disabled.
- Terminal escape sequence stripping; `--out` rejects unsafe path forms such as UNC / device namespaces / ADS.
- A per-tool-call CPU budget (`MAX_TOOL_WORK_MS`); exceeding it ends the call with `WORK_LIMIT_EXCEEDED`.

### Changed

- Collaboration conventions introduced: CONTRIBUTING.md / AGENTS.md, and `format:check` wired into the preflight gate.
- Schema error details now include the first field path so hosts can correct arguments without guessing (#26).

[Unreleased]: https://github.com/LinJJ12/meeting-to-action/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/LinJJ12/meeting-to-action/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/LinJJ12/meeting-to-action/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/LinJJ12/meeting-to-action/releases/tag/v0.1.0
