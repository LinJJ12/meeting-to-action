import { describe, expect, it } from "vitest";
import { normalizeTranscript } from "../src/core/normalize.js";
import { assertContentWithinLimit, MAX_CONTENT_BYTES, MAX_SEGMENTS } from "../src/core/limits.js";
import { callTool } from "../src/mcp/tools.js";

describe("输入上限", () => {
  it("normalizeTranscript 达到 maxSegments 时立即抛错", () => {
    const content = Array.from({ length: 5 }, (_, index) => `段落${index + 1}`).join("\n\n");
    expect(() => normalizeTranscript(content, "x.md", { maxSegments: 3 })).toThrow("INPUT_SEGMENT_LIMIT");
    expect(normalizeTranscript(content, "x.md", { maxSegments: 5 }).segments).toHaveLength(5);
  });

  it("未超限的输入不受影响", () => {
    expect(() => assertContentWithinLimit("Alice: 我会在周五前更新契约。")).not.toThrow();
    expect(normalizeTranscript("Alice: ok.", "x.md", { maxSegments: 1 }).segments).toHaveLength(1);
  });

  it("assertContentWithinLimit 按 UTF-8 字节数拒绝超大输入", () => {
    const huge = "界".repeat(Math.floor(MAX_CONTENT_BYTES / 3) + 1);
    expect(() => assertContentWithinLimit(huge)).toThrow("INPUT_SIZE_LIMIT");
  });

  it("MCP prepare_meeting 在内容远小于字节上限时就拒绝超量段落", () => {
    // 每段约 3 字节，总量约 30 KB，远低于 2 MiB，但段落数超过 MAX_SEGMENTS
    const content = "a\n\n".repeat(MAX_SEGMENTS + 5);
    expect(Buffer.byteLength(content, "utf8")).toBeLessThan(MAX_CONTENT_BYTES);

    const result = callTool("prepare_meeting", { content, fileName: "x.txt" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe("INPUT_SEGMENT_LIMIT");
  });

  it("MCP 常量与 core 常量保持一致", async () => {
    const tools = await import("../src/mcp/tools.js");
    expect(tools.MAX_CONTENT_BYTES).toBe(MAX_CONTENT_BYTES);
    expect(tools.MAX_SEGMENTS).toBe(MAX_SEGMENTS);
  });
});