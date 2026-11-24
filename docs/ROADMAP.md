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
- [ ] Run CI in a real Node.js environment and fix any failures.
- [ ] Merge the portable Meeting-to-Action Skill PR in LinJJ12/skills.

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

## Phase 3 — GitHub MCP
- [ ] MCP server using the stable TypeScript SDK.
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
