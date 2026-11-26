import { describe, expect, it } from "vitest";
import { normalizeTranscript } from "../src/core/normalize.js";
import { analyzeMeeting, validateAnalysisEvidence } from "../src/core/analyze.js";
import type { AnalysisProvider, ChatMessage } from "../src/providers/types.js";

const input = normalizeTranscript(
  "# Planning\n\nAlice: I will update the API contract by Friday.\n\nTeam: We decided to defer launch.",
  "planning.md",
);

class StubProvider implements AnalysisProvider {
  constructor(private readonly result: string) {}
  async complete(_messages: ChatMessage[]): Promise<string> {
    return this.result;
  }
}

const validDraft = {
  summary: ["The team discussed the API contract and launch timing."],
  topics: [
    {
      title: "API contract",
      summary: "The API contract needs an update.",
      evidence: [
        {
          sourceId: input.sources[0]!.id,
          segmentId: "seg-2",
          lineStart: 3,
          lineEnd: 3,
          quote: "Alice: I will update the API contract by Friday.",
        },
      ],
    },
  ],
  decisions: [
    {
      id: "decision-1",
      statement: "Defer launch.",
      status: "confirmed",
      confidence: "high",
      evidence: [
        {
          sourceId: input.sources[0]!.id,
          segmentId: "seg-3",
          lineStart: 5,
          lineEnd: 5,
          quote: "Team: We decided to defer launch.",
        },
      ],
    },
  ],
  actionItems: [
    {
      id: "action-1",
      title: "Update the API contract",
      assignee: "Alice",
      dueDate: "Friday",
      status: "accepted",
      confidence: "high",
      evidence: [
        {
          sourceId: input.sources[0]!.id,
          segmentId: "seg-2",
          lineStart: 3,
          lineEnd: 3,
          quote: "I will update the API contract",
        },
      ],
    },
  ],
  risks: [],
  openQuestions: [],
  conflicts: [],
};

describe("analyzeMeeting", () => {
  it("validates structured output and attaches trusted metadata", async () => {
    const result = await analyzeMeeting(input, new StubProvider(JSON.stringify(validDraft)));
    expect(result.meetingId).toBe(input.meeting.id);
    expect(Number.isNaN(Date.parse(result.generatedAt))).toBe(false);
    expect(result.actionItems[0]?.assignee).toBe("Alice");
  });

  it("rejects evidence references that point to invented source segments", async () => {
    const invalid = {
      ...validDraft,
      decisions: [
        {
          ...validDraft.decisions[0],
          evidence: [{ sourceId: "fake", segmentId: "seg-999", lineStart: 1, lineEnd: 1 }],
        },
      ],
    };
    await expect(analyzeMeeting(input, new StubProvider(JSON.stringify(invalid)))).rejects.toThrow(
      /ANALYSIS_EVIDENCE_INVALID/,
    );
  });

  it("rejects malformed model output", async () => {
    await expect(analyzeMeeting(input, new StubProvider("not json"))).rejects.toThrow(
      /ANALYSIS_INVALID_JSON/,
    );
  });

  it("rejects evidence-free material claims", () => {
    const analysis = {
      ...validDraft,
      meetingId: input.meeting.id,
      generatedAt: new Date().toISOString(),
      decisions: [{ ...validDraft.decisions[0], evidence: [] }],
    } as never;
    expect(validateAnalysisEvidence(input, analysis)).toContain("Evidence group 2 is empty");
  });
});
