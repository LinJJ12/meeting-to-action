import {
  MeetingAnalysisSchema,
  type EvidenceRef,
  type MeetingAnalysis,
  type MeetingInput,
} from "../domain/schema.js";
import { buildAnalysisMessages } from "./prompt.js";
import { buildEvidenceIndex, validateEvidenceWithIndex } from "./evidence.js";
import type { AnalysisProvider } from "../providers/types.js";
import { ZodError } from "zod";

const DraftSchema = MeetingAnalysisSchema.omit({
  schemaVersion: true,
  meetingId: true,
  generatedAt: true,
});

const DEFAULT_RETRIES = 1;
const MAX_RETRIES = 5;
const MAX_ECHO_CHARS = 8000;
/** 防御异常/恶意响应：平衡花括号扫描最多收集这么多个候选。 */
const MAX_BRACE_CANDIDATES = 500;
/**
 * 平衡花括号扫描的字符预算。逐起点扫描在「候选稀少」时是平方级的：一次 8 MiB
 * 的病态模型响应（例如几百万个未闭合的 "{"）会退化成数万亿次字符比较，把进程
 * 挂起数小时。预算把总工作量钳在约一次线性扫描（8 MiB 响应 ≈ 8.4e6 字符），
 * 超限即停——真实的 JSON 一定在输出前部，不值得为尾部可能存在的候选扫完全文；
 * 前导诱饵在预算内的正常响应（数千个 decoy 花括号）仍能完整恢复。
 */
const MAX_BRACE_SCAN_CHARS = 8_000_000;

