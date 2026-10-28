import { describe, expect, it } from "vitest";
import { azureOpenAiBaseUrl } from "@/lib/llm/azure";

describe("azureOpenAiBaseUrl", () => {
  it("appends /openai/v1 to the resource host", () => {
    expect(azureOpenAiBaseUrl("https://capricorn-openai.openai.azure.com/")).toBe(
      "https://capricorn-openai.openai.azure.com/openai/v1",
    );
  });

  it("does not duplicate the v1 suffix", () => {
    expect(azureOpenAiBaseUrl("https://capricorn-openai.openai.azure.com/openai/v1")).toBe(
      "https://capricorn-openai.openai.azure.com/openai/v1",
    );
  });
});
