import { ProviderError, type AnalysisProvider, type ChatMessage } from "./types.js";

export interface OpenAICompatibleOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
}

export class OpenAICompatibleProvider implements AnalysisProvider {
  private readonly endpoint: string;
  private readonly timeoutMs: number;

  constructor(private readonly options: OpenAICompatibleOptions) {
    if (!options.apiKey.trim()) throw new ProviderError("OPENAI_API_KEY is required");
    if (!options.model.trim()) throw new ProviderError("OPENAI_MODEL is required");
    this.endpoint = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "") + "/chat/completions";
    this.timeoutMs = options.timeoutMs ?? 60_000;
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
        { cause: error },
      );
    }

    const body = await response.text();
    if (!response.ok) {
      let detail = body.slice(0, 1200);
      try {
        const parsed = JSON.parse(body) as ChatCompletionResponse;
        detail = parsed.error?.message ?? detail;
      } catch {
        // Keep the bounded response body for providers with non-standard errors.
      }
      throw new ProviderError(`Model provider returned HTTP ${response.status}: ${detail}`);
    }

    let payload: ChatCompletionResponse;
    try {
      payload = JSON.parse(body) as ChatCompletionResponse;
    } catch (error) {
      throw new ProviderError("Model provider returned invalid JSON", { cause: error });
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content?.trim()) throw new ProviderError("Model provider returned an empty completion");
    return content;
  }
}