/** JSON 提取全部失败时使用；带上尝试过的候选数量，便于定位模型输出问题。 */
class JsonExtractionError extends Error {
  constructor(readonly attempts: number) {
    super(`no parseable JSON object found (tried ${attempts} candidate(s))`);
    this.name = "JsonExtractionError";
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** 收集任意位置的 Markdown 代码围栏内容；```json 与无语言标签的围栏优先，其余排后。 */
function fenceCandidates(text: string): string[] {
  const fences: { label: string; body: string }[] = [];
  for (const match of text.matchAll(/```[ \t]*([A-Za-z0-9_+-]*)[ \t]*\r?\n([\s\S]*?)```/g)) {
    fences.push({ label: (match[1] ?? "").trim().toLowerCase(), body: match[2] ?? "" });
  }
  const preferred = fences.filter((fence) => fence.label === "json" || fence.label === "");
  const rest = fences.filter((fence) => fence.label !== "json" && fence.label !== "");
  return [...preferred, ...rest].map((fence) => fence.body);
}

/** 扫描全文所有平衡花括号子串作为候选；单个候选解析失败不影响后续候选。 */
function balancedBraceCandidates(text: string): string[] {
  if (!text.includes("}")) return [];
  const candidates: string[] = [];
  let budget = MAX_BRACE_SCAN_CHARS;
  outer: for (
    let start = 0;
    start < text.length && candidates.length < MAX_BRACE_CANDIDATES;
    start++
  ) {
    if (text[start] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let cursor = start; cursor < text.length; cursor++) {
      // 预算统计所有起点的累计扫描步数；耗尽即整体放弃，而不是让单个病态响应吃满 CPU。
      if (--budget < 0) break outer;
      const char = text[cursor]!;
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{") depth++;
      else if (char === "}") {
        depth--;
        if (depth === 0) {
          candidates.push(text.slice(start, cursor + 1));
          break;
        }
      }
    }
  }
  return candidates;
}

/** 模型返回的 JSON 可能被 Markdown 围栏或说明文字包住；这里做一次容错提取。 */
function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const candidates = fenceCandidates(text);
  if (trimmed) candidates.push(trimmed);
  candidates.push(...balancedBraceCandidates(text));

  let attempts = 0;
  for (const candidate of candidates) {
    attempts++;
    try {
      const parsed: unknown = JSON.parse(candidate.trim());
      if (isJsonObject(parsed)) return parsed;
    } catch {
      // 候选无效时继续尝试下一个，而不是直接放弃整段输出
    }
  }

  throw new JsonExtractionError(attempts);
}

/** 只暴露字段路径与校验信息，不含逐字稿内容。 */
function formatZodIssue(error: ZodError): string {
  const shown = error.issues.slice(0, 5).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
  const rest = error.issues.length - shown.length;
  return shown.join("; ") + (rest > 0 ? `; (+${rest} more)` : "");
}

export interface AnalyzeOptions {
  /**
   * JSON 解析或 schema 校验失败后重试的次数，默认 1（即最多请求两次）。
   * 非有限数（NaN/±Infinity）回退默认值；有限数取整并限制在 0..5。
   */
  retries?: number;
}

function collectEvidence(analysis: MeetingAnalysis): EvidenceRef[][] {
  return [
    ...analysis.topics.map((item) => item.evidence),
    ...analysis.decisions.map((item) => item.evidence),
    ...analysis.actionItems.map((item) => item.evidence),
    ...analysis.risks.map((item) => item.evidence),
    ...analysis.openQuestions.map((item) => item.evidence),
    ...analysis.conflicts.map((item) => item.evidence),
  ];
}

/**
 * 校验模型输出里的全部 evidence 引用。
 *
 * 这里必须复用 `validateEvidence`——历史上 analyze 路径自己实现了一套近似逻辑，
 * 结果与 report / MCP 路径语义相反：它不校验 speaker/timestamp（伪造的说话人可以
 * 通过），却要求行号与 segment 边界严格相等（段内子区间被拒）。两条路径对同一份
 * 数据给出不同结论，且伪造元数据只在 analyze 路径上不被发现。
 */
export function validateAnalysisEvidence(input: MeetingInput, analysis: MeetingAnalysis): string[] {
  const errors: string[] = [];
  // 与 validateAnalysis 一致：整份分析只构建一次证据索引，避免逐条目重复扫描 segments。
  const evidenceIndex = buildEvidenceIndex(input);

  for (const [index, refs] of collectEvidence(analysis).entries()) {
    if (refs.length === 0) errors.push(`Evidence group ${index + 1} is empty`);
    errors.push(...validateEvidenceWithIndex(evidenceIndex, refs));
  }

  return errors;
}

/** 非法（非有限数 / 非数字）回退默认值；合法值取整并限制在 0..5。 */
function normalizeRetries(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_RETRIES;
  return Math.min(MAX_RETRIES, Math.max(0, Math.trunc(value)));
}

const RETRY_INSTRUCTION =
  "Your previous reply could not be parsed. Reply with exactly one JSON object and nothing else. " +
  "Do not use Markdown code fences and do not add any prose before or after the JSON.";

/** schema 校验失败时的纠正指令：明确指出第一个出错字段，要求修正后重新输出。 */
function buildSchemaCorrection(error: ZodError): string {
  const first = error.issues[0];
  const path = first && first.path.length > 0 ? first.path.join(".") : "(root)";
  const detail = first?.message ?? "schema validation failed";
  return (
    `Your previous reply was valid JSON but failed schema validation. The first problem is at "${path}": ${detail}. ` +
    `Fix the "${path}" field and reply again with exactly one JSON object and nothing else. ` +
    "Do not use Markdown code fences and do not add any prose before or after the JSON."
  );
}

/** 重试时把上一次原始输出作为 assistant 消息回显；严格 chat template 的网关不接受连续两条 user。 */
function echoPreviousCompletion(completion: string): string {
  return completion.length > MAX_ECHO_CHARS ? completion.slice(0, MAX_ECHO_CHARS) : completion;
}

export async function analyzeMeeting(
  input: MeetingInput,
  provider: AnalysisProvider,
  options: AnalyzeOptions = {},
): Promise<MeetingAnalysis> {
  const retries = normalizeRetries(options.retries);
  const baseMessages = buildAnalysisMessages(input);
  let completion = await provider.complete(baseMessages);
  let lastError: JsonExtractionError | ZodError | undefined;

  for (let attempt = 0; ; attempt++) {
    if (attempt > 0) {
      // 统一重试语义：解析失败与 schema 失败都重试，且消息序列为 system/user/assistant/user。
      const instruction =
        lastError instanceof ZodError ? buildSchemaCorrection(lastError) : RETRY_INSTRUCTION;
      completion = await provider.complete([
        ...baseMessages,
        { role: "assistant", content: echoPreviousCompletion(completion) },
        { role: "user", content: instruction },
      ]);
    }

    try {
      const json = extractJsonObject(completion);
      const draft = DraftSchema.parse(json);
      const analysis = MeetingAnalysisSchema.parse({
        schemaVersion: "1.0",
        ...draft,
        meetingId: input.meeting.id,
        generatedAt: new Date().toISOString(),
      });

      // 证据校验不重试：引用错误说明模型在编造来源，重试只会放大问题。
      const evidenceErrors = validateAnalysisEvidence(input, analysis);
      if (evidenceErrors.length > 0) {
        throw new Error("ANALYSIS_EVIDENCE_INVALID: " + evidenceErrors.join("; "));
      }

      return analysis;
    } catch (error) {
      if (error instanceof ZodError) {
        lastError = error;
        if (attempt >= retries) {
          // 模型输出结构不对，不是用户输入的问题：必须用分析类错误码，并保留字段路径。
          throw new Error("ANALYSIS_SCHEMA_INVALID: " + formatZodIssue(error), { cause: error });
        }
      } else if (error instanceof JsonExtractionError) {
        lastError = error;
        if (attempt >= retries) {
          throw new Error("ANALYSIS_INVALID_JSON: " + error.message, { cause: error });
        }
      } else {
        // 证据校验失败等非重试错误立即抛出。
        throw error;
      }
    }
  }
}
