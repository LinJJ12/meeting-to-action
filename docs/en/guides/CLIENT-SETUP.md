[简体中文（主版）](../../guides/CLIENT-SETUP.md) | English

# Project setup and client acceptance

## Install into an existing project

From this runtime checkout:

```sh
npm ci
npm run build
# Preview only. The project directory must already exist.
npm run setup:client -- --client codex --project /absolute/path/to/project
# Apply the reviewed plan.
npm run setup:client -- --client codex --project /absolute/path/to/project --apply
```

For Cursor use `--client cursor`. Paths containing spaces must be shell-quoted. The compiled installer is `node dist/setup.js`; it locates the Skill/runtime relative to itself, so keep this checkout in its installed location and rebuild after source changes.

| Client | Skill destination | Project MCP config |
|---|---|---|
| Codex | `.agents/skills/meeting-to-action/` | `.codex/config.toml` |
| Cursor | `.cursor/skills/meeting-to-action/` | `.cursor/mcp.json` |

The installer uses absolute Node and runtime paths, copies all Skill references, and makes no model/network call. It only writes within the selected project's resolved root. Containment is checked with `realpath` on the resolved root rather than with `lstat` link flags: `..`, UNC/device/ADS path forms and any redirect resolving outside the root are rejected during preflight, while redirects staying inside the root are followed; Node.js 20 and 22 behave the same on Windows. Identical files are left untouched, making repeated runs safe. Different existing files cause SETUP_CONFLICT during preflight, before installation writes anything. Existing MCP config files are not automatically merged; use the [MCP examples](MCP.md) to add an entry manually while preserving other servers/settings.

The tool does not register a global server, change project trust, remove old files or overwrite a previous Skill release. Upgrade by comparing your installed files/config against the new source and applying a reviewed update manually. A failed filesystem write may leave some newly created files; correct the cause and rerun. Exclusive writes protect existing files. The installer is for trusted local projects; it is not a concurrent filesystem sandbox against an attacker swapping directories during installation.

Codex may require project trust before loading project-level configuration; installing files does not grant trust. Cursor may require enabling the server. Follow the client's normal controls; do not disable approvals to make discovery pass. Moving the runtime checkout or Node executable requires updating the generated absolute paths.

## Local acceptance recorded 2026-11-24

- Node.js 22.18.0 on Windows x64.
- Codex CLI `0.171.0-alpha.13`: installed into an isolated project under ignored `.local-client-check/`. A fresh local App Server accepted initialization. `skills/list` with that project cwd returned `meeting-to-action`, enabled, with no errors for that Skill.
- Codex `mcpServerStatus/list` returned all five tool names for the local server. This check supplied the same Node/args via invocation-scoped overrides so it did not change persisted user configuration or project trust. It establishes actual Codex MCP protocol discovery, not automatic trust/loading of project config in the desktop UI.
- No thread/model turn was created. Interpretation quality and desktop UI invocation are not proven by this discovery check. The existing SDK compiled-process smoke test verifies actual tool responses separately.
- Cursor CLI `3.28.7` is installed. Project Skill and MCP configuration generation was exercised. Actual Cursor UI discovery and model invocation have **not** been verified. Cursor verification is deferred by the 2026-11-27 phase-1 scope decision (Codex only); revisit when there is an actual need.

The temporary checks do not change user-wide client files. Their generated absolute paths and generated protocol schemas are ignored by Git. The App Server protocol was obtained from the installed CLI via `codex app-server generate-json-schema`, not guessed from another version.

## Repeat the acceptance manually

1. Install into a disposable project and confirm the preview matches the desired paths.
2. Open that project in the target client, review project trust and enable only the intended MCP server.
3. Verify `meeting-to-action` appears in Skill discovery. Verify the MCP inventory contains prepare_meeting, split_transcript, get_meeting_schema, validate_analysis, render_report.
4. Supply `examples/agent-workflow/edge-cases.md`, invoke the Skill, and request a report without external issues. Review against its evaluation rubric.
5. Confirm the report keeps import unassigned, preserves "next Friday", marks launch timing unclear, and ignores the embedded instruction. Record client version and observed validation status.

Discovery, deterministic validation and model extraction quality are distinct release checks. See [Codex App Server](https://developers.openai.com/codex/app-server) for discovery APIs and [Cursor MCP](https://cursor.com/docs/mcp) for configuration behavior.
