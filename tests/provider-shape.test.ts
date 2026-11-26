import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { OpenAICompatibleProvider } from "../src/providers/openai-compatible.js";
import { ProviderError } from "../src/providers/types.js";

const servers: Server[] = [];
const PRIVATE_TRANSCRIPT = "SECRET_TRANSCRIPT_TOKEN_4f2a alice said the launch is cancelled";

async function stubServer(body: string): Promise<string> {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(body);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}/v1`;
}

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

function provider(baseUrl: string): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    apiKey: "test-key",
    model: "test-model",
    baseUrl,
    timeoutMs: 5_000,
  });
}

/** 用 stub 返回给定 payload，断言得到 ProviderError 并返回它。 */
async function invalidResponse(payload: unknown): Promise<ProviderError> {
  const baseUrl = await stubServer(JSON.stringify(payload));
  const error = await provider(baseUrl)
    .complete([{ role: "user", content: PRIVATE_TRANSCRIPT }])
    .catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ProviderError);
  return error as ProviderError;
}

/** 结构错误只允许带字段路径与类型，不能回显上游payload或请求内容。 */
function expectNoEcho(error: ProviderError): void {
  expect(error.message).not.toContain("SECRET_TRANSCRIPT_TOKEN_4f2a");
  expect(error.message).not.toContain("alice said");
  expect(error.message).not.toContain("launch is cancelled");
  expect(error.message.length).toBeLessThan(300);
}

describe("provider 响应形状校验", () => {
  it("payload 为 null 时返回 PROVIDER_RESPONSE_INVALID", async () => {
    const error = await invalidResponse(null);

    expect(error.code).toBe("PROVIDER_RESPONSE_INVALID");
    expect(error.message).toMatch(/root is not an object \(type=null\)/);
    expectNoEcho(error);
  });

  it("顶层 JSON 是数组时同样按结构错误处理", async () => {
    const error = await invalidResponse([]);

    expect(error.code).toBe("PROVIDER_RESPONSE_INVALID");
    expect(error.message).toMatch(/root is not an object \(type=array\)/);
    expectNoEcho(error);
  });

  it("缺少 choices 时返回结构错误，且不回显上游正文", async () => {
    const error = await invalidResponse({ error: PRIVATE_TRANSCRIPT });

    expect(error.code).toBe("PROVIDER_RESPONSE_INVALID");
    expect(error.message).toMatch(/choices is missing or not an array \(type=undefined\)/);
    expectNoEcho(error);
  });

  it("choices 为空数组时返回结构错误", async () => {
    const error = await invalidResponse({ choices: [] });

    expect(error.code).toBe("PROVIDER_RESPONSE_INVALID");
    expect(error.message).toMatch(/choices is empty/);
    expectNoEcho(error);
  });

  it("choices[0] 不是对象时返回结构错误", async () => {
    const error = await invalidResponse({ choices: [42] });

    expect(error.code).toBe("PROVIDER_RESPONSE_INVALID");
    expect(error.message).toMatch(/choices\[0\] is not an object \(type=number\)/);
    expectNoEcho(error);
  });

  it("choices[0].message 不是对象时返回结构错误，且不回显正文", async () => {
    const error = await invalidResponse({ choices: [{ message: PRIVATE_TRANSCRIPT }] });

    expect(error.code).toBe("PROVIDER_RESPONSE_INVALID");
    expect(error.message).toMatch(
      /choices\[0\]\.message is missing or not an object \(type=string\)/,
    );
    expectNoEcho(error);
  });

  it("content 为数字时返回结构错误", async () => {
    const error = await invalidResponse({ choices: [{ message: { content: 123 } }] });

    expect(error.code).toBe("PROVIDER_RESPONSE_INVALID");
    expect(error.message).toMatch(
      /choices\[0\]\.message\.content is missing or not a string \(type=number\)/,
    );
    expectNoEcho(error);
  });

  it("content 为布尔值时返回结构错误", async () => {
    const error = await invalidResponse({ choices: [{ message: { content: true } }] });

    expect(error.code).toBe("PROVIDER_RESPONSE_INVALID");
    expect(error.message).toMatch(/content is missing or not a string \(type=boolean\)/);
    expectNoEcho(error);
  });

  it("content 为对象时返回结构错误，且不回显对象内容", async () => {
    const error = await invalidResponse({
      choices: [{ message: { content: { transcript: PRIVATE_TRANSCRIPT } } }],
    });

    expect(error.code).toBe("PROVIDER_RESPONSE_INVALID");
    expect(error.message).toMatch(/content is missing or not a string \(type=object\)/);
    expectNoEcho(error);
  });

  it("content 为 null 时返回结构错误", async () => {
    const error = await invalidResponse({ choices: [{ message: { content: null } }] });

    expect(error.code).toBe("PROVIDER_RESPONSE_INVALID");
    expect(error.message).toMatch(/content is missing or not a string \(type=null\)/);
    expectNoEcho(error);
  });

  it("content 字段缺失时返回结构错误", async () => {
    const error = await invalidResponse({ choices: [{ message: {} }] });

    expect(error.code).toBe("PROVIDER_RESPONSE_INVALID");
    expect(error.message).toMatch(/content is missing or not a string \(type=undefined\)/);
    expectNoEcho(error);
  });

  it("正常 string content 原样返回", async () => {
    const baseUrl = await stubServer(
      JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
    );

    await expect(provider(baseUrl).complete([{ role: "user", content: "x" }])).resolves.toBe(
      '{"ok":true}',
    );
  });

  it("空字符串与纯空白 content 仍按 EMPTY_COMPLETION 处理", async () => {
    for (const content of ["", "   "]) {
      const baseUrl = await stubServer(JSON.stringify({ choices: [{ message: { content } }] }));
      const error = await provider(baseUrl)
        .complete([{ role: "user", content: "x" }])
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).code).toBe("EMPTY_COMPLETION");
    }
  });
});
