import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";

import { env } from "../config/env.js";

export type ChatModelBuildOptions = {
  temperature?: number;
  maxTokens?: number;
};

let cachedWorkflowChatModel: BaseChatModel | null = null;
let cachedNarrationChatModel: BaseChatModel | null = null;

const buildOpenAIChatModel = (
  temperature: number,
  maxTokens: number,
): BaseChatModel =>
  new ChatOpenAI({
    apiKey: env.OPENAI_API_KEY,
    model: env.RESOLVED_LLM_MODEL,
    temperature,
    maxTokens,
    timeout: env.LLM_REQUEST_TIMEOUT_MS,
    configuration: env.OPENAI_BASE_URL
      ? { baseURL: env.OPENAI_BASE_URL }
      : undefined,
  });

const buildAnthropicChatModel = (
  temperature: number,
  maxTokens: number,
): BaseChatModel =>
  new ChatAnthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.RESOLVED_LLM_MODEL,
    temperature,
    maxTokens,
    clientOptions: {
      timeout: env.LLM_REQUEST_TIMEOUT_MS,
    },
  });

const buildGoogleGenAIChatModel = (
  temperature: number,
  maxTokens: number,
): BaseChatModel =>
  new ChatGoogleGenerativeAI({
    apiKey: env.GOOGLE_API_KEY,
    model: env.RESOLVED_LLM_MODEL,
    temperature,
    maxOutputTokens: maxTokens,
  });

const buildOllamaChatModel = (
  temperature: number,
  maxTokens: number,
): BaseChatModel =>
  new ChatOllama({
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.RESOLVED_LLM_MODEL,
    temperature,
    numPredict: maxTokens,
  });

export const buildChatModel = (
  options?: ChatModelBuildOptions,
): BaseChatModel => {
  const temperature = options?.temperature ?? env.LLM_TEMPERATURE;
  const maxTokens = options?.maxTokens ?? env.LLM_MAX_TOKENS;

  switch (env.LLM_PROVIDER) {
    case "openai":
      return buildOpenAIChatModel(temperature, maxTokens);
    case "anthropic":
      return buildAnthropicChatModel(temperature, maxTokens);
    case "google":
      return buildGoogleGenAIChatModel(temperature, maxTokens);
    case "ollama":
      return buildOllamaChatModel(temperature, maxTokens);
  }
};

export const getChatModel = (): BaseChatModel => {
  if (!cachedWorkflowChatModel) {
    cachedWorkflowChatModel = buildChatModel();
  }
  return cachedWorkflowChatModel;
};

export const getNarrationChatModel = (): BaseChatModel => {
  if (!cachedNarrationChatModel) {
    cachedNarrationChatModel = buildChatModel({
      temperature: env.NARRATION_LLM_TEMPERATURE,
      maxTokens: env.NARRATION_LLM_MAX_TOKENS,
    });
  }
  return cachedNarrationChatModel;
};

export const resetChatModelCache = (): void => {
  cachedWorkflowChatModel = null;
  cachedNarrationChatModel = null;
};
