import OpenAI from "openai";

import { env } from "../config/env.js";

let openAiClient: OpenAI | null = null;

const getOpenAiClient = (): OpenAI => {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for embeddings");
  }

  if (!openAiClient) {
    openAiClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    });
  }

  return openAiClient;
};

export type EmbeddingResult = {
  embedding: number[];
  inputTokens: number;
  totalTokens: number;
};

export async function generateEmbedding(content: string): Promise<EmbeddingResult> {
  const response = await getOpenAiClient().embeddings.create({
    model: env.EMBEDDING_MODEL,
    input: content,
    dimensions: env.EMBEDDING_DIMENSIONS,
  });
  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("OpenAI embeddings response returned no embedding");
  }
  return {
    embedding,
    inputTokens: response.usage.prompt_tokens,
    totalTokens: response.usage.total_tokens,
  };
}
