import { config as loadEnvConfig } from "dotenv";
import { validateAnalysis } from "./core/analysis.js";
import { validateMinutes } from "./core/minutes.js";
import { MeetingInputSchema } from "./domain/schema.js";
import type { MinutesDocument } from "./domain/minutes.js";
import { readFile, stat, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { normalizeTranscript } from "./core/normalize.js";
import { analyzeMeeting } from "./core/analyze.js";
import { renderMarkdown } from "./render/markdown.js";
import {
  isReadingMode,
  renderMinutesDocument,
  resolveReadingMode,
  type ReadingMode,
} from "./render/minutes.js";
import { OpenAICompatibleProvider } from "./providers/openai-compatible.js";
import { ProviderError } from "./providers/types.js";
import {
  MAX_ANALYSIS_BYTES,
  MAX_CONTENT_BYTES,
  MAX_SEGMENTS,
  assertMeetingInputWithinLimits,
} from "./core/limits.js";
import { assertSafePathForm } from "./core/path-guard.js";
import { describeZodError } from "./core/zod-detail.js";

// 本仓库没有 npm bin：示例用真实可执行的入口（源码 `npm run dev --`，构建后 `node dist/cli.js`）。
const USAGE = [
  "Usage:",
  "  from source: npm run dev -- <command>; built CLI: node dist/cli.js <command>",
  "  npm run dev -- --version",
  "  npm run dev -- inspect <transcript.txt|transcript.md> [--out normalized.json]",
  "  npm run dev -- analyze <transcript.txt|transcript.md> [--env <path>] [--out report.md]",
  "  npm run dev -- report <normalized.json> --analysis <analysis.json> [--minutes <minutes.json>] [--mode minutes|actions|evidence] [--no-appendix] [--out report.md]",
  "",
  "Report modes:",
  "  with --minutes, the default mode is minutes; without it, the evidence report is rendered.",
  "  --no-appendix omits the trace appendix from minutes output (the appendix is on by default).",
  "",
  "Environment for analyze:",
  "  --env <path>  load environment variables from an explicit file (default: none).",
  "                     The CLI never reads a .env from the working directory implicitly.",
  "  OPENAI_API_KEY (required)",
  "  OPENAI_MODEL (required)",
  "  OPENAI_BASE_URL (optional; defaults to https://api.openai.com/v1; must be https unless it",
  "                   points at localhost/127.0.0.1/[::1], or OPENAI_ALLOW_INSECURE=1 is set)",
  "  OPENAI_TIMEOUT_MS (optional; defaults to 60000)",
  "  OPENAI_ALLOW_INSECURE (optional; set 1 to allow plain http endpoints other than loopback)",
  "  OPENAI_VERBOSE_ERRORS (optional; set 1 to include a best-effort redacted provider error excerpt; may still contain sensitive content)",
].join("\n");

function usage(): never {
  console.error(USAGE);
  process.exit(2);
}

/** 非法 --mode 取值是参数错误：打印用法并 exit 1（其他结构性用法错误保持 exit 2）。 */
function invalidMode(value: string): never {
  console.error("Unsupported --mode value: " + value + "\n\n" + USAGE);
  process.exit(1);
}

const argv = process.argv.slice(2);
const wantsVersion = argv.includes("--version") || argv.includes("-v");
// --version 是短路的成功路径，但只接受单独出现：混进其他参数说明调用方期望
// 做别的事却拿了版本号，按用法错误处理，避免脚本静默成功。
if (wantsVersion && argv.length !== 1) usage();
const [command, input, ...args] = argv;
if (wantsVersion) {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8").replace(/^\uFEFF/, ""),
  ) as { version?: string };
  console.log(pkg.version ?? "0.0.0");
  process.exit(0);
}
if (!command || !input || !["inspect", "analyze", "report"].includes(command)) usage();

