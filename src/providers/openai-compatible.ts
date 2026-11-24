import { ProviderError, type AnalysisProvider, type ChatMessage } from "./types.js";

export interface OpenAICompatibleOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** 响应体最大字节数，超出即中止读取，默认 8 MiB。 */
  maxResponseBytes?: number;
  /**
   * 出错时是否带上响应体摘要。默认关闭：provider 的错误响应体可能回显请求内容
   * （部分自建网关会这样做），而请求里含会议逐字稿。开启后只输出脱敏截断片段，
   * 仅用于本地排障。
   */
  verboseErrors?: boolean;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

const DEFAULT_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const VERBOSE_ERROR_LIMIT = 500;

/** 去掉控制字符并压成单行，避免日志注入或终端转义。 */
function sanitize(value: string, limit: number): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ProviderError(`Model provider response exceeded ${maxBytes} bytes`, { code: "RESPONSE_TOO_LARGE" });
  }

  const body = response.body;
  if (!body) return "";

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new ProviderError(`Model provider response exceeded ${maxBytes} bytes`, { code: "RESPONSE_TOO_LARGE" });
      }
      chunks.push(value);
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // 读取已经结束或已被中止，取消失败不影响结果。
    }
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

export class OpenAICompatibleProvider implements AnalysisProvider {
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;
  private readonly verboseErrors: boolean;

  constructor(private readonly options: OpenAICompatibleOptions) {
    if (!options.apiKey.trim()) throw new ProviderError("OPENAI_API_KEY is required");
    if (!options.model.trim()) throw new ProviderError("OPENAI_MODEL is required");
    this.endpoint = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "") + "/chat/completions";
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    this.verboseErrors = options.verboseErrors ?? false;
  }

  async complete(messages: ChatMessage[]): Promise<string> {
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          authorization: "Bearer " + this.options.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.options.model,
          messages,
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new ProviderError(
        error instanceof Error ? "Model request failed: " + error.message : "Model request failed",
        { cause: error, code: "REQUEST_FAILED" },
      );
    }

    // 读取响应体本身也可能超时或中止，必须包裹成 ProviderError，并限制大小。
    let body: string;
    try {
      body = await readBoundedText(response, this.maxResponseBytes);
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError("Model provider response could not be read", {
        cause: error,
        code: "BODY_READ_FAILED",
      });
    }

    if (!response.ok) {
      // 默认不把响应体写进错误：上游可能在 4xx/5xx 里回显请求内容（含逐字稿）。
      const detail = this.verboseErrors ? ": " + sanitize(body, VERBOSE_ERROR_LIMIT) : "";
      throw new ProviderError(`Model provider returned HTTP ${response.status}${detail}`, { code: "HTTP_ERROR" });
    }

    let payload: ChatCompletionResponse;
    try {
      payload = JSON.parse(body) as ChatCompletionResponse;
    } catch (error) {
      throw new ProviderError("Model provider returned invalid JSON", { cause: error, code: "INVALID_JSON" });
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content?.trim()) throw new ProviderError("Model provider returned an empty completion", { code: "EMPTY_COMPLETION" });
    return content;
  }
}