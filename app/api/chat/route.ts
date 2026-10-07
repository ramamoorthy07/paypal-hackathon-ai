import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { toUiMessages } from "@/lib/agent/messages";
import { agentSystemPrompt } from "@/lib/agent/prompt";
import { chatStreamErrorMessage } from "@/lib/agent/stream-error";
import { agentTools } from "@/lib/agent/tools";
import { denyIfAbusive } from "@/lib/access/abuse";
import { getEnv } from "@/lib/env";
import { getInrUsdQuote } from "@/lib/fx/quote";
import { languageModel } from "@/lib/llm/provider";
import { paypalReadOnlyAgentTools } from "@/lib/paypal/read-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const chatBodySchema = z.object({
  messages: z.array(z.unknown()).min(1),
});

export async function POST(req: Request): Promise<Response> {
  let env;
  try {
    env = getEnv();
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Environment is invalid.",
      },
      { status: 503 },
    );
  }

  const denied = denyIfAbusive(req, { llm: true });
  if (denied) {
    return denied;
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = chatBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "messages array is required." }, { status: 400 });
  }

  const messages = await convertToModelMessages(toUiMessages(parsed.data.messages));
  const fx = await getInrUsdQuote();

  const result = streamText({
    model: languageModel(env),
    system: agentSystemPrompt({
      maxInvoiceUsd: env.MAX_INVOICE_USD,
      inrUsdRate: fx.usdPerInr,
      fxSource: fx.source,
      fxAsOfDate: fx.asOfDate,
    }),
    messages,
    tools: {
      ...agentTools,
      ...(paypalReadOnlyAgentTools() as typeof agentTools),
    },
    stopWhen: stepCountIs(5),
    onError: ({ error }) => {
      console.error("chat stream error", error instanceof Error ? error.message : error);
    },
  });

  return result.toUIMessageStreamResponse({
    onError: chatStreamErrorMessage,
  });
}
