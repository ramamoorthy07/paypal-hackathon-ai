import { createAzure } from "@ai-sdk/azure";
import { openai } from "@ai-sdk/openai";
import { azureOpenAiBaseUrl } from "@/lib/llm/azure";
import type { Env } from "@/lib/env";

export function languageModel(env: Env) {
  if (env.AZURE_OPENAI_ENDPOINT) {
    const azure = createAzure({
      baseURL: azureOpenAiBaseUrl(env.AZURE_OPENAI_ENDPOINT),
      apiKey: env.OPENAI_API_KEY,
    });
    return azure.chat(env.AZURE_OPENAI_DEPLOYMENT);
  }

  return openai("gpt-4o");
}
