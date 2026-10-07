import { azureOpenAiBaseUrl } from "@/lib/llm/azure";
import type { Env } from "@/lib/env";

export async function pingLlm(env: Env): Promise<{
  provider: "azure" | "openai";
  deployment: string;
  modelCount?: number;
}> {
  if (env.AZURE_OPENAI_ENDPOINT) {
    const url = `${azureOpenAiBaseUrl(env.AZURE_OPENAI_ENDPOINT)}/models`;
    const response = await fetch(url, {
      headers: {
        "api-key": env.OPENAI_API_KEY,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`Azure OpenAI models check failed (${response.status}).`);
    }
    const body: unknown = await response.json();
    const modelCount =
      body && typeof body === "object" && "data" in body && Array.isArray(body.data)
        ? body.data.length
        : undefined;
    return {
      provider: "azure",
      deployment: env.AZURE_OPENAI_DEPLOYMENT,
      modelCount,
    };
  }

  return { provider: "openai", deployment: "gpt-4o" };
}
