[简体中文（主版）](../../guides/CLI-ERRORS.md) | English

# CLI error codes and exit codes reference

Applies to the CLI commands `analyze` / `inspect` / `report` and the `setup:client` installer. For MCP-side tool boundaries, limits, and the Known codes list see the [MCP documentation](MCP.md); for minutes error-code validation rules see the [minutes display contract](../../contracts/MINUTES-CONTRACT.md); for `analyze` retry and input-limit semantics see [analysis engine](ANALYSIS-ENGINE.md).

## Exit codes

- `0` success
- `1` runtime error (including an invalid `--mode` value)
- `2` usage error (unknown flag, missing argument, or analyze-only flags used without the analyze command)

## Error codes

| Error code | Meaning |
|---|---|
| `CONFIG_MISSING` | `analyze` is missing `OPENAI_API_KEY` / `OPENAI_MODEL` |
| `CONFIG_INVALID` | env file unreadable, `OPENAI_TIMEOUT_MS` out of range, or `OPENAI_BASE_URL` scheme not allowed (not https and not loopback plain http) |
| `INPUT_UNSUPPORTED` / `INPUT_EMPTY` | unsupported transcript extension / empty content |
| `INPUT_SIZE_LIMIT` | input exceeds 2 MiB (analysis 4 MiB; minutes 2 MiB) |
| `INPUT_SEGMENT_LIMIT` | more than 10,000 segments after normalization |
| `INPUT_JSON_INVALID` | normalized / analysis / minutes JSON failed to read or parse (names the role only; never echoes host paths) |
| `OUT_PATH_INVALID` | `--out` in UNC/device-namespace/drive-relative/alternate-data-stream form |
| `OUT_PATH_UNUSABLE` | `--out` target already exists, or its parent directory is missing or unusable (inspect and report; existing files are never overwritten) |
| `INPUT_SCHEMA_INVALID` | normalized, analysis, or minutes JSON fails schema validation |
| `ANALYSIS_MEETING_MISMATCH` / `ANALYSIS_DUPLICATE_ID` / `ANALYSIS_EVIDENCE_INVALID` | analysis does not match the input meeting / duplicate entry IDs / evidence validation failed |
| `ANALYSIS_INVALID_JSON` / `ANALYSIS_SCHEMA_INVALID` | model output not parseable as JSON / valid JSON that fails the schema (after retries exhausted) |
| `MINUTES_MISSING` / `MINUTES_*` / `RENDER_MODE_INVALID` | minutes contract and render mode errors (see the [display contract](../../contracts/MINUTES-CONTRACT.md)) |
| `HTTP_ERROR` / `REQUEST_FAILED` / `REQUEST_TIMEOUT` / `REQUEST_ABORTED` | provider returned non-2xx / network failure / timeout / external abort |
| `RESPONSE_TOO_LARGE` / `BODY_READ_FAILED` / `INVALID_JSON` / `EMPTY_COMPLETION` / `PROVIDER_RESPONSE_INVALID` | provider response body over limit / read failed / not JSON / empty completion / invalid shape |
| `SETUP_PROJECT_INVALID` | `--project` is missing, not a directory, or cannot be resolved |
| `SETUP_CONFLICT` | target occupied by a directory/plain file, an uncreatable parent, or different existing content (identical for preview and `--apply`; `--apply` rolls back first) |
| `SETUP_APPLY_FAILED` | other filesystem errors during `--apply` (content created by that run has been rolled back) |
| `SETUP_*` | remaining `setup:client` installer errors (path forms, traversal, missing build artifacts, etc.) |

When adding an error code, sync this file and the Known codes line in `docs/guides/MCP.md` (both directions are guarded by `tests/docs-consistency.test.ts`).
