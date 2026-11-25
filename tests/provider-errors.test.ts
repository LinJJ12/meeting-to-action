import { afterEach, describe, expect, it, vi } from "vitest";
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
  vi.restoreAllMocks();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          // 超时/中止用例会留下半开连接，先全部掐断，避免 afterEach 卡在 close 上。
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
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

describe("provider 网络错误分类", () => {
  it("连接被上游提前关闭时返回 REQUEST_FAILED，且不回显 URL 查询串", async () => {
    const baseUrl = await stubServer((req) => req.socket.destroy());

    const error = await provider(`${baseUrl}?key=SECRET_QUERY_VALUE`)
      .complete([{ role: "user", content: "x" }])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).code).toBe("REQUEST_FAILED");
    const message = String((error as Error).message);
    expect(message).not.toContain("SECRET_QUERY_VALUE");
    expect(message).not.toContain("http://");
  });

  it("请求超时时返回 REQUEST_TIMEOUT", async () => {
    // 接受连接但永不响应，让客户端自己触发 AbortSignal.timeout。
    const baseUrl = await stubServer(() => {});

    const error = await provider(`${baseUrl}?key=SECRET_QUERY_VALUE`, { timeoutMs: 200 })
      .complete([{ role: "user", content: "x" }])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).code).toBe("REQUEST_TIMEOUT");
    const message = String((error as Error).message);
    expect(message).toMatch(/timed out/i);
    expect(message).not.toContain("SECRET_QUERY_VALUE");
    expect(message).not.toContain("http://");
  });

  it("请求被外部中止时返回 REQUEST_ABORTED", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new DOMException("This operation was aborted", "AbortError"),
    );

    const error = await provider("http://127.0.0.1:1/v1")
      .complete([{ role: "user", content: "x" }])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).code).toBe("REQUEST_ABORTED");
    expect(String((error as Error).message)).toMatch(/aborted/i);
  });
});

describe("verbose 错误体脱敏", () => {
  it("常见凭据模式在 verbose 诊断中被替换为 [REDACTED]", async () => {
    const secrets = {
      apiKey: "sk-live-ABC123",
      bearer: "abc.def",
      transcriptToken: "SECRET_TRANSCRIPT_TOKEN_4f2a",
      queryValue: "topsecretvalue",
      secretValue: "hunter2value",
    };
    const baseUrl = await stubServer((_req, res) => {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: `${secrets.transcriptToken} alice said the launch is cancelled`,
          api_key: secrets.apiKey,
          authorization: `Bearer ${secrets.bearer}`,
          apiKeyQuery: `api_key=${secrets.queryValue}`,
          secret_field: `secret=${secrets.secretValue}`,
        }),
      );
    });

    const error = await provider(baseUrl, { verboseErrors: true })
      .complete([{ role: "user", content: "x" }])
      .catch((caught: unknown) => caught);

    expect((error as ProviderError).code).toBe("HTTP_ERROR");
    const message = String((error as Error).message);
    expect(message).toContain("HTTP 400");
    expect(message).toContain("[REDACTED]");
    for (const secret of Object.values(secrets)) {
      expect(message).not.toContain(secret);
    }
    expect(message.length).toBeLessThan(700);
  });

  it("非 verbose 模式仍然完全不回显错误体", async () => {
    const baseUrl = await stubServer((_req, res) => {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("sk-live-ABC123 Bearer abc.def SECRET_TRANSCRIPT_TOKEN_4f2a");
    });

    const error = await provider(baseUrl)
      .complete([{ role: "user", content: "x" }])
      .catch((caught: unknown) => caught);

    expect((error as ProviderError).code).toBe("HTTP_ERROR");
    const message = String((error as Error).message);
    expect(message).not.toContain("sk-live-ABC123");
    expect(message).not.toContain("abc.def");
    expect(message).not.toContain("SECRET_TRANSCRIPT_TOKEN_4f2a");
  });
});