let outputPath: string | undefined;
let analysisPath: string | undefined;
let minutesPath: string | undefined;
let modeOption: ReadingMode | undefined;
let envPath: string | undefined;
let appendix = true;
const seen = new Set<string>();
for (let index = 0; index < args.length; index++) {
  const key = args[index]!;
  if (seen.has(key)) usage();
  seen.add(key);
  if (key === "--no-appendix") {
    if (command !== "report") usage();
    appendix = false;
    continue;
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--")) usage();
  index++;
  if (key === "--out") outputPath = value;
  else if (command === "report" && key === "--analysis") analysisPath = value;
  else if (command === "report" && key === "--minutes") minutesPath = value;
  else if (command === "report" && key === "--mode") {
    if (!isReadingMode(value)) invalidMode(value);
    modeOption = value;
  } else if (command === "analyze" && key === "--env") envPath = value;
  else usage();
}
if (command === "report" && !analysisPath) usage();
// --out 是用户显式传入的输出路径，但 UNC/设备命名空间/ADS 形态可能触发 SMB 出站
// 认证或设备访问（如误抄了不可信文档里的命令）：按形态在触碰文件系统前拒绝。
// 正常的本地相对/绝对路径不受影响。
if (outputPath !== undefined) {
  try {
    assertSafePathForm(outputPath, "OUT_PATH_INVALID");
  } catch {
    const clipped = outputPath.length > 120 ? outputPath.slice(0, 120) + "…" : outputPath;
    console.error(
      "OUT_PATH_INVALID: unsupported output path (network, device namespace, drive-relative and alternate-data-stream forms are rejected): " +
        clipped,
    );
    process.exit(1);
  }
}
// 环境变量只在 analyze 显式给 --env 时从文件加载：工作目录里的 .env 可能来自
// 不可信 clone，隐式加载会把逐字稿发到攻击者配置的端点（README 历史上推荐过复制
// .env，这个习惯必须显式化）。
if (envPath !== undefined) {
  const loaded = loadEnvConfig({ path: envPath });
  if (loaded.error) {
    console.error("CONFIG_INVALID: cannot read --env (pass a readable file path)");
    process.exit(1);
  }
}
/**
 * report 的 input/analysis/minutes 都来自本地文件：先按 stat 大小拒绝超大文件，绝不整读。
 * stat 与读取之间文件可能变化，按实际读到的 Buffer 字节数复核一次。
 * 读取/解析失败统一为 INPUT_JSON_INVALID，只说明是哪个角色，不回显宿主路径或字段值。
 */
type JsonInputRole = "input" | "analysis" | "minutes";
async function readJsonWithinLimit(
  path: string,
  maxBytes: number,
  label: string,
  role: JsonInputRole = "input",
): Promise<unknown> {
  const assertSize = (bytes: number): void => {
    if (bytes > maxBytes)
      throw new Error(`INPUT_SIZE_LIMIT: ${label} ${path} is ${bytes} bytes, limit is ${maxBytes}`);
  };
  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    throw new Error(`INPUT_JSON_INVALID: cannot read ${role} file`);
  }
  assertSize(size);
  let raw: Buffer;
  try {
    raw = await readFile(path);
  } catch {
    throw new Error(`INPUT_JSON_INVALID: cannot read ${role} file`);
  }
  assertSize(raw.byteLength);
  try {
    return JSON.parse(raw.toString("utf8").replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(`INPUT_JSON_INVALID: cannot parse ${role} file`);
  }
}
/** `--minutes` 是可选编辑稿：与 MCP 侧同口径按 2 MiB 读取，读取/解析失败统一收敛。 */
async function readMinutesJson(path: string): Promise<unknown> {
  return readJsonWithinLimit(path, MAX_CONTENT_BYTES, "minutes", "minutes");
}
function assertTranscriptSize(bytes: number, path: string): void {
  if (bytes > MAX_CONTENT_BYTES)
    throw new Error(
      `INPUT_SIZE_LIMIT: transcript ${path} is ${bytes} bytes, limit is ${MAX_CONTENT_BYTES}`,
    );
}
/** analyze 会把整份逐字稿发给模型：先按 stat 大小拒绝，超大文件永远不读进内存。inspect 属于本地查看工具，保持无上限。 */
async function readTranscriptForAnalyze(path: string): Promise<string> {
  assertTranscriptSize((await stat(path)).size, path);
  const raw = await readFile(path);
  // stat 与读取之间文件可能变化，按实际读到的 Buffer 字节数复核一次。
  assertTranscriptSize(raw.byteLength, path);
  // Windows 记事本等工具会写 UTF-8 BOM：剥掉，避免首行说话人被识别错。
  return raw.toString("utf8").replace(/^\uFEFF/, "");
}
/**
 * `--out` 用 wx 打开，绝不覆盖已有文件。目标已存在（EEXIST）或父路径不可用
 * （ENOENT/ENOTDIR）统一收敛为稳定码，只给结论不回显宿主路径。
 */
async function writeOutput(path: string, content: string): Promise<void> {
  try {
    await writeFile(path, content, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST" || code === "ENOENT" || code === "ENOTDIR")
      throw new Error("OUT_PATH_UNUSABLE: target exists or its parent directory is missing");
    throw error;
  }
}

try {
  const absoluteInput = resolve(input);
  if (command === "report") {
    const mode = resolveReadingMode(modeOption, minutesPath !== undefined);
    const meeting = MeetingInputSchema.parse(
      await readJsonWithinLimit(absoluteInput, MAX_CONTENT_BYTES, "meeting input"),
    );
    // report 不调用模型，但仍要让病态输入（段数/总文本）在渲染与证据校验前被明确拒绝。
    assertMeetingInputWithinLimits(meeting);
    const analysis = validateAnalysis(
      meeting,
      await readJsonWithinLimit(resolve(analysisPath!), MAX_ANALYSIS_BYTES, "analysis", "analysis"),
    );
    let minutes: MinutesDocument | undefined;
    if (minutesPath !== undefined)
      minutes = validateMinutes(meeting, analysis, await readMinutesJson(resolve(minutesPath)));
    const report =
      minutes === undefined
        ? renderMarkdown(analysis)
        : renderMinutesDocument(meeting, analysis, minutes, { mode, appendix });
    if (outputPath) {
      await writeOutput(resolve(outputPath), report);
      console.log("Wrote " + resolve(outputPath));
    } else process.stdout.write(report);
  } else {
    const transcript = (
      command === "analyze"
        ? await readTranscriptForAnalyze(absoluteInput)
        : await readFile(absoluteInput, "utf8")
    ).replace(/^\uFEFF/, "");
    const meeting = normalizeTranscript(
      transcript,
      basename(absoluteInput),
      command === "analyze" ? { maxSegments: MAX_SEGMENTS } : {},
    );

    let output: string;
    if (command === "inspect") {
      output = JSON.stringify(meeting, null, 2) + "\n";
    } else {
      const apiKey = process.env.OPENAI_API_KEY;
      const model = process.env.OPENAI_MODEL;
      if (!apiKey || !model) {
        throw new Error(
          "CONFIG_MISSING: set OPENAI_API_KEY and OPENAI_MODEL before running analyze",
        );
      }
      const timeout = Number(process.env.OPENAI_TIMEOUT_MS ?? "60000");
      if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 300000) {
        throw new Error(
          "CONFIG_INVALID: OPENAI_TIMEOUT_MS must be an integer between 1000 and 300000",
        );
      }
      const provider = new OpenAICompatibleProvider({
        apiKey,
        model,
        ...(process.env.OPENAI_BASE_URL ? { baseUrl: process.env.OPENAI_BASE_URL } : {}),
        timeoutMs: timeout,
        // 显式 opt-in 才放行发往非 loopback 主机的明文 http。
        ...(process.env.OPENAI_ALLOW_INSECURE === "1" ? { allowInsecureHttp: true } : {}),
        // 默认不把上游响应体带进错误：错误响应可能回显会议逐字稿。
        ...(process.env.OPENAI_VERBOSE_ERRORS === "1" ? { verboseErrors: true } : {}),
      });
      const analysis = await analyzeMeeting(meeting, provider);
      output = renderMarkdown(analysis);
    }

    if (outputPath) {
      await writeOutput(resolve(outputPath), output);
      console.log("Wrote " + resolve(outputPath));
    } else process.stdout.write(output);
  }
} catch (error) {
  // ProviderError 的 code 是稳定机器可读标识：打印出来，脚本排障时不必解析英文消息。
  if (error instanceof ProviderError) {
    console.error(error.code ? `${error.code}: ${error.message}` : error.message);
  } else {
    // Zod 错误带上第一个字段路径：宿主/脚本能直接定位，不必猜「哪个字段错了」。
    console.error(
      describeZodError(error, "INPUT_SCHEMA_INVALID") ??
        (error instanceof Error ? error.message : String(error)),
    );
  }
  process.exitCode = 1;
}
