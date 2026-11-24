import { describe, expect, it } from "vitest";
import { normalizeTranscript } from "../src/core/normalize.js";
import { analyzeMeeting } from "../src/core/analyze.js";
import { buildAnalysisMessages } from "../src/core/prompt.js";
import type { AnalysisProvider, ChatMessage } from "../src/providers/types.js";

const input = normalizeTranscript(
  "# Planning\n\nAlice: I will update the API contract by Friday.",
  "planning.md",
);

const validDraft = {
  summary: ["API contract update."],
  topics: [
    {
      title: "API contract",
      summary: "Alice will update it.",
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
  decisions: [],
  actionItems: [],
  risks: [],
  openQuestions: [],
  conflicts: [],
};

/** 按顺序返回预设响应，并记录被调用次数。 */
class ScriptedProvider implements AnalysisProvider {
  calls = 0;
  constructor(private readonly responses: string[]) {}
  async complete(_messages: ChatMessage[]): Promise<string> {
    const response = this.responses[Math.min(this.calls, this.responses.length - 1)]!;
    this.calls++;
    return response;
  }
}

const validJson = JSON.stringify(validDraft);

describe("analyzeMeeting 输出解析", () => {
  it("接受被 Markdown 代码围栏包裹的 JSON", async () => {
    const provider = new ScriptedProvider(["```json\n" + validJson + "\n```"]);
    const analysis = await analyzeMeeting(input, provider, { retries: 0 });
    expect(analysis.meetingId).toBe(input.meeting.id);
    expect(provider.calls).toBe(1);
  });

  it("接受前后带说明文字、但内部是完整 JSON 对象的响应", async () => {
    const provider = new ScriptedProvider(["Here is the analysis:\n" + validJson + "\nHope this helps!"]);
    await expect(analyzeMeeting(input, provider, { retries: 0 })).resolves.toBeTruthy();
  });

  it("解析失败时重试一次，第二次成功即通过", async () => {
    const provider = new ScriptedProvider(["not json", validJson]);
    const analysis = await analyzeMeeting(input, provider, { retries: 1 });
    expect(analysis.meetingId).toBe(input.meeting.id);
    expect(provider.calls).toBe(2);
  });

  it("retries=0 时解析失败立即报错，不重复请求", async () => {
    const provider = new ScriptedProvider(["not json"]);
    const error = await analyzeMeeting(input, provider, { retries: 0 }).catch((caught: unknown) => caught);
    expect(String((error as Error).message)).toContain("ANALYSIS_INVALID_JSON");
    expect(provider.calls).toBe(1);
  });

  it("模型输出缺字段时报 ANALYSIS_SCHEMA_INVALID 并带字段路径，而不是 INPUT_SCHEMA_INVALID", async () => {
    const broken: Record<string, unknown> = { ...validDraft };
    delete broken.risks;
    const error = await analyzeMeeting(input, new ScriptedProvider([JSON.stringify(broken)]), {
      retries: 0,
    }).catch((caught: unknown) => caught);

    const message = String((error as Error).message);
    expect(message).toContain("ANALYSIS_SCHEMA_INVALID");
    expect(message).toContain("risks");
    expect(message).not.toContain("INPUT_SCHEMA_INVALID");
    // 不得把逐字稿内容写进错误信息
    expect(message).not.toContain("Alice: I will update the API contract");
  });

  it("提示词明确禁止代码围栏", () => {
    const messages = buildAnalysisMessages(input);
    expect(messages[0]?.content).toContain("code fences");
  });
});