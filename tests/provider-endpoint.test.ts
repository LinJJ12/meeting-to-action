import { afterEach, describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { OpenAICompatibleProvider } from "../src/providers/openai-compatible.js";
import { ProviderError } from "../src/providers/types.js";

const servers: Server[] = [];

async function stubServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}/v1`;
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

function expectConfigInvalid(baseUrl: string): void {
  const make = () => new OpenAICompatibleProvider({ apiKey: "k", model: "m", baseUrl });
  expect(make).toThrowError(ProviderError);
  try {
    make();
  } catch (error) {
    expect((error as ProviderError).code).toBe("CONFIG_INVALID");
  }
}

describe("provider 端点校验（#15）", () => {
  it("拒绝非 URL 字符串与非网络协议", () => {
    expectConfigInvalid("not a url");
    expectConfigInvalid("file:///etc/passwd");
    expectConfigInvalid("ftp://example.com/v1");
    expectConfigInvalid("data:text/plain,hi");
  });

  it("查询串/片段沿用旧语义被容忍（错误不回显由 provider-errors 测试钉住）", () => {
    expect(
      () =>
        new OpenAICompatibleProvider({
          apiKey: "k",
          model: "m",
          baseUrl: "https://api.example.com/v1?key=x",
        }),
    ).not.toThrow();
    expect(
      () =>
        new OpenAICompatibleProvider({
          apiKey: "k",
          model: "m",
          baseUrl: "http://127.0.0.1:9/v1?token=t",
        }),
    ).not.toThrow();
  });

  it("拒绝发往非 loopback 的明文 http（默认），显式 opt-in 后放行", () => {
    expectConfigInvalid("http://10.0.0.1/v1");
    expectConfigInvalid("http://insecure.example.com/v1");
    // opt-in：仅用于用户显式接受明文风险的场景
    expect(
      () =>
        new OpenAICompatibleProvider({
          apiKey: "k",
          model: "m",
          baseUrl: "http://10.0.0.1/v1",
          allowInsecureHttp: true,
        }),
    ).not.toThrow();
  });

  it("放行 https 与 loopback 明文 http，端点拼上 /chat/completions", () => {
    const p = new OpenAICompatibleProvider({
      apiKey: "k",
      model: "m",
      baseUrl: "https://api.example.com/v1/",
    });
    // 私有字段只通过行为验证：不抛错即可；这里直接断言内部 endpoint 保证拼接语义
    expect((p as unknown as { endpoint: string }).endpoint).toBe(
      "https://api.example.com/v1/chat/completions",
    );
    for (const loopback of [
      "http://localhost:9/v1",
      "http://127.0.0.1:9/v1",
      "http://[::1]:9/v1",
      "http://LOCALHOST:9/v1",
    ]) {
      expect(
        () => new OpenAICompatibleProvider({ apiKey: "k", model: "m", baseUrl: loopback }),
      ).not.toThrow();
    }
  });

  it("拒绝一切重定向：302 不被跟随，跳转目标收不到任何请求", async () => {
    let targetHits = 0;
    const target = await stubServer((req, res) => {
      targetHits += 1;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: "{}" } }] }));
    });
    const origin = await stubServer((req, res) => {
      res.writeHead(302, { location: target + "/chat/completions" });
      res.end();
    });

    const provider = new OpenAICompatibleProvider({ apiKey: "k", model: "m", baseUrl: origin });
    const error = await provider.complete([{ role: "user", content: "hello" }]).then(
      () => {
        throw new Error("expected the request to fail");
      },
      (caught: unknown) => caught as ProviderError,
    );
    expect(error.code).toBe("REQUEST_FAILED");
    // 关键安全断言：请求绝不能到达跳转目标
    expect(targetHits).toBe(0);
    // 错误消息不回显跳转地址
    expect(error.message).not.toContain(target);
  });
});
