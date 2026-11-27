[简体中文（主版）](PLUGIN-INSTALL.md) | English

# Local plugin installation and usage

This repository can package the Skill and the five MCP tools into a single-plugin upload archive and a local plugin marketplace.

## Uploading in Codex

In a Codex desktop client that supports local MCP, open "Create plugin", select `meeting-to-action-v<version>.tar.gz`, then click "Add plugin". If you already have this single-plugin archive, upload it directly. To generate it from source, run `npm ci` and `npm run plugin:build` at the repository root; the single-plugin archive is under `dist/`. Building requires system `tar`.

The legacy attachment named `meeting-to-action-marketplace-v<version>.zip` on GitHub was for local marketplace registration. Uploading that attachment to "Create plugin" triggers `Expected a single plugin archive`. If you use the legacy attachment, extract it and pass the directory containing `.agents/plugins/marketplace.json` to the `codex plugin marketplace add` command below.

Enabling the five local MCP tools requires Codex to find Node.js 20+ on its PATH. If the environment hosting the upload entry does not support local MCP, use the local marketplace installation method below.

## Prerequisites

- Node.js 20+, npm, and a Codex client that supports local plugin marketplace commands.
- Run this in a local terminal; Node must be findable from the client's PATH — the package does not bundle Node itself.
- First confirm with `codex plugin --help` that your version supports the relevant commands. Not every Codex/ChatGPT desktop version does; the browser client cannot run this local stdio bundle directly.

## Build, register, and install

From the repository root:

```sh
npm ci
npm run plugin:build
codex plugin marketplace add ./dist/plugin-marketplace
codex plugin add meeting-to-action@meeting-to-action-local
```

`plugin:build` builds `dist/plugin-marketplace/` and the single-plugin upload archive from `skills/meeting-to-action/`, `src/mcp/`, and `plugin/`. The plugin contains the manifests, the MCP configuration, the Skill, a standalone server bundle, and third-party license information. The marketplace directory additionally contains the marketplace manifest.

Two things to know:

- The build **empties** the output directory first, so leftovers from a previous round never mix into the new artifacts.
- In the generated `mcp.json`, `command` stays a bare `node`, resolved by the client from its PATH. This is **not** an omission — it is a compatibility requirement: the Codex app-server will not start a command using an absolute path (drive letter or path separators); in testing that led to a successfully installed plugin whose five MCP tools were invisible. The runtime environment must therefore be able to resolve `node`.

The registration and installation commands modify the current user's client configuration and plugin cache; run them under the account where you intend to use the plugin. If your CLI does not support these subcommands, use the client's local plugin installation entry, or choose [project-level Skill + MCP installation](CLIENT-SETUP.en.md). Do not treat missing subcommands as a build failure.

## Confirm the client loaded it

```sh
codex plugin list --marketplace meeting-to-action-local --json
npm run plugin:check-installed
```

The listing should show the plugin installed and enabled. The check script starts a fresh local Codex App Server and confirms the installed status, the enabled namespaced Skill, and the five MCP tools; it creates no model tasks and calls no model API. The script uses `dist/plugin-marketplace/.agents/plugins/marketplace.json` from the current checkout, so build and register that path first. Use `MEETING_CODEX_EXECUTABLE` to point at a specific Codex executable.

If the check fails, verify the CLI version, the registered path, the plugin's enabled state, the Node PATH, and any project/organization policies. A restricted sandbox may be unable to read the user cache; retry in a normal terminal. A failed check does not by itself prove the installed files are gone, and security settings should not be disabled over it.

When the desktop client has not refreshed, save your work, fully quit and reopen it, then start a new local chat. Look for Meeting-to-Action in the available plugin/Skill selection entries; the exact entry depends on the client version. Restarting does not substitute for registration and installation.

## First use

In a project using this repository, start a new chat and request:

```text
Please use Meeting-to-Action to analyze examples/agent-workflow/edge-cases.md.
Validate evidence via the plugin's MCP tools and generate a Markdown report saved as edge-cases.report.md.
Keep owners and dates unknown when uncertain, preserve contradictions. Do not create GitHub issues.
```

The result should contain minutes organized by topic, a consolidated to-do list, and a trace appendix. The import task remains unclaimed, Jo's deadline stays `next Friday`, the launch dispute can be traced back to the original text, and the instruction at the end of the transcript is treated as data. Compare with the [generated sample minutes](../../examples/agent-workflow/minutes.md). Tool discovery, programmatic validation, and model interpretation quality must each be verified separately.

## Updates and cleanup

Source changes do not automatically update what a client has already installed. The version's single source is `APP_VERSION` in `src/version.ts`: maintainers run `node scripts/version-sync.mjs <version>` to sync all manifests and rebuild (`tests/version-consistency.test.ts` guards the alignment); users update or reinstall in the client, then start a new session and check. The data contract `schemaVersion` is independent of the package version and maintained separately.

The local marketplace registration references `dist/plugin-marketplace/`; keep that path present. Do not wipe dist while the marketplace is still in use; after cleaning, rebuild first. Moving the checkout also requires updating the registration path. To uninstall the plugin or remove the marketplace, use the current client's management entry or the commands listed in its help; deleting the source directory is not an uninstall.

## Verification scope

Repository tests cover plugin building inside isolated temporary directories, startup without node_modules, and tool requests. A maintainer verified installation status and Skill/tool discovery on Windows with Codex CLI 0.171.0-alpha.13 on 2026-11-24; that is a record for one specific environment only — it does not mean other users have it installed, nor does it guarantee compatibility with other versions. Desktop UI and real model analysis quality need separate acceptance; Cursor plugin compatibility is deferred by the 2026-11-27 scope decision and is outside the current acceptance scope.

The plugin has no file read/write, network access, or automatic issue creation MCP features; files are read and saved by the host. Local tools do not imply the host model is offline; meeting privacy still depends on the chosen assistant and its model configuration. This flow is for local distribution only and never auto-publishes to a public marketplace or other accounts.
