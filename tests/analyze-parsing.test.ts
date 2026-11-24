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

/** 按顺序返回预设响应，并记录每次调用拿到的消息序列。 */
class ScriptedProvider implements AnalysisProvider {
  calls = 0;
  readonly messageLog: ChatMessage[][] = [];
  constructor(private readonly responses: string[]) {}
  async complete(messages: ChatMessage[]): Promise<string> {
    this.messageLog.push(messages.map((message) => ({ ...message })));
    const response = this.responses[Math.min(this.calls, this.responses.length - 1)]!;
    this.calls++;
    return response;
  }
}

/** 永远返回同一响应，但超过上限就抛错，避免 retries 归一化缺陷导致测试死循环。 */
class BoundedProvider implements AnalysisProvider {
  calls = 0;
  readonly messageLog: ChatMessage[][] = [];
  constructor(
    private readonly response: string,
    private readonly limit = 8,
  ) {}
  async complete(messages: ChatMessage[]): Promise<string> {
    this.calls++;
    this.messageLog.push(messages.map((message) => ({ ...message })));
    if (this.calls > this.limit) throw new Error("PROVIDER_CALL_LIMIT_EXCEEDED");
    return this.response;
  }
}

const validJson = JSON.stringify(validDraft);

function fence(body: string, label = "json"): string {
  return "```" + label + "\n" + body + "\n```";
}

async function rejection(promise: Promise<unknown>): Promise<Error> {
  return promise.then(
    () => {
      throw new Error("expected the promise to reject");
    },
    (error: unknown) => error as Error,
  );
}

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

describe("analyzeMeeting 围栏与前言的容错提取", () => {
  it("前言含 {} 诱饵时仍取后面围栏里的真 JSON", async () => {
    const provider = new ScriptedProvider([
      "Here is an example of an empty object: {}. The real analysis follows.\n\n" + fence(validJson),
    ]);
    const analysis = await analyzeMeeting(input, provider, { retries: 0 });
    expect(analysis.summary).toEqual(validDraft.summary);
    expect(provider.calls).toBe(1);
  });

  it("前言含不平衡花括号时仍取后面围栏里的真 JSON", async () => {
    const provider = new ScriptedProvider([
      "Notes: {see below} and an unclosed brace {, ignore both.\n\n" + fence(validJson),
    ]);
    const analysis = await analyzeMeeting(input, provider, { retries: 0 });
    expect(analysis.meetingId).toBe(input.meeting.id);
    expect(provider.calls).toBe(1);
  });

  it("围栏语言标签大小写不敏感（```JSON）", async () => {
    const provider = new ScriptedProvider([
      "Example shape: {}.\n\n" + fence(validJson, "JSON"),
    ]);
    const analysis = await analyzeMeeting(input, provider, { retries: 0 });
    expect(analysis.meetingId).toBe(input.meeting.id);
  });

  it("围栏后还有尾巴文字时也能解析", async () => {
    const provider = new ScriptedProvider([
      "Please see {the notes} first.\n\n" + fence(validJson) + "\n\nLet me know if you need changes.",
    ]);
    const analysis = await analyzeMeeting(input, provider, { retries: 0 });
    expect(analysis.meetingId).toBe(input.meeting.id);
  });

  it("围栏没有语言标签、``` 后直接换行时也接受", async () => {
    const provider = new ScriptedProvider(["```\n" + validJson + "\n```"]);
    const analysis = await analyzeMeeting(input, provider, { retries: 0 });
    expect(analysis.meetingId).toBe(input.meeting.id);
  });

  it("多个围栏时跳过坏的第一个、采用第二个", async () => {
    const provider = new ScriptedProvider([
      fence('{"summary": [}') + "\n\n" + fence(validJson),
    ]);
    const analysis = await analyzeMeeting(input, provider, { retries: 0 });
    expect(analysis.meetingId).toBe(input.meeting.id);
    expect(provider.calls).toBe(1);
  });

  it("完全无 JSON 时抛 ANALYSIS_INVALID_JSON，并报告尝试过的候选数量", async () => {
    const provider = new ScriptedProvider(["I could not analyze this meeting."]);
    const error = await rejection(analyzeMeeting(input, provider, { retries: 0 }));
    expect(error.message).toContain("ANALYSIS_INVALID_JSON");
    expect(error.message).toMatch(/tried \d+ candidate/);
    expect(provider.calls).toBe(1);
  });
});

