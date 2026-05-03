import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";

import { env } from "../config/env.js";

let cachedChatModel: BaseChatModel | null = null;

const buildOpenAIChatModel = (): BaseChatModel =>
  new ChatOpenAI({
    apiKey: env.OPENAI_API_KEY,
    model: env.RESOLVED_LLM_MODEL,
    temperature: env.LLM_TEMPERATURE,
    maxTokens: env.LLM_MAX_TOKENS,
    timeout: env.LLM_REQUEST_TIMEOUT_MS,
    configuration: env.OPENAI_BASE_URL
      ? { baseURL: env.OPENAI_BASE_URL }
      : undefined,
  });

const buildAnthropicChatModel = (): BaseChatModel =>
  new ChatAnthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.RESOLVED_LLM_MODEL,
    temperature: env.LLM_TEMPERATURE,
    maxTokens: env.LLM_MAX_TOKENS,
    clientOptions: {
      timeout: env.LLM_REQUEST_TIMEOUT_MS,
    },
  });

const buildGoogleGenAIChatModel = (): BaseChatModel =>
  new ChatGoogleGenerativeAI({
    apiKey: env.GOOGLE_API_KEY,
    model: env.RESOLVED_LLM_MODEL,
    temperature: env.LLM_TEMPERATURE,
    maxOutputTokens: env.LLM_MAX_TOKENS,
  });

const buildOllamaChatModel = (): BaseChatModel =>
  new ChatOllama({
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.RESOLVED_LLM_MODEL,
    temperature: env.LLM_TEMPERATURE,
    numPredict: env.LLM_MAX_TOKENS,
  });

export const getChatModel = (): BaseChatModel => {
  if (cachedChatModel) {
    return cachedChatModel;
  }

  switch (env.LLM_PROVIDER) {
    case "openai":
      cachedChatModel = buildOpenAIChatModel();
      break;
    case "anthropic":
      cachedChatModel = buildAnthropicChatModel();
      break;
    case "google":
      cachedChatModel = buildGoogleGenAIChatModel();
      break;
    case "ollama":
      cachedChatModel = buildOllamaChatModel();
      break;
  }

  return cachedChatModel;
};
