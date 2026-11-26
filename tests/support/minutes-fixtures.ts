import {
  MeetingInputSchema,
  MeetingAnalysisSchema,
  type MeetingAnalysis,
} from "../../src/domain/schema.js";
import { MinutesDocumentSchema, type MinutesDocument } from "../../src/domain/minutes.js";

// CLI 与 MCP 接线测试共用的合法样本：分析对得上逐字稿，minutes 覆盖全部行动项。
type EvidenceExtra = { speaker?: string; timestamp?: string; quote?: string };
const ev = (segmentId: string, lineStart: number, lineEnd: number, extra: EvidenceExtra = {}) => ({
  sourceId: "s1",
  segmentId,
  lineStart,
  lineEnd,
  ...extra,
});

export const inputFixture = () =>
  MeetingInputSchema.parse({
    schemaVersion: "1.0",
    meeting: {
      id: "meeting-star",
      title: "星河手账周会",
      date: "2026-11-24",
      participants: ["林舟", "苏禾", "陈屿"],
    },
    sources: [{ id: "s1", kind: "transcript", format: "txt", fileName: "transcript.txt" }],
    segments: [
      {
        id: "seg1",
        sourceId: "s1",
        text: "登录改造的回归已经跑完了。",
        lineStart: 1,
        lineEnd: 1,
        speaker: "林舟",
        timestamp: "10:00",
      },
      {
        id: "seg2",
        sourceId: "s1",
        text: "灰度名单我来整理，周五之前给到。",
        lineStart: 2,
        lineEnd: 3,
        speaker: "苏禾",
        timestamp: "10:02",
      },
      {
        id: "seg3",
        sourceId: "s1",
        text: "支付回调的监控还没补。",
        lineStart: 4,
        lineEnd: 4,
        speaker: "林舟",
        timestamp: "10:05",
      },
      {
        id: "seg4",
        sourceId: "s1",
        text: "发布窗口定在下周三。",
        lineStart: 5,
        lineEnd: 5,
        speaker: "陈屿",
        timestamp: "10:08",
      },
      {
        id: "seg5",
        sourceId: "s1",
        text: "灰度比例还要再确认。",
        lineStart: 6,
        lineEnd: 6,
        speaker: "苏禾",
        timestamp: "10:10",
      },
    ],
  });

export const analysisFixture = (): MeetingAnalysis =>
  MeetingAnalysisSchema.parse({
    schemaVersion: "1.0",
    meetingId: "meeting-star",
    summary: ["登录改造回归完成，计划下周三小范围灰度。"],
    topics: [
      {
        title: "登录改造",
        summary: "回归完成，准备灰度",
        evidence: [
          ev("seg1", 1, 1, {
            speaker: "林舟",
            timestamp: "10:00",
            quote: "登录改造的回归已经跑完了。",
          }),
        ],
      },
    ],
    decisions: [
      {
        id: "d1",
        statement: "发布窗口定在下周三。",
        status: "confirmed",
        evidence: [
          ev("seg4", 5, 5, { speaker: "陈屿", timestamp: "10:08", quote: "发布窗口定在下周三。" }),
        ],
        confidence: "high",
      },
    ],
    actionItems: [
      {
        id: "a1",
        title: "整理灰度名单",
        assignee: "苏禾",
        dueDate: "周五",
        status: "in_progress",
        evidence: [
          ev("seg2", 2, 3, {
            speaker: "苏禾",
            timestamp: "10:02",
            quote: "灰度名单我来整理，周五之前给到。",
          }),
        ],
        confidence: "high",
      },
      {
        id: "a2",
        title: "补充支付回调监控",
        status: "proposed",
        evidence: [
          ev("seg3", 4, 4, {
            speaker: "林舟",
            timestamp: "10:05",
            quote: "支付回调的监控还没补。",
          }),
        ],
        confidence: "medium",
      },
      {
        id: "a3",
        title: "确认灰度比例",
        assignee: "陈屿",
        status: "blocked",
        evidence: [
          ev("seg5", 6, 6, { speaker: "苏禾", timestamp: "10:10", quote: "灰度比例还要再确认。" }),
        ],
        confidence: "low",
      },
    ],
    risks: [
      {
        id: "r1",
        description: "支付回调失败率不可见",
        severity: "high",
        evidence: [
          ev("seg3", 4, 4, {
            speaker: "林舟",
            timestamp: "10:05",
            quote: "支付回调的监控还没补。",
          }),
        ],
      },
    ],
    openQuestions: [
      {
        id: "q1",
        question: "灰度比例是 5% 还是 10%？",
        evidence: [
          ev("seg5", 6, 6, { speaker: "苏禾", timestamp: "10:10", quote: "灰度比例还要再确认。" }),
        ],
      },
    ],
    conflicts: [
      {
        id: "cf1",
        description: "对灰度比例存在分歧",
        evidence: [
          ev("seg5", 6, 6, { speaker: "苏禾", timestamp: "10:10", quote: "灰度比例还要再确认。" }),
        ],
      },
    ],
    generatedAt: "2026-11-24T08:00:00.000Z",
  });

export const minutesFixture = (): MinutesDocument =>
  MinutesDocumentSchema.parse({
    schemaVersion: "1.0",
    contractVersion: "1.0",
    meetingId: "meeting-star",
    generatedAt: "2026-11-24T08:05:00.000Z",
    title: "星河手账 11 月第 4 周例会纪要",
    meta: { date: "2026-11-24", participants: ["林舟", "苏禾", "陈屿"] },
    highlights: ["登录改造回归完成，准备小范围灰度", "支付回调监控待补充"],
    actionNote: "以下任务来自会议原文提取，负责人与期限以原文确认为准。",
    sections: [
      {
        id: "sec1",
        heading: "登录改造",
        claims: [
          {
            id: "c1",
            kind: "progress",
            text: "登录改造回归已完成，准备灰度",
            detail: "灰度比例尚未确认",
            refs: ["a1", "d1"],
          },
          { id: "c2", kind: "followup", text: "补充支付回调监控", refs: ["a2"] },
        ],
      },
      {
        id: "sec2",
        heading: "发布安排",
        claims: [
          { id: "c3", kind: "decision", text: "发布窗口定在下周三", refs: ["d1"] },
          { id: "c4", kind: "followup", text: "确认灰度比例", refs: ["a3"] },
        ],
      },
      {
        id: "sec3",
        heading: "待确认",
        claims: [
          {
            id: "c5",
            kind: "open",
            text: "灰度比例与监控缺口待确认",
            detail: "需要先补监控再决定放量比例",
            refs: ["q1", "r1", "cf1"],
          },
        ],
      },
    ],
  });

/** 复制一份合法 minutes 后按用例改坏，保持其余字段不变。 */
export const mutatedMinutes = (mutate: (draft: any) => void): MinutesDocument => {
  const draft: any = structuredClone(minutesFixture());
  mutate(draft);
  return draft as MinutesDocument;
};
