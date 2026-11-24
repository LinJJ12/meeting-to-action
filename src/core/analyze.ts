import {
  MeetingAnalysisSchema,
  type EvidenceRef,
  type MeetingAnalysis,
  type MeetingInput,
} from "../domain/schema.js";
import { buildAnalysisMessages } from "./prompt.js";
import { validateEvidence } from "./evidence.js";
import type { AnalysisProvider } from "../providers/types.js";

const DraftSchema = MeetingAnalysisSchema.omit({ schemaVersion: true, meetingId: true, generatedAt: true });

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

  for (const [index, refs] of collectEvidence(analysis).entries()) {
    if (refs.length === 0) errors.push(`Evidence group ${index + 1} is empty`);
    errors.push(...validateEvidence(input, refs));
  }

  return errors;
}

export async function analyzeMeeting(
  input: MeetingInput,
  provider: AnalysisProvider,
): Promise<MeetingAnalysis> {
  const completion = await provider.complete(buildAnalysisMessages(input));
  let json: unknown;
  try {
    json = JSON.parse(completion);
  } catch (error) {
    throw new Error("ANALYSIS_INVALID_JSON: model response was not valid JSON", { cause: error });
  }

  const draft = DraftSchema.parse(json);
  const analysis = MeetingAnalysisSchema.parse({
    schemaVersion: "1.0",
    ...draft,
    meetingId: input.meeting.id,
    generatedAt: new Date().toISOString(),
  });

  const evidenceErrors = validateAnalysisEvidence(input, analysis);
  if (evidenceErrors.length > 0) {
    throw new Error("ANALYSIS_EVIDENCE_INVALID: " + evidenceErrors.join("; "));
  }

  return analysis;
}
