import { afterEach, describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { OpenAICompatibleProvider, type OpenAICompatibleOptions } from "../src/providers/openai-compatible.js";
import { ProviderError } from "../src/providers/types.js";

const servers: Server[] = [];
const MIB = 1024 * 1024;

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

/**
 * 按块流式写响应体，避免测试自己一次性分配几十 MiB；客户端提前断开时停止写入，
 * 否则 stub server 在 afterEach 里可能一直等这个连接。
 */
function streamBody(res: ServerResponse, totalBytes: number, chunk = "x".repeat(64 * 1024)): void {
  const piece = Buffer.from(chunk);
  let sent = 0;
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  res.on("close", stop);
  res.on("error", stop);
  const pump = () => {
    while (!stopped && sent < totalBytes) {
      const size = Math.min(piece.length, totalBytes - sent);
      sent += size;
      if (!res.write(size === piece.length ? piece : piece.subarray(0, size))) {
        res.once("drain", pump);
        return;
      }
    }
    if (!stopped) res.end();
  };
  pump();
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

  it("4xx 响应体超过 8 MiB 时返回 HTTP 错误，而不是 RESPONSE_TOO_LARGE", async () => {
    const bodyBytes = 20 * MIB;
    const baseUrl = await stubServer((_req, res) => {
      res.writeHead(400, { "content-type": "text/plain", "content-length": String(bodyBytes) });
      streamBody(res, bodyBytes);
    });

    const error = await provider(baseUrl)
      .complete([{ role: "user", content: "x" }])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).code).toBe("HTTP_ERROR");
    const message = String((error as Error).message);
    expect(message).toContain("400");
    expect(message).toContain("Bad Request");
  });

  it("verbose 下 4xx 超大响应体只做有界诊断，错误码仍是 HTTP 错误", async () => {
    const bodyBytes = 20 * MIB;
    const baseUrl = await stubServer((_req, res) => {
      res.writeHead(400, { "content-type": "text/plain", "content-length": String(bodyBytes) });
      streamBody(res, bodyBytes);
    });

    const error = await provider(baseUrl, { verboseErrors: true })
      .complete([{ role: "user", content: "x" }])
      .catch((caught: unknown) => caught);

    expect((error as ProviderError).code).toBe("HTTP_ERROR");
    const message = String((error as Error).message);
    expect(message).toContain("400");
    expect(message.length).toBeLessThan(700);
  });

  it("4xx 响应体读取中途断开时仍是 HTTP 错误，而不是 BODY_READ_FAILED", async () => {
    const baseUrl = await stubServer((_req, res) => {
      res.writeHead(400, { "content-type": "text/plain", "content-length": "4096" });
      res.flushHeaders();
      res.write("PARTIAL_PRIVATE_TRANSCRIPT");
      // 上游在错误响应体发完前挂断，模拟网关中途掐断连接。
      setTimeout(() => res.destroy(), 30);
    });

    const error = await provider(baseUrl, { verboseErrors: true })
      .complete([{ role: "user", content: "x" }])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).code).toBe("HTTP_ERROR");
    const message = String((error as Error).message);
    expect(message).toContain("400");
    expect(message).not.toContain("PARTIAL_PRIVATE_TRANSCRIPT");
  });

  it("2xx 响应体超过默认 8 MiB 上限时返回 RESPONSE_TOO_LARGE", async () => {
    const bodyBytes = 9 * MIB;
    const baseUrl = await stubServer((_req, res) => {
      // 不声明 content-length，让实现走流式累计上限的分支。
      res.writeHead(200, { "content-type": "application/json" });
      streamBody(res, bodyBytes);
    });

    const error = await provider(baseUrl)
      .complete([{ role: "user", content: "x" }])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).code).toBe("RESPONSE_TOO_LARGE");
  });

  it("4xx 正常小响应体：默认不泄漏正文，verbose 只给截断摘要", async () => {
    const baseUrl = await stubServer((_req, res) => {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("PRIVATE_TRANSCRIPT: Alice said the launch is cancelled");
    });

    const defaultError = await provider(baseUrl)
      .complete([{ role: "user", content: "x" }])
      .catch((caught: unknown) => caught);
    expect((defaultError as ProviderError).code).toBe("HTTP_ERROR");
    expect(String((defaultError as Error).message)).not.toContain("PRIVATE_TRANSCRIPT");
    expect(String((defaultError as Error).message)).toContain("400");

    const verboseError = await provider(baseUrl, { verboseErrors: true })
      .complete([{ role: "user", content: "x" }])
      .catch((caught: unknown) => caught);
    expect((verboseError as ProviderError).code).toBe("HTTP_ERROR");
    const verboseMessage = String((verboseError as Error).message);
    expect(verboseMessage).toContain("400");
    expect(verboseMessage).toContain("PRIVATE_TRANSCRIPT");
    expect(verboseMessage.length).toBeLessThan(700);
  });
});