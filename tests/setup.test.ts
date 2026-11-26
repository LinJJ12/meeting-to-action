import { it, expect } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setupProject } from "../src/integrations/setup.js";
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "meeting-setup-"));
  const project = join(root, "project space 中文"),
    runtime = join(root, "runtime");
  await mkdir(project);
  await mkdir(join(runtime, "dist", "mcp"), { recursive: true });
  await writeFile(join(runtime, "dist", "mcp", "server.js"), "");
  await mkdir(join(runtime, "skills", "meeting-to-action", "references"), { recursive: true });
  await writeFile(join(runtime, "skills", "meeting-to-action", "SKILL.md"), "skill");
  await writeFile(join(runtime, "skills", "meeting-to-action", "references", "rules.md"), "rules");
  return { root, project, runtime };
}
it("previews without writes, installs both clients and repeats safely", async () => {
  const f = await fixture();
  try {
    for (const client of ["codex", "cursor"] as const) {
      const options = { client, project: f.project, runtime: f.runtime };
      expect((await setupProject(options)).applied).toBe(false);
      const before = await readdir(f.project);
      if (client === "codex") expect(before).toEqual([]);
      expect((await setupProject({ ...options, apply: true })).applied).toBe(true);
      expect(
        (await setupProject({ ...options, apply: true })).files.every(
          (x) => x.status === "unchanged",
        ),
      ).toBe(true);
      const folder = client === "codex" ? ".agents" : ".cursor";
      expect(
        await readFile(
          join(f.project, folder, "skills", "meeting-to-action", "references", "rules.md"),
          "utf8",
        ),
      ).toBe("rules");
      if (client === "cursor") {
        const config = JSON.parse(await readFile(join(f.project, ".cursor", "mcp.json"), "utf8"));
        expect(config.mcpServers["meeting-to-action"].args[0]).toContain("server.js");
      }
    }
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
it("preserves existing config and performs no partial writes on conflict", async () => {
  const f = await fixture();
  try {
    await mkdir(join(f.project, ".cursor"));
    const path = join(f.project, ".cursor", "mcp.json");
    await writeFile(path, '{"existing":true}');
    await expect(setupProject({ ...f, client: "cursor", apply: true })).rejects.toThrow(/CONFLICT/);
    expect(await readFile(path, "utf8")).toBe('{"existing":true}');
    expect(await readdir(join(f.project, ".cursor"))).toEqual(["mcp.json"]);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
it("rejects redirected client directories", async () => {
  const f = await fixture();
  try {
    const outside = join(f.root, "outside");
    await mkdir(outside);
    await symlink(
      resolve(outside),
      join(f.project, ".cursor"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await expect(setupProject({ ...f, client: "cursor", apply: true })).rejects.toThrow(/LINK/);
    expect(await readdir(outside)).toEqual([]);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
