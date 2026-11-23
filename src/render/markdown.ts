import type { EvidenceRef, MeetingAnalysis } from "../domain/schema.js";

const cell = (value?: string) => (value ?? "TBD").replaceAll("|", "\\|").replace(/\r?\n/g, " ");
const evidence = (refs: EvidenceRef[]) => refs.map((ref) => {
  const location = ref.lineStart && ref.lineEnd ? "lines " + ref.lineStart + "-" + ref.lineEnd : ref.segmentId ?? "source";
  const quote = ref.quote ? " — “" + cell(ref.quote) + "”" : "";
  return "  - " + ref.sourceId + " / " + (ref.segmentId ?? "unknown") + " (" + location + ")" + quote;
});

export function renderMarkdown(data: MeetingAnalysis): string {
  const lines = [
    "# Meeting report: " + data.meetingId, "",
    "## Summary",
    ...(data.summary.length ? data.summary.map((item) => "- " + item) : ["- No summary supplied."]),
    "", "## Topics",
    ...(data.topics.length ? data.topics.flatMap((item) => ["### " + item.title, item.summary, ...evidence(item.evidence), ""]) : ["- None extracted.", ""]),
    "## Decisions",
    ...(data.decisions.length ? data.decisions.flatMap((item) => [
      "- **[" + item.status + "]** " + item.statement + " (confidence: " + item.confidence + ")",
      ...evidence(item.evidence),
    ]) : ["- None extracted."]),
    "", "## Action items",
    "| Task | Owner | Deadline | Status | Confidence |", "|---|---|---|---|---|",
    ...(data.actionItems.length ? data.actionItems.map((item) =>
      "| " + cell(item.title) + " | " + cell(item.assignee) + " | " + cell(item.dueDate) + " | " + item.status + " | " + item.confidence + " |") : ["| None extracted | — | — | — | — |"]),
    ...data.actionItems.flatMap((item) => ["- **" + item.title + "** evidence:", ...evidence(item.evidence)]),
    "", "## Risks",
    ...(data.risks.length ? data.risks.flatMap((item) => ["- **[" + item.severity + "]** " + item.description, ...evidence(item.evidence)]) : ["- None extracted."]),
    "", "## Open questions",
    ...(data.openQuestions.length ? data.openQuestions.flatMap((item) => ["- " + item.question, ...evidence(item.evidence)]) : ["- None extracted."]),
    "", "## Conflicts",
    ...(data.conflicts.length ? data.conflicts.flatMap((item) => ["- " + item.description, ...evidence(item.evidence)]) : ["- None extracted."]),
    "", "_Generated: " + data.generatedAt + "_", "",
  ];
  return lines.join("\n");
}
