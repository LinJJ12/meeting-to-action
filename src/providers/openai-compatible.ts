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
   * （部分自建网关会这样做），而请求里含会议逐字稿。开启后输出 best-effort 脱敏的
   * 截断片段，仍可能包含敏感内容，仅用于本地排障。
   */
  verboseErrors?: boolean;
}

const DEFAULT_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
/** 非 2xx 响应体只用于 verbose 诊断，单独用更小的上限，避免为排障再扛一次大响应。 */
const ERROR_BODY_MAX_BYTES = 64 * 1024;
const VERBOSE_ERROR_LIMIT = 500;

/**
 * verbose 诊断用的 best-effort 凭据脱敏规则。只覆盖常见形态，无法保证覆盖所有
 * 密钥格式；因此 verbose 仍是 opt-in，文档也提示它可能包含敏感内容。
 * 顺序无关紧要：每条规则都在上一条的结果上继续替换。
 */
const REDACTION_PATTERNS: readonly RegExp[] = [
  // OpenAI 风格的 API key，例如 sk-live-ABC123。
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  // Authorization 头里的 Bearer/Basic/Token 凭据。
  /\b(?:Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]+/gi,
  // api_key: ... / api-key=... 之类的键值对。
  /\bapi[_-]?key\s*[:=]\s*["']?[^\s"',;}]+/gi,
  // secret/token/password 等敏感键值对。
  /\b(?:access[_-]?token|auth(?:orization)?[_-]?token|token|secret|password|passwd|pwd)\s*[:=]\s*["']?[^\s"',;}]+/gi,
  // 类似 SECRET_TRANSCRIPT_TOKEN_4f2a 的裸 token 字面量。
  /\b(?:secret|token|transcript)[_-][A-Za-z0-9_-]{4,}/gi,
  // 出现在 URL 查询串里的凭据参数。
  /[?&](?:api[_-]?key|key|token|secret|access[_-]?token)=[^\s&"']+/gi,
  // JWT。
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
];

function redactSecrets(value: string): string {
  let redacted = value;
  for (const pattern of REDACTION_PATTERNS) redacted = redacted.replace(pattern, "[REDACTED]");
  return redacted;
}

/**
 * 去掉控制字符、best-effort 脱敏常见凭据并压成单行，避免日志注入或终端转义。
 * 先脱敏再截断，避免 secret 恰好被截断成半截后漏出。
 */
function sanitize(value: string, limit: number): string {
  return redactSecrets(value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ""))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

/** JSON 值的类型名，只用于结构错误信息，不回显字段值。 */
function describeJsonType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function invalidResponse(reason: string): ProviderError {
  return new ProviderError(`Model provider response is invalid: ${reason}`, { code: "PROVIDER_RESPONSE_INVALID" });
}

/**
 * 严格校验 chat completion 的响应形状，返回 content 字符串。
 * 错误信息只包含字段路径和 JSON 类型：上游 payload 可能含逐字稿或凭据，
 * 绝不能写进错误消息。
 */
function extractCompletionContent(payload: unknown): string {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw invalidResponse(`root is not an object (type=${describeJsonType(payload)})`);
  }

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) {
    throw invalidResponse(`choices is missing or not an array (type=${describeJsonType(choices)})`);
  }
  if (choices.length === 0) throw invalidResponse("choices is empty");

  const choice: unknown = choices[0];
  if (choice === null || typeof choice !== "object" || Array.isArray(choice)) {
    throw invalidResponse(`choices[0] is not an object (type=${describeJsonType(choice)})`);
  }

  const message = (choice as { message?: unknown }).message;
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
    throw invalidResponse(`choices[0].message is missing or not an object (type=${describeJsonType(message)})`);
  }

  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string") {
    throw invalidResponse(`choices[0].message.content is missing or not a string (type=${describeJsonType(content)})`);
  }
  return content;
}

/** 网络层失败的稳定错误码。 */
type RequestFailureCode = "REQUEST_FAILED" | "REQUEST_TIMEOUT" | "REQUEST_ABORTED";

function requestFailureCode(error: unknown): RequestFailureCode {
  if (error instanceof Error) {
    // Node fetch 在 AbortSignal.timeout 触发时抛 TimeoutError，外部中止抛 AbortError。
    if (error.name === "TimeoutError") return "REQUEST_TIMEOUT";
    if (error.name === "AbortError") return "REQUEST_ABORTED";
  }
  return "REQUEST_FAILED";
}

/** 只保留安全的底层错误标识（如 ECONNREFUSED），绝不带出 URL、请求头或完整错误文本。 */
function requestFailureDetail(error: unknown): string {
  if (!(error instanceof Error)) return "";
  const cause: unknown = error.cause;
  if (cause !== null && typeof cause === "object" && "code" in cause) {
    const { code } = cause as { code?: unknown };
    if (typeof code === "string" && /^[A-Z0-9_]{2,64}$/.test(code)) return code;
  }
  return error.name;
}

function requestFailure(error: unknown, timeoutMs: number): ProviderError {
  const code = requestFailureCode(error);
  if (code === "REQUEST_TIMEOUT") {
    return new ProviderError(`Model request timed out after ${timeoutMs} ms`, { cause: error, code });
  }
  if (code === "REQUEST_ABORTED") {
    return new ProviderError("Model request was aborted", { cause: error, code });
  }
  const detail = requestFailureDetail(error);
  return new ProviderError(detail ? `Model request failed (${detail})` : "Model request failed", {
    cause: error,
    code,
  });
}

/** 提前放弃响应体，释放上游连接；已经结束或中止时忽略失败。 */
async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // 读取已经结束或已被中止，取消失败不影响结果。
  }
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    await cancelBody(response);
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

/**
 * 非 2xx 响应体的有界读取，仅用于 verboseErrors 诊断。
 * 超限、连接中断等任何失败都静默返回空串：诊断信息绝不能改变错误的 HTTP 语义。
 */
async function readErrorBodySilently(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    await cancelBody(response);
    return "";
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
        // 超限：整个片段作废，不保留可能被截断的半截内容。
        return "";
      }
      chunks.push(value);
    }
  } catch {
    return "";
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
      throw requestFailure(error, this.timeoutMs);
    }

    // 先判状态码：错误响应的 body 只用于 verbose 诊断，读取失败/超限都不能
    // 改变 HTTP 语义（否则 4xx/5xx 会被误报成 RESPONSE_TOO_LARGE/BODY_READ_FAILED）。
    if (!response.ok) {
      let detail = "";
      if (this.verboseErrors) {
        const errorBody = await readErrorBodySilently(response, ERROR_BODY_MAX_BYTES);
        const excerpt = sanitize(errorBody, VERBOSE_ERROR_LIMIT);
        if (excerpt) detail = ": " + excerpt;
      } else {
        // 默认不读也不保留响应体：上游可能在 4xx/5xx 里回显请求内容（含逐字稿）。
        await cancelBody(response);
      }
      const status = `${response.status} ${response.statusText}`.trim();
      throw new ProviderError(`Model provider returned HTTP ${status}${detail}`, { code: "HTTP_ERROR" });
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

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      throw new ProviderError("Model provider returned invalid JSON", { cause: error, code: "INVALID_JSON" });
    }

    const content = extractCompletionContent(payload);
    if (!content.trim()) throw new ProviderError("Model provider returned an empty completion", { code: "EMPTY_COMPLETION" });
    return content;
  }
}