describe("analyzeMeeting 统一重试语义（解析失败与 schema 失败）", () => {
  const broken: Record<string, unknown> = { ...validDraft };
  delete broken.risks;
  const brokenJson = JSON.stringify(broken);

  it("schema 校验失败后也会重试，第二次修正成功即通过", async () => {
    const provider = new ScriptedProvider([brokenJson, validJson]);
    const analysis = await analyzeMeeting(input, provider, { retries: 1 });
    expect(analysis.meetingId).toBe(input.meeting.id);
    expect(provider.calls).toBe(2);
  });

  it("schema 校验失败重试耗尽时报 ANALYSIS_SCHEMA_INVALID，且最多调用 retries+1 次", async () => {
    const provider = new ScriptedProvider([brokenJson]);
    const error = await rejection(analyzeMeeting(input, provider, { retries: 2 }));
    expect(error.message).toContain("ANALYSIS_SCHEMA_INVALID");
    expect(error.message).toContain("risks");
    expect(provider.calls).toBe(3);
  });

  it("schema 纠正指令带上 Zod 首个字段路径，并要求修正该字段", async () => {
    const provider = new ScriptedProvider([brokenJson, validJson]);
    await analyzeMeeting(input, provider, { retries: 1 });

    const retryMessages = provider.messageLog[1]!;
    expect(retryMessages[2]).toMatchObject({ role: "assistant", content: brokenJson });
    const instruction = retryMessages.at(-1)!;
    expect(instruction.role).toBe("user");
    expect(instruction.content).toContain("risks");
    expect(instruction.content).toMatch(/fix|correct/i);
  });

  it("解析失败和 schema 失败可以连续重试，总调用次数为 retries+1", async () => {
    const provider = new ScriptedProvider(["not json", brokenJson, validJson]);
    const analysis = await analyzeMeeting(input, provider, { retries: 2 });
    expect(analysis.meetingId).toBe(input.meeting.id);
    expect(provider.calls).toBe(3);
  });

  it("解析失败重试耗尽时报 ANALYSIS_INVALID_JSON，总调用次数为 retries+1", async () => {
    const provider = new ScriptedProvider(["not json"]);
    const error = await rejection(analyzeMeeting(input, provider, { retries: 2 }));
    expect(error.message).toContain("ANALYSIS_INVALID_JSON");
    expect(provider.calls).toBe(3);
  });
});

describe("analyzeMeeting retries 归一化", () => {
  it("retries=0 表示不重试", async () => {
    const provider = new ScriptedProvider(["not json"]);
    await rejection(analyzeMeeting(input, provider, { retries: 0 }));
    expect(provider.calls).toBe(1);
  });

  it("非数字 false 视为非法值，回退默认 1 次重试（共 2 次调用）", async () => {
    const provider = new ScriptedProvider(["not json"]);
    const error = await rejection(
      analyzeMeeting(input, provider, { retries: false as unknown as number }),
    );
    expect(error.message).toContain("ANALYSIS_INVALID_JSON");
    expect(provider.calls).toBe(2);
  });

  it("retries=7 被 clamp 到 5，最多调用 6 次", async () => {
    const provider = new ScriptedProvider(["not json"]);
    await rejection(analyzeMeeting(input, provider, { retries: 7 }));
    expect(provider.calls).toBe(6);
  });

  it("retries=Infinity 视为非法值，回退默认 1 次重试（共 2 次调用）", async () => {
    const provider = new BoundedProvider("not json");
    const error = await rejection(analyzeMeeting(input, provider, { retries: Infinity }));
    expect(error.message).toContain("ANALYSIS_INVALID_JSON");
    expect(provider.calls).toBe(2);
  });

  it("retries=NaN 视为非法值，回退默认 1 次重试（共 2 次调用）", async () => {
    const provider = new BoundedProvider("not json");
    const error = await rejection(analyzeMeeting(input, provider, { retries: NaN }));
    expect(error.message).toContain("ANALYSIS_INVALID_JSON");
    expect(provider.calls).toBe(2);
  });
});

describe("analyzeMeeting 重试消息序列", () => {
  it("重试时先回显 assistant 的原始输出，再追加 user 纠正指令", async () => {
    const provider = new ScriptedProvider(["not json", validJson]);
    await analyzeMeeting(input, provider, { retries: 1 });

    expect(provider.messageLog).toHaveLength(2);
    expect(provider.messageLog[0]!.map((message) => message.role)).toEqual(["system", "user"]);

    const retryMessages = provider.messageLog[1]!;
    expect(retryMessages.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(retryMessages[2]!.content).toBe("not json");

    const instruction = retryMessages[3]!.content;
    expect(instruction).toContain("exactly one JSON object");
    expect(instruction).toContain("code fences");
  });

  it("超长的原始输出回显时截断到 8000 字符", async () => {
    const longOutput = "not json ".repeat(1500);
    expect(longOutput.length).toBeGreaterThan(8000);
    const provider = new ScriptedProvider([longOutput, validJson]);
    await analyzeMeeting(input, provider, { retries: 1 });

    const assistantEcho = provider.messageLog[1]!.find((message) => message.role === "assistant");
    expect(assistantEcho?.content.length).toBe(8000);
  });
});