import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setupProject, planSetup, applySetup } from "../src/integrations/setup.js";

const setupEntry = resolve("src/setup.ts");

/** 与 setup.test.ts 相同的最小 runtime fixture；额外断言失败后目录无新增。 */
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "meeting-setup-preflight-"));
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

function runSetup(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", setupEntry, ...args], {
    encoding: "utf8",
    timeout: 20_000,
  });
}

/** 断言拒绝原因是精确的稳定码，且 message 不回显用户路径。 */
async function expectSetupError(
  promise: Promise<unknown>,
  code: string,
  secret?: string,
): Promise<void> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe(code);
  if (secret) expect((error as Error).message).not.toContain(secret);
}

describe("setupProject --project preflight", () => {
  it("不存在的 project 目录以 SETUP_PROJECT_INVALID 拒绝，而不是裸 ENOENT", async () => {
    const f = await fixture();
    try {
      const missing = join(f.root, "does-not-exist");
      await expectSetupError(
        setupProject({ client: "cursor", project: missing, runtime: f.runtime }),
        "SETUP_PROJECT_INVALID",
        missing,
      );
      expect(await readdir(f.root)).toEqual(["project space 中文", "runtime"]);
    } finally {
      await rm(f.root, { recursive: true, force: true });
    }
  });

  it("project 路径是普通文件时同样以 SETUP_PROJECT_INVALID 拒绝", async () => {
    const f = await fixture();
    try {
      const file = join(f.root, "not-a-directory.txt");
      await writeFile(file, "blocker");
      await expectSetupError(
        setupProject({ client: "codex", project: file, runtime: f.runtime }),
        "SETUP_PROJECT_INVALID",
        file,
      );
    } finally {
      await rm(f.root, { recursive: true, force: true });
    }
  });

  it("CLI 对不存在的 project 只输出稳定码到 stderr，exit 1 且不创建目录", async () => {
    const f = await fixture();
    try {
      const missing = join(f.root, "missing-project");
      const result = runSetup(["--client", "cursor", "--project", missing]);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr.trim()).toBe("SETUP_PROJECT_INVALID");
      expect(result.stderr).not.toContain(missing);
      expect(await readdir(f.root)).toEqual(["project space 中文", "runtime"]);
    } finally {
      await rm(f.root, { recursive: true, force: true });
    }
  }, 20_000);
});

describe("setupProject 目标路径预检", () => {
  it(".cursor 是普通文件时预览即拒绝，apply 也不写任何文件", async () => {
    const f = await fixture();
    try {
      await writeFile(join(f.project, ".cursor"), "blocker");
      for (const apply of [false, true]) {
        await expectSetupError(
          setupProject({ client: "cursor", project: f.project, runtime: f.runtime, apply }),
          "SETUP_CONFLICT",
          f.project,
        );
      }
      expect(await readdir(f.project)).toEqual([".cursor"]);
      expect(await readFile(join(f.project, ".cursor"), "utf8")).toBe("blocker");
    } finally {
      await rm(f.root, { recursive: true, force: true });
    }
  });

  it(".codex 是普通文件时预览即拒绝，不创建 .agents", async () => {
    const f = await fixture();
    try {
      await writeFile(join(f.project, ".codex"), "blocker");
      for (const apply of [false, true]) {
        await expectSetupError(
          setupProject({ client: "codex", project: f.project, runtime: f.runtime, apply }),
          "SETUP_CONFLICT",
          f.project,
        );
      }
      expect(await readdir(f.project)).toEqual([".codex"]);
      expect(await readFile(join(f.project, ".codex"), "utf8")).toBe("blocker");
    } finally {
      await rm(f.root, { recursive: true, force: true });
    }
  });

  it("目标文件已存在且内容不同时以 SETUP_CONFLICT 拒绝且零写入", async () => {
    const f = await fixture();
    try {
      await mkdir(join(f.project, ".cursor"));
      const existing = join(f.project, ".cursor", "mcp.json");
      await writeFile(existing, '{"existing":true}');
      for (const apply of [false, true]) {
        await expectSetupError(
          setupProject({ client: "cursor", project: f.project, runtime: f.runtime, apply }),
          "SETUP_CONFLICT",
          f.project,
        );
      }
      expect(await readdir(join(f.project, ".cursor"))).toEqual(["mcp.json"]);
      expect(await readFile(existing, "utf8")).toBe('{"existing":true}');
    } finally {
      await rm(f.root, { recursive: true, force: true });
    }
  });

  it("配置目标被同名目录占用时以 SETUP_CONFLICT 拒绝", async () => {
    const f = await fixture();
    try {
      await mkdir(join(f.project, ".cursor", "mcp.json"), { recursive: true });
      for (const apply of [false, true]) {
        await expectSetupError(
          setupProject({ client: "cursor", project: f.project, runtime: f.runtime, apply }),
          "SETUP_CONFLICT",
          f.project,
        );
      }
      expect(await readdir(f.project)).toEqual([".cursor"]);
      expect(await readdir(join(f.project, ".cursor"))).toEqual(["mcp.json"]);
      expect(await readdir(join(f.project, ".cursor", "mcp.json"))).toEqual([]);
    } finally {
      await rm(f.root, { recursive: true, force: true });
    }
  });
});

describe("setup apply 失败回滚", () => {
  it("中途失败时只删除本次创建的文件与目录，保留用户原有内容", async () => {
    const f = await fixture();
    try {
      // 用户原有的内容：一个已有目录和一份文件，apply 失败后必须原样保留。
      await mkdir(join(f.project, ".agents"));
      await writeFile(join(f.project, ".agents", "keep.txt"), "keep");
      const preview = await planSetup({
        client: "codex",
        project: f.project,
        runtime: f.runtime,
      });
      expect(preview.plan.files.map((file) => file.status)).toEqual(
        preview.plan.files.map(() => "create"),
      );
      // 预览通过后、apply 前，配置父目录被外部占成普通文件 —— apply 会写到第 N 个文件才失败。
      await writeFile(join(f.project, ".codex"), "blocker");
      await expectSetupError(applySetup(preview), "SETUP_CONFLICT", f.project);
      expect((await readdir(f.project)).sort()).toEqual([".agents", ".codex"]);
      expect(await readdir(join(f.project, ".agents"))).toEqual(["keep.txt"]);
      expect(await readFile(join(f.project, ".agents", "keep.txt"), "utf8")).toBe("keep");
      expect(await readFile(join(f.project, ".codex"), "utf8")).toBe("blocker");
    } finally {
      await rm(f.root, { recursive: true, force: true });
    }
  });
});
