export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AnalysisProvider {
  complete(messages: ChatMessage[]): Promise<string>;
}

export interface ProviderErrorOptions extends ErrorOptions {
  /** 稳定的机器可读错误码，例如 HTTP_ERROR / RESPONSE_TOO_LARGE / BODY_READ_FAILED。 */
  code?: string;
}

export class ProviderError extends Error {
  readonly code: string | undefined;

  constructor(message: string, options?: ProviderErrorOptions) {
    super(message, options);
    this.name = "ProviderError";
    this.code = options?.code;
  }
}
