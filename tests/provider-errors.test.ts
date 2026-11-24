import { afterEach, describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { OpenAICompatibleProvider, type OpenAICompatibleOptions } from "../src/providers/openai-compatible.js";
import { ProviderError } from "../src/providers/types.js";

const servers: Server[] = [];

async function stubServer(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}/v1`;
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

function provider(baseUrl: string, extra: Partial<OpenAICompatibleOptions> = {}) {
  return new OpenAICompatibleProvider({ apiKey: "test-key", model: "test-model", baseUrl, ...extra });
}

describe("provider 错误处理与响应上限", () => {
  it("默认不把上游响应体写进错误（防止逐字稿泄漏到日志）", async () => {
    const baseUrl = await stubServer((_req, res) => {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("PRIVATE_TRANSCRIPT: Alice said the launch is cancelled");
    });

    const error = await provider(baseUrl)
      .complete([{ role: "user", content: "analyze" }])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect(String((error as Error).message)).not.toContain("PRIVATE_TRANSCRIPT");
    expect(String((error as Error).message)).toContain("HTTP 400");
    expect((error as ProviderError).code).toBe("HTTP_ERROR");
  });

  it("显式开启 verbose 时只输出脱敏截断片段", async () => {
    const baseUrl = await stubServer((_req, res) => {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end("bad\u001b[31mUPSTREAM\u001b[0m " + "x".repeat(1000));
    });

    const error = await provider(baseUrl, { verboseErrors: true })
      .complete([{ role: "user", content: "x" }])
      .catch((caught: unknown) => caught);

    const message = String((error as Error).message);
    expect(message).toContain("HTTP 500");
    expect(message).toContain("UPSTREAM");
    expect(message).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/);
    expect(message.length).toBeLessThan(700);
  });

  it("响应体超过上限时中止并返回稳定错误码", async () => {
    const baseUrl = await stubServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: "x".repeat(200) } }] }));
    });

    const error = await provider(baseUrl, { maxResponseBytes: 64 })
      .complete([{ role: "user", content: "x" }])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).code).toBe("RESPONSE_TOO_LARGE");
  });

  it("响应体不是 JSON 时返回稳定错误码", async () => {
    const baseUrl = await stubServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("not json");
    });

    const error = await provider(baseUrl)
      .complete([{ role: "user", content: "x" }])
      .catch((caught: unknown) => caught);

    expect((error as ProviderError).code).toBe("INVALID_JSON");
  });

  it("正常响应仍返回模型内容", async () => {
    const baseUrl = await stubServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: "{\"ok\":true}" } }] }));
    });

    await expect(provider(baseUrl).complete([{ role: "user", content: "x" }])).resolves.toBe("{\"ok\":true}");
  });
});