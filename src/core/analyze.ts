import {
  MeetingAnalysisSchema,
  type EvidenceRef,
  type MeetingAnalysis,
  type MeetingInput,
} from "../domain/schema.js";
import { buildAnalysisMessages } from "./prompt.js";
import type { AnalysisProvider } from "../providers/types.js";
import { ZodError } from "zod";

const DraftSchema = MeetingAnalysisSchema.omit({ schemaVersion: true, meetingId: true, generatedAt: true });

/** 模型返回的 JSON 可能被 Markdown 围栏或说明文字包住；这里做一次容错提取。 */
function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();

  // 1) 剥掉一个 Markdown 代码围栏
  const fenced = /^```[A-Za-z0-9_-]*\s*\r?\n([\s\S]*?)\r?\n?```$/.exec(trimmed);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    // 继续尝试提取平衡对象
  }

  // 2) 从第一个 { 开始，按括号深度找第一个平衡的 JSON 对象
  const start = candidate.indexOf("{");
  if (start >= 0) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < candidate.length; index++) {
      const char = candidate[index]!;
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
          try {
            return JSON.parse(candidate.slice(start, index + 1));
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error("model response did not contain a JSON object");
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
  /** JSON / schema 解析失败后重试的次数，默认 1（即最多请求两次）。 */
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

export function validateAnalysisEvidence(input: MeetingInput, analysis: MeetingAnalysis): string[] {
  const segments = new Map(input.segments.map((segment) => [segment.id, segment]));
  const errors: string[] = [];

  for (const [index, refs] of collectEvidence(analysis).entries()) {
    if (refs.length === 0) errors.push(`Evidence group ${index + 1} is empty`);
    for (const ref of refs) {
      const segment = ref.segmentId ? segments.get(ref.segmentId) : undefined;
      if (!segment) {
        errors.push(`Unknown or missing segmentId: ${ref.segmentId ?? "(missing)"}`);
        continue;
      }
      if (segment.sourceId !== ref.sourceId) errors.push(`sourceId mismatch for ${ref.segmentId}`);
      if (segment.lineStart !== ref.lineStart || segment.lineEnd !== ref.lineEnd) {
        errors.push(`Line range mismatch for ${ref.segmentId}`);
      }
      if (ref.quote && !segment.text.includes(ref.quote)) {
        errors.push(`Evidence quote is not an exact substring of ${ref.segmentId}`);
      }
    }
  }

  return errors;
}

const RETRY_INSTRUCTION =
  "Your previous reply could not be parsed. Reply with exactly one JSON object and nothing else. " +
  "Do not use Markdown code fences and do not add any prose before or after the JSON.";

export async function analyzeMeeting(
  input: MeetingInput,
  provider: AnalysisProvider,
  options: AnalyzeOptions = {},
): Promise<MeetingAnalysis> {
  const retries = Math.max(0, options.retries ?? 1);
  const messages = buildAnalysisMessages(input);

  let completion = await provider.complete(messages);
  let json: unknown;
  for (let attempt = 0; ; attempt++) {
    try {
      json = extractJsonObject(completion);
      break;
    } catch (error) {
      if (attempt >= retries) {
        throw new Error("ANALYSIS_INVALID_JSON: model response was not valid JSON", { cause: error });
      }
      completion = await provider.complete([...messages, { role: "user", content: RETRY_INSTRUCTION }]);
    }
  }

  let analysis: MeetingAnalysis;
  try {
    const draft = DraftSchema.parse(json);
    analysis = MeetingAnalysisSchema.parse({
      schemaVersion: "1.0",
      ...draft,
      meetingId: input.meeting.id,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      // 模型输出结构不对，不是用户输入的问题：必须用分析类错误码，并保留字段路径。
      throw new Error("ANALYSIS_SCHEMA_INVALID: " + formatZodIssue(error), { cause: error });
    }
    throw error;
  }

  const evidenceErrors = validateAnalysisEvidence(input, analysis);
  if (evidenceErrors.length > 0) {
    throw new Error("ANALYSIS_EVIDENCE_INVALID: " + evidenceErrors.join("; "));
  }

  return analysis;
}