# Product Requirements

## Product

Meeting-to-Action is an agent-compatible toolkit that turns existing transcripts and notes into traceable work products. It solves the gap between a meeting summary and actual follow-through.

## Users

Individual developers, technical leads, and small teams using GitHub Issues and Markdown documentation.

## Problems addressed

- Distinguish decisions from suggestions and unresolved discussion.
- Extract actions, owners, deadlines, and dependencies without fabrication.
- Link discussion to existing project issues and documents.
- Reduce duplicate or poorly scoped issues.
- Preserve decision history and track follow-through.

This document describes product targets, including future GitHub integration. For implemented capabilities see [README](../README.md) and [roadmap](ROADMAP.md).

## MVP requirements

1. Import TXT and Markdown.
2. Normalize source metadata and segments.
3. Extract topics, decisions, actions, risks, conflicts, and open questions.
4. Attach evidence references to material claims.
5. Leave unknown owners/deadlines unset.
6. Validate output against versioned schemas.
7. Search existing GitHub issues before proposing new ones.
8. Generate issue drafts with context, scope, acceptance criteria, dependencies, and evidence.
9. Require explicit user confirmation before any external write.
10. Export Markdown and JSON.

## Out of scope

Meeting recording, ASR, calendar management, autonomous assignment, hosted multi-tenant SaaS, and web dashboard.

## Acceptance criteria

- Sample transcripts import without manual format repair.
- Golden fixtures verify evidence coverage and uncertainty handling.
- No invented assignee or due date in acceptance tests.
- Issue search occurs before issue proposals.
- No external write without a separate approval step.
- Schema validation and rendering run in local preflight (`npm run preflight`); CI is configured but paused (see .github/workflows/ci.yml).
- A reproducible demo is documented.

## Risks

Transcript quality, speaker attribution, false certainty, duplicate detection, MCP client differences, confidential meeting content, and source format changes. Mitigate with evidence-first output, explicit uncertainty, human review, least privilege, adapters, and fixtures.
