# Roadmap

## Phase 0 — Project baseline
- [x] Replace legacy project content with Meeting-to-Action documentation.
- [x] Establish product scope, architecture, data contract, and security principles.
- [x] Create an isolated feature branch from main.

## Phase 1 — Local foundation
- [x] TypeScript project configuration.
- [x] TXT/Markdown transcript normalization.
- [x] Versioned Zod input/output schemas.
- [x] Evidence reference helpers and validation.
- [x] Markdown report renderer.
- [x] CLI inspect command.
- [x] Initial unit tests and sample fixture.
- [ ] Run CI in a real Node.js environment and fix any failures.
- [ ] Add Skill to LinJJ12/skills and validate portability.
- [ ] Define a model-neutral analysis provider interface.
- [ ] Add validated analysis JSON ingestion and report command.

## Phase 2 — Agent analysis
- [ ] Implement Skill-guided extraction of topics, decisions, actions, risks, conflicts, and open questions.
- [ ] Require evidence references for material claims.
- [ ] Add golden evaluation fixtures and a human-reviewed rubric.
- [ ] Test uncertain owners, deadlines, contradictions, and prompt-injection text.

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
