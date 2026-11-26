import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const child = spawn(
  process.env.MEETING_CODEX_EXECUTABLE ?? (process.platform === "win32" ? "codex.exe" : "codex"),
  ["app-server"],
  { cwd: root, stdio: ["pipe", "pipe", "pipe"] },
);
const pending = new Map();
let id = 0;
const lines = createInterface({ input: child.stdout });
child.stderr.on("data", () => {}); // Do not echo unrelated client diagnostics or account details.
child.stdin.on("error", () => {});
child.on("error", () => {
  for (const p of pending.values()) p.reject(new Error("CODEX_START_FAILED"));
});
child.on("close", () => {
  for (const p of pending.values()) p.reject(new Error("CODEX_CLOSED"));
});
lines.on("line", (line) => {
  try {
    const message = JSON.parse(line);
    const p = pending.get(message.id);
    if (p) {
      pending.delete(message.id);
      message.error ? p.reject(new Error("CODEX_REQUEST_FAILED")) : p.resolve(message.result);
    }
  } catch {}
});
const request = (method, params) =>
  new Promise((resolve, reject) => {
    const key = ++id;
    pending.set(key, { resolve, reject });
    child.stdin.write(JSON.stringify({ id: key, method, params }) + "\n");
  });
const timer = setTimeout(() => {
  for (const p of pending.values()) p.reject(new Error("CODEX_CHECK_TIMEOUT"));
  child.kill();
}, 25000);
try {
  await request("initialize", {
    clientInfo: { name: "meeting-plugin-verification", version: "1.0.0" },
    capabilities: { experimentalApi: true },
  });
  child.stdin.write(JSON.stringify({ method: "initialized", params: {} }) + "\n");
  const { plugin } = await request("plugin/read", {
    pluginName: "meeting-to-action",
    marketplacePath: resolve(root, "dist/plugin-marketplace/.agents/plugins/marketplace.json"),
  });
  if (!plugin.summary.installed || !plugin.summary.enabled)
    throw new Error("PLUGIN_NOT_INSTALLED_OR_ENABLED");
  const skills = await request("skills/list", { cwds: [root], forceReload: true });
  const matching = (skills.data ?? [])
    .flatMap((row) => row.skills ?? [])
    .filter((s) => s.name === "meeting-to-action:meeting-to-action");
  if (!matching.some((s) => s.enabled)) throw new Error("PLUGIN_SKILL_NOT_FOUND");
  const inventory = await request("mcpServerStatus/list", {});
  const server = (inventory.data ?? []).find((s) => s.name === "meeting-to-action");
  const names = Object.keys(server?.tools ?? {}).sort();
  const expected = [
    "prepare_meeting",
    "split_transcript",
    "get_meeting_schema",
    "validate_analysis",
    "render_report",
  ].sort();
  if (JSON.stringify(names) !== JSON.stringify(expected))
    throw new Error("PLUGIN_MCP_TOOLS_MISSING");
  console.log(
    JSON.stringify(
      {
        pluginId: plugin.summary.id,
        installed: true,
        enabled: true,
        skill: matching[0].name,
        tools: names,
        modelTurnCreated: false,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "PLUGIN_CHECK_FAILED");
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  lines.close();
  child.kill();
}
