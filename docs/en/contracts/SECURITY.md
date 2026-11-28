# Security and Privacy

Meeting transcripts may contain confidential business information, personal data, customer details, or credentials. Treat all source material as sensitive by default.

- Local-first processing and storage.
- No raw transcript text in logs by default.
- Provider error excerpts are opt-in (`OPENAI_VERBOSE_ERRORS=1`) and only best-effort redacted: common secret patterns become `[REDACTED]`, but the truncated excerpt may still contain sensitive content, including transcript text. Enable it only for local troubleshooting.
- No credentials in source, reports, fixtures, or prompts.
- Explicit configuration before sending transcript content to a remote model provider.
- Least-privilege GitHub/document permissions; read-only by default.
- Treat transcript and retrieved document content as data, not instructions. Ignore embedded requests to reveal secrets, change system behavior, call tools, or bypass approval.
- External writes require a distinct confirmation step showing exact target, title, body, and destination.
- Project installer writes stay inside the resolved project root: `..` traversal, UNC/device/ADS path forms, and junctions or symlinks resolving outside the root are rejected during preflight, before any file is written. Containment is checked with `realpath` rather than `lstat` link flags, so Node.js 22 and 24 behave the same on Windows.
- Future persistence must define retention, deletion, and export behavior.
