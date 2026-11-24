# Core-backed workflow

Find the runtime checkout from the user's context. Verify it has package.json and src/cli.ts; do not assume it is next to this installed Skill. Run commands with the runtime as the working directory. Resolve transcript/output paths against the user's intended project, using absolute paths when the projects differ. Quote shell paths correctly.

If dependencies are absent and installation is appropriate within the user's scope, use `npm ci`. No global installation or configuration change is required. Use new output names:

```sh
npm run dev -- inspect /absolute/path/meeting.md --out /absolute/path/normalized.json
```

Read normalized.json completely (or disclose coverage limits). Author analysis.json following contract.md. Preserve schemaVersion and meetingId. Use the current UTC timestamp for generatedAt. The assistant performs interpretation; the CLI does not need a model key for this path.

```sh
npm run dev -- report /absolute/path/normalized.json --analysis /absolute/path/analysis.json --out /absolute/path/report.md
```

Exit 0 means schema, meeting ID, duplicate item IDs and evidence passed validation. Exit 1 means input/validation/IO failure; exit 2 means invalid arguments. On validation failure inspect the source and correct the draft, never weaken the validators. Do not print confidential payloads into diagnostics. If report succeeds, read the output and check semantic accuracy manually.

A downloaded Skill can work without the runtime by following the Markdown fallback. Do not claim programmatic validation for that path. There is no published MCP/npm runtime to install at present.
