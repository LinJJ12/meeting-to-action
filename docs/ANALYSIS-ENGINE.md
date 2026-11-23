# Analysis Engine

## Responsibilities

The analysis engine has four explicit boundaries:

1. Normalize source text and preserve source segment IDs and line ranges.
2. Build a constrained analysis prompt. Transcript text is untrusted data.
3. Call an injected `AnalysisProvider`; provider-specific networking is outside the domain layer.
4. Parse the returned JSON, validate its schema, attach application-owned meeting metadata, and verify every evidence reference against the source.

## Provider contract

`AnalysisProvider.complete(messages)` returns the model's raw text response. The core does not depend on a vendor SDK. The current adapter targets OpenAI-compatible Chat Completions endpoints and requests JSON object mode.

## Evidence integrity

Each material item must contain evidence. Every reference is checked for:

- An existing segment ID.
- A source ID matching that segment.
- Exact original line start and end values.
- An optional quote that is a literal substring of the source segment.

Invalid model output is rejected as a whole. The engine does not silently repair fabricated evidence.

## Command

```bash
OPENAI_API_KEY=... OPENAI_MODEL=... npm run dev -- analyze meeting.md --out report.md
```

On Windows PowerShell, set environment variables with `$env:NAME = "value"`.

## Current limitations

- One model call per meeting; no chunking or map/reduce for long transcripts.
- No automatic retries, rate-limit backoff, or token-budget estimation.
- No provider-specific structured-output adapters beyond OpenAI-compatible JSON mode.
- No persistence, cross-meeting memory, or GitHub issue creation yet.
- Human review is required before treating extracted decisions and actions as accepted work.
