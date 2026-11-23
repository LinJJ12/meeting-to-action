import {
  MeetingAnalysisSchema,
  type EvidenceRef,
  type MeetingAnalysis,
  type MeetingInput,
} from "../domain/schema.js";
import { buildAnalysisMessages } from "./prompt.js";
import type { AnalysisProvider } from "../providers/types.js";

const DraftSchema = MeetingAnalysisSchema.omit({ meetingId: true, generatedAt: true });

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
