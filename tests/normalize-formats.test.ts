import { describe, it, expect } from "vitest";
import { normalizeTranscript } from "../src/core/normalize.js";
import { evidenceForSegment, validateEvidence } from "../src/core/evidence.js";

const norm = (lines: string[], file = "meeting.txt") => normalizeTranscript(lines.join("\n"), file);

describe("transcript line-format detection (#26 P1)", () => {
  it("parses same-line speaker + timestamp + text", () => {
    const input = norm([
      "说话人1 00:00:05 那个咱们今天主要说一下这个这个项目排期的问题",
      "说话人2 00:00:31 嗯对我这边是因为上游接口还没ready所以",
      "说话人1 00:01:02 那登录这块儿到底是这周还是下周啊",
      "说话人3 00:01:40 行那就下周四之前",
    ]);
    expect(input.segments).toHaveLength(4);
    expect(input.segments[0]).toMatchObject({
      speaker: "说话人1",
      timestamp: "00:00:05",
      lineStart: 1,
      lineEnd: 1,
    });
    expect(input.segments[3]).toMatchObject({ speaker: "说话人3", timestamp: "00:01:40" });
    expect(input.segments[3]?.text).toContain("行那就下周四之前");
    expect(input.sources[0]?.transcriptFormat).toBe("speaker-inline");
  });

  it("parses timestamp-first MM:SS lines and normalizes to HH:MM:SS", () => {
    const input = norm(["00:05 说话人1 我们先过一下排期", "01:37 说话人2 我这边没问题"]);
    expect(input.segments).toHaveLength(2);
    expect(input.segments[0]).toMatchObject({ speaker: "说话人1", timestamp: "00:00:05" });
    expect(input.segments[1]).toMatchObject({ speaker: "说话人2", timestamp: "00:01:37" });
    expect(input.sources[0]?.transcriptFormat).toBe("timestamp-first");
  });

  it("parses speaker-colon lines without fabricating a timestamp", () => {
    const input = norm(["说话人1：今天先冻结接口", "说话人2: 同意，我先回去改"]);
    expect(input.segments).toHaveLength(2);
    expect(input.segments[0]?.speaker).toBe("说话人1");
    expect(input.segments[0]?.timestamp).toBeUndefined();
    expect(input.sources[0]?.transcriptFormat).toBe("speaker-colon");
  });

  it("parses bracketed speaker labels", () => {
    const input = norm(["【说话人1】会议开始", "【主持人】先确认一下到场"]);
    expect(input.segments[0]).toMatchObject({ speaker: "说话人1" });
    expect(input.segments[1]).toMatchObject({ speaker: "主持人" });
    expect(input.sources[0]?.transcriptFormat).toBe("speaker-bracket");
  });

  it("parses dataset-style speaker + MM:SS header lines", () => {
    const input = norm([
      "说话人1 00:00",
      "各位，我们今天开这个会。",
      "",
      "说话人2 00:25",
      "好的，我先汇报一下。",
    ]);
    expect(input.segments).toHaveLength(2);
    expect(input.segments[0]).toMatchObject({
      speaker: "说话人1",
      timestamp: "00:00:00",
      lineStart: 1,
      lineEnd: 2,
    });
    expect(input.segments[1]).toMatchObject({
      speaker: "说话人2",
      timestamp: "00:00:25",
      lineStart: 4,
      lineEnd: 5,
    });
    expect(input.segments[1]?.text).toContain("好的，我先汇报一下。");
    expect(input.sources[0]?.transcriptFormat).toBe("speaker-time");
  });

  it("parses speaker-time headers with a role in parentheses", () => {
    const input = norm(["说话人1（质量管理部部长） 00:25", "先说一下今天会议的议题。"]);
    expect(input.segments[0]).toMatchObject({ speaker: "说话人1", timestamp: "00:00:25" });
    expect(input.sources[0]?.transcriptFormat).toBe("speaker-time");
  });

  it("does not treat prose ending in a clock-looking value as a speaker header", () => {
    const input = normalizeTranscript("会议时间 00:05\n内容照常。", "demo.txt");
    expect(input.segments.every((s) => s.speaker === undefined)).toBe(true);
    expect(input.sources[0]?.transcriptFormat).toBeUndefined();
  });

  it("drops decorative separator lines without creating empty segments", () => {
    const input = norm(["说话人1 00:00", "第一段内容。", "---", "说话人2 00:30", "第二段内容。"]);
    expect(input.segments).toHaveLength(2);
    expect(input.segments.map((s) => s.text)).toEqual([
      "说话人1 00:00\n第一段内容。",
      "说话人2 00:30\n第二段内容。",
    ]);
  });

  it("supports mixed line formats in one file and records it", () => {
    const input = norm([
      "说话人1 00:00:05 第一段",
      "【说话人2】第二段没有时间戳",
      "",
      "演示用户(00:01:37)：",
      "第三段用旧格式",
    ]);
    expect(input.segments).toHaveLength(3);
    expect(input.sources[0]?.transcriptFormat).toBe("mixed");
    expect(input.segments[1]).toMatchObject({ speaker: "说话人2" });
    expect(input.segments[2]).toMatchObject({
      speaker: "演示用户",
      timestamp: "00:01:37",
      lineStart: 4,
      lineEnd: 5,
    });
  });

  it("preserves ASR noise verbatim and keeps evidence quotes on source lines", () => {
    const input = norm([
      "说话人1 00:00:05 那个这个咱们呃今天主要说项目排期的问题",
      "说话人2 00:00:31 嗯对我这边因为上游接口没ready",
    ]);
    const seg = input.segments[0]!;
    expect(seg.text).toContain("那个这个咱们呃");
    expect(evidenceForSegment(input, "seg-1").quote).toBe(seg.text);
    expect(validateEvidence(input, [evidenceForSegment(input, "seg-1")])).toEqual([]);
  });

  it("does not mistake ordinary prose for speaker lines", () => {
    for (const content of [
      "Decision: defer launch.",
      "讨论：先做接口",
      "Alice: Ship import.",
      "演示用户(00:00:00): inline text",
      "用户(00:60:00):\n内容",
    ]) {
      const input = normalizeTranscript(content, "demo.txt");
      expect(input.segments.every((s) => s.speaker === undefined)).toBe(true);
    }
  });

  it("does not treat document titles, paths or dates as inline speaker labels", () => {
    const input = norm([
      "4月20日 11:15 B1录音",
      "说话人1 00:00 你去过那个地方吗？",
      "《/tmp/jerry_zip_20260425/4月20日 11:15 B1录音09-转写结果.doc》",
      "说话人2 00:02 重创是在西丽吗？",
    ]);
    expect(input.segments.every((s) => s.speaker !== "4月20日")).toBe(true);
    expect(input.segments.every((s) => !/[《》/\\]/.test(s.speaker ?? ""))).toBe(true);
    expect(
      input.segments.filter((s) => s.speaker === "说话人1" || s.speaker === "说话人2"),
    ).toHaveLength(2);
  });

  it("keeps real-name inline speaker labels", () => {
    const input = norm(["张三 00:05:32 大家好", "李四 00:06:10 好的"]);
    expect(input.segments).toHaveLength(2);
    expect(input.segments[0]).toMatchObject({ speaker: "张三", timestamp: "00:05:32" });
    expect(input.sources[0]?.transcriptFormat).toBe("speaker-inline");
  });

  it("keeps legacy header format and does not report a detected format for plain text", () => {
    const legacy = normalizeTranscript("演示用户(00:01:37):\n我会复查。", "demo.md");
    expect(legacy.segments[0]).toMatchObject({ speaker: "演示用户", timestamp: "00:01:37" });
    expect(legacy.sources[0]?.transcriptFormat).toBe("speaker-header");
    const plain = normalizeTranscript("第一行\n第二行", "demo.txt");
    expect(plain.segments[0]?.speaker).toBeUndefined();
    expect(plain.sources[0]?.transcriptFormat).toBeUndefined();
  });

  it("handles CRLF input and respects maxSegments with inline formats", () => {
    const crlf = normalizeTranscript("说话人1 00:00:05 一\r\n说话人2 00:00:31 二", "demo.txt");
    expect(crlf.segments).toHaveLength(2);
    expect(() =>
      normalizeTranscript(["说话人1 00:00:05 一", "说话人2 00:00:31 二"].join("\n"), "demo.txt", {
        maxSegments: 1,
      }),
    ).toThrow(/INPUT_SEGMENT_LIMIT/);
  });

  it("normalizes HH:MM:SS timestamps unchanged", () => {
    const input = norm(["张三 01:04:17 好，我们继续"]);
    expect(input.segments[0]).toMatchObject({ speaker: "张三", timestamp: "01:04:17" });
  });
});
