import OpenAI from "openai";
import { mapOpenAIProviderError } from "../ai/provider-error.js";
import type { EmbeddingProvider } from "./select-candidates.js";

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    timeoutMs: number
  ) {
    this.client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 1 });
  }

  async embed(inputs: string[]): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: inputs,
        encoding_format: "float",
        dimensions: 512
      });
      return response.data
        .sort((left, right) => left.index - right.index)
        .map((item) => item.embedding);
    } catch (error) {
      throw mapOpenAIProviderError(error);
    }
  }
}
