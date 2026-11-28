import { describe, it, expect } from "vitest";
import { RequestLineGuard, oversizeLineError } from "../src/mcp/line-guard.js";

async function run(
  chunks: (string | Buffer)[],
  limit: number,
): Promise<{ output: string; oversize: number[] }> {
  const oversize: number[] = [];
  const guard = new RequestLineGuard({
    limit,
    onOversize: (bytes) => {
      oversize.push(bytes);
    },
  });
  const out: Buffer[] = [];
  guard.on("data", (chunk: Buffer) => {
    out.push(Buffer.from(chunk));
  });
  const completed = new Promise<void>((resolve, reject) => {
    guard.once("end", () => resolve());
    guard.once("error", reject);
  });
  for (const chunk of chunks) guard.write(chunk);
  guard.end();
  await completed;
  return { output: Buffer.concat(out).toString("utf8"), oversize };
}

describe("request line byte guard", () => {
  it("forwards a chunk holding several complete lines", async () => {
    expect(await run(['{"id":1}\n{"id":2}\n'], 100)).toEqual({
      output: '{"id":1}\n{"id":2}\n',
      oversize: [],
    });
  });
  it("reassembles a line split across chunks at arbitrary byte offsets", async () => {
    expect(await run(['{"jsonrpc":"2.', '0","id":1', ',"method":"tools/list"}\n'], 100)).toEqual({
      output: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n',
      oversize: [],
    });
  });
  it("normalizes CRLF line endings to LF and keeps a lone CR inside the payload", async () => {
    expect(await run(['{"a":1}\r\n{"b":"x\\ry"}\r\n'], 100)).toEqual({
      output: '{"a":1}\n{"b":"x\\ry"}\n',
      oversize: [],
    });
  });
  it("preserves UTF-8 encoded payload bytes when a multibyte character is split across chunks", async () => {
    const line = Buffer.from(
      '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{"text":"会议"}}\n',
    );
    const text = line.toString("utf8");
    for (let at = 1; at < Buffer.byteLength(text); at += 7) {
      const parts: Buffer[] = [];
      let offset = 0;
      while (offset < line.length) {
        parts.push(line.subarray(offset, Math.min(offset + at, line.length)));
        offset += at;
      }
      const result = await run(parts, 1000);
      expect(result.output).toBe(text);
      expect(result.oversize).toEqual([]);
    }
  });
  it("accepts a line whose byte length is exactly the limit", async () => {
    expect(await run(["a".repeat(10) + "\n"], 10)).toEqual({
      output: "a".repeat(10) + "\n",
      oversize: [],
    });
  });
  it("does not count the CR of CRLF against the byte limit", async () => {
    expect(await run(["a".repeat(5) + "\r\n"], 5)).toEqual({
      output: "a".repeat(5) + "\n",
      oversize: [],
    });
  });
  it("counts UTF-8 bytes rather than UTF-16 code units", async () => {
    expect(await run(["会议\n"], 6)).toEqual({ output: "会议\n", oversize: [] });
    expect(await run(["会议会\n"], 6)).toEqual({ output: "", oversize: [7] });
  });
  it("reports one oversized line, discards its remaining bytes and resumes after the newline", async () => {
    const result = await run(["ok1\n" + "a".repeat(11) + "trailing\nok2\n"], 10);
    expect(result.oversize).toHaveLength(1);
    expect(result.output).toBe("ok1\nok2\n");
    expect(result.oversize[0]).toBe(11);
  });
  it("reports consecutive oversized lines independently", async () => {
    const result = await run(["x".repeat(11) + "\n" + "y".repeat(12) + "\n" + "z\n"], 10);
    expect(result.output).toBe("z\n");
    // The reported byte count is the offset that crossed the limit (limit + 1).
    expect(result.oversize).toEqual([11, 11]);
  });
  it("forwards a final unterminated line at EOF with a newline appended", async () => {
    expect(await run(['{"a":1}'], 100)).toEqual({ output: '{"a":1}\n', oversize: [] });
  });
  it("rejects an oversized final line without a terminating newline at EOF", async () => {
    expect(await run(["a".repeat(11)], 10)).toEqual({ output: "", oversize: [11] });
  });
  it("drops an empty line without emitting a frame", async () => {
    expect(await run(["\n\na\n"], 10)).toEqual({ output: "a\n", oversize: [] });
  });

  it("counts CR bytes as payload so a CR-padded line cannot bypass the limit", async () => {
    // Regression: CR was previously counted as a zero-width byte, so a caller
    // could send a large line padded with CRs and stay under the bound.
    const padded = "a".repeat(4) + "\r".repeat(64) + "\n";
    const result = await run([padded + "ok\n"], 10);
    expect(result.oversize).toHaveLength(1);
    expect(result.output).toBe("ok\n");
  });

  it("rejects a transport-sized CR-only line", async () => {
    const limit = 4 * 1024 * 1024;
    const result = await run(["\r".repeat(5 * 1024 * 1024) + "\n" + '{"id":1}\n'], limit);
    expect(result.oversize).toEqual([limit + 1]);
    expect(result.output).toBe('{"id":1}\n');
  });

  it("reports an oversized line written in a single chunk instead of dropping it silently", async () => {
    const result = await run(["a".repeat(50) + "\n" + "ok\n"], 10);
    expect(result.oversize).toEqual([11]);
    expect(result.output).toBe("ok\n");
  });

  it("rejects limit-plus-one payload bytes terminated by CRLF", async () => {
    expect(await run(["a".repeat(11) + "\r\n"], 10)).toEqual({ output: "", oversize: [11] });
  });
});

describe("oversize JSON-RPC error frame", () => {
  it("encodes the documented -32600 INPUT_SIZE_LIMIT response", () => {
    const frame = JSON.parse(oversizeLineError(4_194_305, 4 * 1024 * 1024));
    expect(frame.jsonrpc).toBe("2.0");
    expect(frame.id).toBeNull();
    expect(frame.error.code).toBe(-32600);
    expect(frame.error.message).toBe(
      "INPUT_SIZE_LIMIT: request line exceeds 4 MiB (bytes=4194305)",
    );
  });
});
