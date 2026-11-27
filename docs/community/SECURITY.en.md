[简体中文（主版）](../../SECURITY.md) | English

# Security Policy

## Scope

This policy covers all local components shipped from this repository:

- the stdio MCP server (`src/mcp/`, `dist/mcp/server.js`)
- the CLI (`inspect` / `report` / `analyze`)
- the project-level installer `setup:client`
- plugin packaging and local marketplace artifacts (output of `scripts/build-plugin.mjs`)

## Reporting a vulnerability

**Please do not report security issues through public issues** — public details could be exploited before users have patched.

Use GitHub's private vulnerability reporting:

1. Open the repository's **Security** tab → **Report a vulnerability**.
2. If that entry point is unavailable, contact the maintainer [@LinJJ12](https://github.com/LinJJ12) via a private GitHub message.

Private vulnerability reporting is available for **public repositories** only: once the repository is public, maintainers set **Private vulnerability reporting** to Enable on the repository's Code security (shown as Advanced Security in some UI versions) settings page. Not seeing the toggle on a private repository is expected.

### Please include in the report

- The affected component and version (`npm run dev -- --version` or the plugin version)
- Reproduction steps; a minimal reproducing input is ideal
- The observed behavior versus the expected behavior

### Privacy red line

- **Reports must never contain real meeting content, personal information, or credentials.**
- Reproduce issues using the repository's fictional samples (`examples/sample-meeting.md`, `examples/agent-workflow/`).

## Response expectations

- This project is maintained by an individual maintainer in their spare time. We aim to acknowledge reports and give an initial assessment within 7 days, but a 24/7 response cannot be promised.
- Confirmed issues are scheduled for fixes by severity; fixes are recorded in the [CHANGELOG](CHANGELOG.en.md), with credit to the reporter if they agree.

## Security design baseline

The product's security and privacy design principles (local stdio, no network listeners, no persistence, no raw transcript text in logs by default) are documented in [docs/SECURITY.md](../contracts/SECURITY.md); the authoritative description of tool boundaries is [docs/MCP.en.md](../guides/MCP.en.md). Those principles are design commitments, not vulnerabilities; suggestions about them belong in ordinary issues as feature discussions.
