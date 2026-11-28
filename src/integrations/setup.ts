import {
  lstat,
  readdir,
  readFile,
  realpath,
  mkdir,
  writeFile,
  unlink,
  rmdir,
  stat,
} from "node:fs/promises";
import { resolve, join, dirname, relative, sep, basename, isAbsolute } from "node:path";
import { assertSafePathForm } from "../core/path-guard.js";

export type ClientName = "codex" | "cursor";
export type SetupOptions = {
  client: ClientName;
  project: string;
  runtime: string;
  apply?: boolean;
};
export type SetupPlan = {
  client: ClientName;
  project: string;
  files: { path: string; status: "create" | "unchanged" }[];
  applied: boolean;
};
const windows = process.platform === "win32";
/** Resolve a path whose tail may not exist yet: realpath the nearest existing ancestor
 * and append the remaining segments verbatim, so junctions in the existing prefix are
 * always followed while a not-yet-created tail cannot escape through them. */
async function canonicalPath(target: string): Promise<string> {
  const tail: string[] = [];
  let current = resolve(target);
  for (;;) {
    try {
      const resolved = await realpath(current);
      return tail.length === 0 ? resolved : join(resolved, ...tail.reverse());
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") throw error;
      const parent = dirname(current);
      if (parent === current) throw new Error("SETUP_PATH_ESCAPE");
      tail.push(basename(current));
      current = parent;
    }
  }
}
/** Resolve target and prove it stays inside root after canonicalization. The lexical
 * and the real path are checked separately so `..`, junction and symlink escapes are
 * rejected independently of lstat's link flags, which differ between Node versions on
 * Windows (Node 20 reports a directory junction as not a symlink). */
export async function resolveContainedPath(root: string, target: string): Promise<string> {
  assertSafePathForm(root);
  assertSafePathForm(target);
  const resolvedRoot = resolve(root),
    resolvedTarget = resolve(target);
  const lexical = relative(resolvedRoot, resolvedTarget);
  if (lexical === ".." || lexical.startsWith(".." + sep) || isAbsolute(lexical))
    throw new Error("SETUP_PATH_ESCAPE");
  const rootReal = await realpath(resolvedRoot),
    targetReal = await canonicalPath(resolvedTarget);
  const normalize = (path: string) => (windows ? path.toLowerCase() : path);
  const canonical = relative(normalize(rootReal), normalize(targetReal));
  if (canonical === ".." || canonical.startsWith(".." + sep) || isAbsolute(canonical))
    throw new Error("SETUP_LINK_REJECTED");
  return targetReal;
}
/** Reject a destination whose existing ancestor chain is not made of directories.
 * `mkdir -p` through such a chain fails midway with raw EEXIST/ENOTDIR after earlier
 * files were already written, so the plan must never advertise those targets. */
async function assertDirectoryChain(project: string, destination: string): Promise<void> {
  const segments = relative(project, destination).split(sep);
  let current = project;
  for (const segment of segments.slice(0, -1)) {
    current = join(current, segment);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      // A missing ancestor is fine: `mkdir -p` creates the whole tail. Anything else
      // (ENOTDIR from a file earlier in the chain, EACCES, ...) means the chain cannot
      // be proven installable.
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw new Error("SETUP_CONFLICT");
    }
    if (!info.isDirectory()) throw new Error("SETUP_CONFLICT");
  }
}
/** lstat a planned destination. A missing destination is a create candidate; every
 * other inspection failure is reported as a conflict so preflight never leaks raw fs
 * errors (or paths) for targets it cannot reason about. */
