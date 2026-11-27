import { z } from "zod";

/**
 * Display contract minutes-contract@1.0 ("how to read").
 * It never owns task facts: assignee, dueDate, status, severity... stay in
 * analysis-schema@1.0. Deterministic code validates structure and id mapping;
 * topic grouping and semantic compression belong to the host model.
 */
export const MINUTES_CONTRACT_VERSION = "1.0" as const;
export const MINUTES_CLAIM_KINDS = ["progress", "decision", "followup", "open"] as const;
export const MINUTES_ERROR_CODES = [
  "MINUTES_MEETING_MISMATCH",
  "MINUTES_CONTRACT_UNSUPPORTED",
  "MINUTES_REF_UNKNOWN",
  "MINUTES_KIND_MISMATCH",
  "MINUTES_ACTION_COVERAGE",
  "MINUTES_SCHEMA_INVALID",
] as const;
export type MinutesErrorCode = (typeof MINUTES_ERROR_CODES)[number];
export const MinutesClaimSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(MINUTES_CLAIM_KINDS),
    text: z.string().min(1),
    detail: z.string().min(1).optional(),
    refs: z.array(z.string().min(1)).min(1),
  })
  .strict();
export const MinutesSectionSchema = z
  .object({
    id: z.string().min(1),
    heading: z.string().min(1),
    claims: z.array(MinutesClaimSchema).min(1),
  })
  .strict();
export const MinutesMetaSchema = z
  .object({
    date: z.string().min(1).optional(),
    participants: z.array(z.string().min(1)).optional(),
  })
  .strict();
export const MinutesDocumentSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    contractVersion: z.literal(MINUTES_CONTRACT_VERSION),
    meetingId: z.string().min(1),
    generatedAt: z.string().datetime(),
    title: z.string().min(1),
    meta: MinutesMetaSchema,
    highlights: z.array(z.string().min(1)),
    sections: z.array(MinutesSectionSchema),
    actionNote: z.string().min(1).optional(),
  })
  .strict();
export type MinutesClaim = z.infer<typeof MinutesClaimSchema>;
export type MinutesSection = z.infer<typeof MinutesSectionSchema>;
export type MinutesMeta = z.infer<typeof MinutesMetaSchema>;
export type MinutesDocument = z.infer<typeof MinutesDocumentSchema>;
