import { generateText } from "ai";
import { getEnv } from "@/lib/env";
import { earningsSnapshot, monthlySummaryPrompt, type EarningsSnapshot } from "@/lib/invoices/earnings";
import { listInvoiceViews } from "@/lib/invoices/views";
import { languageModel } from "@/lib/llm/provider";

export type MonthlySummaryResult = {
  monthKey: string;
  monthLabel: string;
  text: string;
  snapshot: EarningsSnapshot;
};

export async function generateMonthlySummary(now = Date.now()): Promise<MonthlySummaryResult> {
  const env = getEnv();
  const invoices = await listInvoiceViews(now);
  const snapshot = earningsSnapshot(invoices, now);
  const result = await generateText({
    model: languageModel(env),
    prompt: monthlySummaryPrompt(snapshot),
    maxOutputTokens: 4000,
  });

  const text =
    result.text.trim() ||
    result.content
      .flatMap((part) => (part.type === "text" && part.text ? [part.text] : []))
      .join("\n")
      .trim();

  if (!text) {
    console.error("monthly summary empty", {
      contentTypes: result.content.map((part) => part.type),
      usage: result.usage,
    });
    throw new Error("The model returned an empty monthly summary.");
  }

  return {
    monthKey: snapshot.monthKey,
    monthLabel: snapshot.monthLabel,
    text,
    snapshot,
  };
}
