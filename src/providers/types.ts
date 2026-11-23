export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface AnalysisProvider {
  complete(messages: ChatMessage[]): Promise<string>;
}

export class ProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProviderError";
  }
}
