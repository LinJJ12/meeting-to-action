import { describe, it, expect } from "vitest";
import { MAX_REQUEST_BYTES } from "../src/mcp/tools.js";
import { startStdioServer } from "./stdio-harness.js";

const ERROR_MESSAGE = /^INPUT_SIZE_LIMIT: request line exceeds 4 MiB \(bytes=\d+\)$/;
const toolsList = (id: number) =>
  JSON.stringify({ jsonrpc: "2.0", id, method: "tools/list" }) + "\n";
const isOversizeError = (frame: any) => frame?.error?.code === -32600;

describe("transport-level request size guard", () => {
  it("answers a single 4,400,136-byte line with -32600 and keeps serving", async () => {
    const server = startStdioServer();
    try {
      server.write("x".repeat(4_400_136) + "\n");
      const errorFrame = await server.nextFrame(isOversizeError, 25_000);
      expect(errorFrame).toMatchObject({ jsonrpc: "2.0", id: null, error: { code: -32600 } });
      expect(errorFrame.error.message).toMatch(ERROR_MESSAGE);
      server.write(toolsList(1));
      const listFrame = await server.nextFrame((frame) => frame?.id === 1);
      expect(listFrame.result.tools).toHaveLength(5);
      expect(server.invalidFrames()).toEqual([]);
    } finally {
      server.kill();
    }
  }, 30_000);

  it("reports consecutive oversized lines as separate errors without exiting", async () => {
    const server = startStdioServer();
    try {
      server.write("x".repeat(4_400_136) + "\n" + "y".repeat(4_400_136) + "\n");
      const first = await server.nextFrame(isOversizeError, 25_000);
      const second = await server.nextFrame(isOversizeError, 25_000);
      expect(first.error.message).toMatch(ERROR_MESSAGE);
      expect(second.error.message).toMatch(ERROR_MESSAGE);
      expect(second.id).toBeNull();
      server.write(toolsList(2));
      expect((await server.nextFrame((frame) => frame?.id === 2)).result.tools).toHaveLength(5);
      expect(server.invalidFrames()).toEqual([]);
    } finally {
      server.kill();
    }
  }, 30_000);

  it("accepts a 3.9 MB valid request spread over many chunks", async () => {
    const server = startStdioServer();
    try {
      const request =
        " ".repeat(3_900_000) +
        JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/list" }) +
        "\n";
      expect(Buffer.byteLength(request)).toBeLessThan(MAX_REQUEST_BYTES);
      for (let offset = 0; offset < request.length; offset += 7_001)
        server.write(request.slice(offset, offset + 7_001));
      const listFrame = await server.nextFrame((frame) => frame?.id === 7, 25_000);
      expect(listFrame.result.tools).toHaveLength(5);
      expect(server.invalidFrames()).toEqual([]);
    } finally {
      server.kill();
    }
  }, 30_000);

  it("recovers from malformed JSON with diagnostics on stderr and keeps serving", async () => {
    const server = startStdioServer();
    try {
      server.write("this is not json\n");
      server.write(toolsList(3));
      expect(
        (await server.nextFrame((frame) => frame?.id === 3, 25_000)).result.tools,
      ).toHaveLength(5);
      expect(server.stderr()).toContain("MCP_PROTOCOL_ERROR");
      expect(server.invalidFrames()).toEqual([]);
    } finally {
      server.kill();
    }
  }, 30_000);

  it("exits cleanly after an oversized line with no unhandled errors", async () => {
    const server = startStdioServer();
    try {
      server.write("x".repeat(4_400_136) + "\n");
      await server.nextFrame(isOversizeError, 25_000);
      const { code, signal } = await server.close();
      expect(signal).toBeNull();
      expect(code).toBe(0);
      expect(server.stderr()).toBe("");
      expect(server.invalidFrames()).toEqual([]);
    } finally {
      server.kill();
    }
  }, 30_000);
});
