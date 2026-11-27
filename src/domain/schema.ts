import { z } from "zod";
export const EvidenceRefSchema = z
  .object({
    sourceId: z.string().min(1),
    segmentId: z.string().optional(),
    lineStart: z.number().int().positive().optional(),
    lineEnd: z.number().int().positive().optional(),
    speaker: z.string().optional(),
    timestamp: z.string().optional(),
    quote: z.string().min(1).optional(),
  })
  .strict();
const MeetingInputShape = z
  .object({
    schemaVersion: z.literal("1.0"),
    meeting: z
      .object({
        id: z.string().min(1),
        title: z.string().min(1),
        date: z.string().optional(),
        participants: z.array(z.string()).optional(),
        language: z.string().optional(),
      })
      .strict(),
    sources: z
      .array(
        z
          .object({
            id: z.string().min(1),
            kind: z.enum(["transcript", "notes"]),
            format: z.enum(["txt", "markdown"]),
            fileName: z.string().optional(),
            checksum: z.string().optional(),
            transcriptFormat: z
              .enum([
                "speaker-header",
                "speaker-time",
                "speaker-inline",
                "timestamp-first",
                "speaker-colon",
                "speaker-bracket",
                "mixed",
              ])
              .optional(),
          })
          .strict(),
      )
      .min(1),
    segments: z
      .array(
        z
          .object({
            id: z.string().min(1),
            sourceId: z.string().min(1),
            text: z.string().min(1),
            lineStart: z.number().int().positive(),
            lineEnd: z.number().int().positive(),
            speaker: z.string().optional(),
            timestamp: z.string().optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export const MeetingInputSchema = MeetingInputShape.superRefine((value, ctx) => {
  const sourceIds = new Set<string>(),
    segmentIds = new Set<string>(),
    segmentsBySource = new Map<string, MeetingInput["segments"]>();
  for (const source of value.sources) {
    if (sourceIds.has(source.id))
      ctx.addIssue({ code: "custom", message: "Duplicate source id: " + source.id });
    sourceIds.add(source.id);
  }
  for (const segment of value.segments) {
    if (segmentIds.has(segment.id))
      ctx.addIssue({ code: "custom", message: "Duplicate segment id: " + segment.id });
    segmentIds.add(segment.id);
    if (!sourceIds.has(segment.sourceId))
      ctx.addIssue({ code: "custom", message: "Unknown segment source: " + segment.sourceId });
    if (segment.lineEnd < segment.lineStart)
      ctx.addIssue({ code: "custom", message: "Segment lineEnd precedes lineStart" });
    const group = segmentsBySource.get(segment.sourceId);
    if (group) group.push(segment);
    else segmentsBySource.set(segment.sourceId, [segment]);
  }
  // 同一 source 的行区间必须互不重叠：段是时间线上的规范轮次，部分重叠、嵌套包含与
  // 完全相同的区间都视为非法，保证行区间寻址至多命中一个段。
  for (const [sourceId, group] of segmentsBySource) {
    let prev: MeetingInput["segments"][number] | undefined;
    for (const segment of [...group].sort(
      (a, b) => a.lineStart - b.lineStart || a.lineEnd - b.lineEnd,
    )) {
      if (prev && segment.lineStart <= prev.lineEnd)
        ctx.addIssue({
          code: "custom",
          message:
            "Overlapping segment ranges in source " +
            sourceId +
            ": " +
            prev.id +
            " and " +
            segment.id,
        });
      prev = segment;
    }
  }
});
export const MeetingAnalysisSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    meetingId: z.string().min(1),
    summary: z.array(z.string().min(1)),
    topics: z.array(
      z
        .object({
          title: z.string().min(1),
          summary: z.string().min(1),
          evidence: z.array(EvidenceRefSchema).min(1),
        })
        .strict(),
    ),
    decisions: z.array(
      z
        .object({
          id: z.string().min(1),
          statement: z.string().min(1),
          status: z.enum(["confirmed", "proposed", "rejected", "superseded", "unclear"]),
          evidence: z.array(EvidenceRefSchema).min(1),
          confidence: z.enum(["high", "medium", "low"]),
        })
        .strict(),
    ),
    actionItems: z.array(
      z
        .object({
          id: z.string().min(1),
          title: z.string().min(1),
          description: z.string().optional(),
          assignee: z.string().optional(),
          dueDate: z.string().optional(),
          status: z.enum(["proposed", "accepted", "in_progress", "done", "blocked", "unknown"]),
          evidence: z.array(EvidenceRefSchema).min(1),
          confidence: z.enum(["high", "medium", "low"]),
        })
        .strict(),
    ),
    risks: z.array(
      z
        .object({
          id: z.string().min(1),
          description: z.string().min(1),
          severity: z.enum(["low", "medium", "high", "critical", "unknown"]),
          evidence: z.array(EvidenceRefSchema).min(1),
        })
        .strict(),
    ),
    openQuestions: z.array(
      z
        .object({
          id: z.string().min(1),
          question: z.string().min(1),
          evidence: z.array(EvidenceRefSchema).min(1),
        })
        .strict(),
    ),
    conflicts: z.array(
      z
        .object({
          id: z.string().min(1),
          description: z.string().min(1),
          evidence: z.array(EvidenceRefSchema).min(1),
        })
        .strict(),
    ),
    generatedAt: z.string().datetime(),
  })
  .strict();
export type MeetingInput = z.infer<typeof MeetingInputSchema>;
export type MeetingAnalysis = z.infer<typeof MeetingAnalysisSchema>;
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
