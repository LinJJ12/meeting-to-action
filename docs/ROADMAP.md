# Roadmap

## Phase 0 — Project baseline
- [x] Establish product scope, architecture, data contract, and security principles.
- [x] Create an isolated feature branch and preserve the existing project baseline.

## Phase 1 — Local foundation
- [x] TypeScript project configuration.
- [x] TXT/Markdown transcript normalization with source checksums and line references.
- [x] Versioned Zod input/output schemas.
- [x] Evidence reference helpers and validation.
- [x] Markdown report renderer and local inspect CLI.
- [x] Initial normalization tests and sample fixture.
- [x] Run typecheck, tests and build locally in Node.js; Actions intentionally not triggered.
- [x] Bundle the portable Meeting-to-Action Skill in this repository.

## Phase 2 — Agent analysis
- [x] Define a model-neutral AnalysisProvider interface.
- [x] Add an OpenAI-compatible Chat Completions provider.
- [x] Build a Skill-guided analysis prompt.
- [x] Validate structured output and evidence source/segment/line/quote integrity.
- [x] Add analyze CLI command and Markdown evidence report.
- [x] Add analysis and prompt-injection regression tests.
- [ ] Validate extraction quality with a human-reviewed golden dataset.
- [ ] Add long-transcript chunking, token budgeting, retries, and rate-limit handling.
- [ ] Add provider-specific structured-output adapters as needed.

## Phase 3 — Local MCP and future external integrations
- [x] Local stdio MCP server using the stable TypeScript SDK.
- [x] Five meeting tools: prepare, split, schema, validate and render.
- [x] Input size limits, redacted errors and source-preserving splitting.
- [x] SDK client integration and compiled subprocess smoke tests.
- [ ] Verify discovery and usage in actual Codex and Cursor clients.
- [ ] Publish an installable runtime package after client acceptance.
- [ ] Read-only repository and issue search.
- [ ] Evidence-backed issue proposals and duplicate candidates.
- [ ] Explicitly approved issue creation.
- [ ] Permission and failure-path tests.

## Phase 4 — Continuity and integrations
- [ ] Cross-meeting decision/action tracking.
- [ ] Stale and superseded decision suggestions.
- [ ] Markdown document adapter.
- [ ] Additional transcript formats and source adapters.

A phase is complete only with tests, documentation, a reproducible demo, and known limitations. External writes remain approval-gated.

## Agent toolkit delivery

See [the product architecture and acceptance plan](AGENT-TOOLKIT.md). Agent JSON ingestion/report is implemented locally with regression coverage. Skill source is now maintained in this repository; actual Codex/Cursor installation testing and runtime publication are pending; local MCP implementation and SDK subprocess checks are complete. CI is not required to run these checks locally, and must not be triggered while the user is avoiding Actions usage.