async function destinationState(destination: string) {
  try {
    return await lstat(destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error("SETUP_CONFLICT");
  }
}
async function sourceFiles(
  root: string,
  prefix = "",
): Promise<{ relative: string; content: Buffer }[]> {
  const files: { relative: string; content: Buffer }[] = [];
  for (const entry of await readdir(await resolveContainedPath(root, join(root, prefix)), {
    withFileTypes: true,
  })) {
    const rel = join(prefix, entry.name),
      path = await resolveContainedPath(root, join(root, rel));
    if (entry.isSymbolicLink()) throw new Error("SETUP_LINK_REJECTED");
    if (entry.isDirectory()) files.push(...(await sourceFiles(root, rel)));
    else if (entry.isFile()) files.push({ relative: rel, content: await readFile(path) });
    else throw new Error("SETUP_SOURCE_INVALID");
  }
  return files;
}
/** Resolve the user-supplied `--project` directory. A missing path or a file at that
 * location is an installer error, never a raw fs error; the message stays the stable
 * code only so the CLI never echoes the user's absolute path. */
async function projectDirectory(candidate: string): Promise<string> {
  try {
    const project = await realpath(resolve(candidate));
    if (!(await stat(project)).isDirectory()) throw new Error("SETUP_PROJECT_INVALID");
    return project;
  } catch (error) {
    if (error instanceof Error && error.message === "SETUP_PROJECT_INVALID") throw error;
    throw new Error("SETUP_PROJECT_INVALID");
  }
}
/** The immutable install plan plus the exact file contents to write. Preview and
 * `--apply` consume this same object, so they can never disagree about what to do. */
export type SetupPreview = { plan: SetupPlan; writes: { path: string; content: Buffer }[] };
/** Build the install plan without touching the project. Every destination is validated
 * here, so a preview that reports `create` is exactly what apply will attempt. */
export async function planSetup(options: SetupOptions): Promise<SetupPreview> {
  if (!["codex", "cursor"].includes(options.client)) throw new Error("SETUP_CLIENT_INVALID");
  assertSafePathForm(options.project);
  assertSafePathForm(options.runtime);
  const project = await projectDirectory(options.project),
    runtime = await realpath(resolve(options.runtime));
  const server = await resolveContainedPath(runtime, join(runtime, "dist", "mcp", "server.js"));
  if (!(await stat(server)).isFile()) throw new Error("SETUP_BUILD_REQUIRED");
  const source = await resolveContainedPath(runtime, join(runtime, "skills", "meeting-to-action"));
  if (!(await stat(source)).isDirectory()) throw new Error("SETUP_SOURCE_INVALID");
  const files = await sourceFiles(source);
  if (!files.some((f) => f.relative === "SKILL.md")) throw new Error("SETUP_SOURCE_INVALID");
  const skillPath = join(
    project,
    options.client === "codex" ? ".agents" : ".cursor",
    "skills",
    "meeting-to-action",
  );
  const command = process.execPath.replaceAll("\\", "/"),
    args = [server.replaceAll("\\", "/")];
  const configPath = join(
    project,
    options.client === "codex" ? ".codex" : ".cursor",
    options.client === "codex" ? "config.toml" : "mcp.json",
  );
  const config =
    options.client === "codex"
      ? `[mcp_servers.meeting_to_action]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}\n`
      : JSON.stringify({ mcpServers: { "meeting-to-action": { command, args } } }, null, 2) + "\n";
  const writes = [
    ...files.map((f) => ({ path: join(skillPath, f.relative), content: f.content })),
    { path: configPath, content: Buffer.from(config) },
  ];
  const plan: SetupPlan = { client: options.client, project, files: [], applied: false };
  // Preflight every destination before any writes: an ancestor that is not a directory
  // (e.g. `.cursor` is a plain file) or an existing file with different bytes makes the
  // whole plan uninstallable, so preview and --apply fail with the same stable code
  // before a single write. Never expose existing config contents or paths.
  for (const file of writes) {
    const destination = await resolveContainedPath(project, file.path);
    await assertDirectoryChain(project, destination);
    const info = await destinationState(destination);
    if (info) {
      if (!info.isFile()) throw new Error("SETUP_CONFLICT");
      let unchanged;
      try {
        unchanged = file.content.equals(await readFile(destination));
      } catch {
        throw new Error("SETUP_CONFLICT");
      }
      if (!unchanged) throw new Error("SETUP_CONFLICT");
    }
    plan.files.push({ path: file.path, status: info ? "unchanged" : "create" });
  }
  return { plan, writes };
}
const stableSetupCode = /^SETUP_[A-Z_]+$/;
/** Apply-time failures must stay stable: raw fs errors never reach the CLI, and they are
 * mapped to the same conflict code the preflight uses whenever possible. */
function applyFailure(error: unknown): Error {
  if (error instanceof Error && stableSetupCode.test(error.message)) return error;
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code === "EEXIST" || code === "ENOTDIR" || code === "EISDIR" || code === "ENOENT")
    return new Error("SETUP_CONFLICT");
  return new Error("SETUP_APPLY_FAILED");
}
/** Create the missing tail of a directory chain, recording every directory this call
 * actually created so a later rollback can remove exactly those and nothing else. */
async function ensureDirectory(directory: string, created: string[]): Promise<void> {
  const missing: string[] = [];
  let current = directory;
  for (;;) {
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("SETUP_CONFLICT");
      const parent = dirname(current);
      if (parent === current) throw new Error("SETUP_CONFLICT");
      missing.push(current);
      current = parent;
      continue;
    }
    if (!info.isDirectory()) throw new Error("SETUP_CONFLICT");
    break;
  }
  for (const dir of missing.reverse()) {
    await mkdir(dir);
    created.push(dir);
  }
}
/** Remove exactly what this apply created, deepest first. Best effort only: a leftover
 * entry is safer than deleting anything the user already had. */
async function rollback(createdFiles: string[], createdDirs: string[]): Promise<void> {
  for (const file of [...createdFiles].reverse()) await unlink(file).catch(() => undefined);
  for (const dir of [...createdDirs].reverse()) await rmdir(dir).catch(() => undefined);
}
/** Execute a planned install. Any failure rolls back the files and directories created
 * by this call and rethrows one stable installer code, so from the outside the project
 * looks exactly as it did before the apply started. */
export async function applySetup(preview: SetupPreview): Promise<SetupPlan> {
  const createdFiles: string[] = [],
    createdDirs: string[] = [];
  try {
    for (let i = 0; i < preview.writes.length; i++) {
      if (preview.plan.files[i]!.status === "unchanged") continue;
      const file = preview.writes[i]!;
      try {
        const destination = await resolveContainedPath(preview.plan.project, file.path);
        await ensureDirectory(dirname(destination), createdDirs);
        await writeFile(destination, file.content, { flag: "wx" });
        createdFiles.push(destination);
      } catch (error) {
        throw applyFailure(error);
      }
    }
  } catch (error) {
    await rollback(createdFiles, createdDirs);
    throw error;
  }
  preview.plan.applied = true;
  return preview.plan;
}
/** Project-local setup only. Existing different files are never replaced or merged. */
export async function setupProject(options: SetupOptions): Promise<SetupPlan> {
  const preview = await planSetup(options);
  return options.apply ? applySetup(preview) : preview.plan;
}
