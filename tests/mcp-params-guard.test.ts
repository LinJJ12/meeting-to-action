import { describe, it, expect } from "vitest";
import { startStdioServer } from "./stdio-harness.js";

const INVALID_PARAMS = /^INPUT_INVALID: invalid tools\/call params$/;

const call = (id: number, params: unknown) =>
  JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params }) + "\n";
const isInvalidParams = (frame: any) => frame?.error?.code === -32602;

describe("tools/call params guard", () => {
  it("answers non-object params with -32602 instead of a serialized Zod error", async () => {
    const server = startStdioServer();
    try {
      server.write(call(1, "nope"));
      const frame = await server.nextFrame(isInvalidParams);
      expect(frame).toMatchObject({ jsonrpc: "2.0", id: 1, error: { code: -32602 } });
      expect(frame.error.message).toMatch(INVALID_PARAMS);
      expect(JSON.stringify(frame)).not.toContain("expected");
      expect(server.invalidFrames()).toEqual([]);
    } finally {
      server.kill();
    }
  }, 20_000);

  it("answers a non-string tool name with -32602 and keeps serving", async () => {
    const server = startStdioServer();
    try {
      server.write(call(2, { name: 123, arguments: {} }));
      const frame = await server.nextFrame(isInvalidParams);
      expect(frame.id).toBe(2);
      expect(frame.error.message).toMatch(INVALID_PARAMS);
      server.write(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list" }) + "\n");
      expect((await server.nextFrame((f) => f?.id === 3)).result.tools).toHaveLength(5);
      expect(server.invalidFrames()).toEqual([]);
    } finally {
      server.kill();
    }
  }, 20_000);

  it("answers array arguments and missing params with -32602", async () => {
    const server = startStdioServer();
    try {
      server.write(call(4, { name: "validate_analysis", arguments: [] }));
      expect((await server.nextFrame(isInvalidParams)).id).toBe(4);
      server.write(JSON.stringify({ jsonrpc: "2.0", id: 5, method: "tools/call" }) + "\n");
      expect((await server.nextFrame(isInvalidParams)).id).toBe(5);
      expect(server.invalidFrames()).toEqual([]);
    } finally {
      server.kill();
    }
  }, 20_000);

  it("still forwards well-formed calls to tool-level validation", async () => {
    const server = startStdioServer();
    try {
      server.write(call(6, { name: "validate_analysis", arguments: { input: {}, analysis: 1 } }));
      const frame = await server.nextFrame((f) => f?.id === 6);
      expect(frame.result.isError).toBe(true);
      expect(frame.result.content[0].text).toMatch(/^INPUT_INVALID/);
      expect(server.invalidFrames()).toEqual([]);
    } finally {
      server.kill();
    }
  }, 20_000);
});
