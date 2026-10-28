import { generateText } from "ai";
import type { ClientBehavior } from "@/lib/insights/behavior";
import { getEnv } from "@/lib/core/env";
import { centsToAmountString } from "@/lib/core/money";
import { languageModel } from "@/lib/llm/provider";
import { plainTextFromGenerateResult } from "@/lib/llm/plain-text";

export function whyRiskPrompt(behavior: ClientBehavior): string {
  return `Explain this freelancer's client payment risk in at most two short sentences.

Use only these computed facts. Do not invent invoices, change the score, or do arithmetic.

Client: ${behavior.clientName}
riskScore: ${behavior.riskScore} (${behavior.riskBand})
lateRate: ${behavior.lateRate}
avgDaysToPay: ${behavior.avgDaysToPay ?? "n/a"}
paidCount: ${behavior.paidCount}
openOverdueCount: ${behavior.openOverdueCount}
openOverdueUsd: $${centsToAmountString(behavior.openOverdueCents)}

The score was already computed in code as clamp(round(55 * lateRate + 2.5 * avgDaysLate + 8 * openOverdueCount), 0, 100).`;
}

export async function explainClientRisk(behavior: ClientBehavior): Promise<string> {
  const env = getEnv();
  const result = await generateText({
    model: languageModel(env),
    prompt: whyRiskPrompt(behavior),
    maxOutputTokens: 400,
  });
  const text = plainTextFromGenerateResult(result);
  if (!text) {
    return `${behavior.clientName} is ${behavior.riskBand} risk (${behavior.riskScore}) because lateRate is ${behavior.lateRate} with ${behavior.openOverdueCount} open overdue invoice(s).`;
  }
  return text;
}
