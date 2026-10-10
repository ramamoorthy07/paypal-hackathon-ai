import { loadEnvConfig } from "@next/env";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { paypalApiBase, resetEnvCache } from "@/lib/env";
import { centsToAmountString } from "@/lib/money";
import { getAccessToken } from "@/lib/paypal/client";
import {
  createDraftInvoice,
  getInvoice,
  sendInvoiceAsShareLink,
} from "@/lib/paypal/invoicing";
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";

type PathResult = {
  path: "record-payment" | "payouts" | "kernel";
  attempted: boolean;
  success: boolean;
  runs?: string;
  detail: string;
};

function skip(path: PathResult["path"], detail: string): PathResult {
  return { path, attempted: false, success: false, detail };
}

function fail(path: PathResult["path"], detail: string): PathResult {
  return { path, attempted: true, success: false, detail };
}

function ok(path: PathResult["path"], detail: string, runs?: string): PathResult {
  return { path, attempted: true, success: true, detail, runs };
}

function redact(value: string): string {
  if (value.length <= 8) {
    return "(redacted)";
  }
  return `${value.slice(0, 4)}…${value.slice(-2)}`;
}

async function recordOnePayment(run: number): Promise<{ paypalId: string; status: string }> {
  const created = await createDraftInvoice({
    localInvoiceId: `spike-record-${Date.now()}-${run}`,
    recipientEmail: "buyer@personal.example.com",
    recipientName: "Sandbox Buyer",
    items: [{ name: "Spike record-payment", quantity: 1, unitAmountCents: 100 }],
  });
  await sendInvoiceAsShareLink({
    paypalInvoiceId: created.id,
    localInvoiceId: `spike-record-send-${Date.now()}-${run}`,
    sendToRecipient: false,
  });

  const env = {
    clientId: process.env.PAYPAL_CLIENT_ID ?? "",
    clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? "",
  };
  const toolkit = new PayPalAgentToolkit({
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    configuration: {
      actions: { invoices: { recordPayment: true } },
      context: { sandbox: true },
    },
  });
  const tools = toolkit.getTools() as Record<
    string,
    { execute?: (args: unknown, opts?: unknown) => Promise<unknown> }
  >;
  const record = tools.record_payment_for_invoice;
  if (!record?.execute) {
    throw new Error("record_payment_for_invoice is not on the toolkit");
  }
  await record.execute(
    {
      invoice_id: created.id,
      method: "OTHER",
      note: "PayPilot client-agent spike (external record, not a buyer checkout)",
      amount: { currency_code: "USD", value: centsToAmountString(100) },
    },
    { toolCallId: `spike-record-${run}`, messages: [] },
  );

  const after = await getInvoice(created.id);
  return { paypalId: created.id, status: after.status };
}

async function tryRecordPayment(): Promise<PathResult> {
  const results: string[] = [];
  for (let run = 1; run <= 5; run += 1) {
    try {
      const row = await recordOnePayment(run);
      results.push(`run ${run}: ${row.paypalId} ${row.status}`);
      if (row.status !== "PAID" && row.status !== "MARKED_AS_PAID" && row.status !== "PARTIALLY_PAID") {
        return fail("record-payment", results.join("; "));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push(`run ${run}: ${message}`);
      return fail("record-payment", results.join("; "));
    }
  }
  return ok("record-payment", "5/5 toolkit record_payment_for_invoice marked the invoice paid (external OTHER).", `5/5\n${results.join("\n")}`);
}

async function tryPayouts(): Promise<PathResult> {
  const receiver = process.env.PAYPAL_PAYOUT_RECEIVER?.trim();
  if (!receiver) {
    return skip(
      "payouts",
      "Skipped: set PAYPAL_PAYOUT_RECEIVER (sandbox Personal email) to try Payouts. Payouts send money; they do not mark an Invoicing invoice PAID.",
    );
  }

  try {
    const token = await getAccessToken();
    const body = {
      sender_batch_header: {
        sender_batch_id: `paypilot-spike-${Date.now()}`,
        email_subject: "PayPilot spike",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value: "1.00", currency: "USD" },
          receiver,
          note: "Spike only — not an invoice payment",
        },
      ],
    };
    const response = await fetch(`${paypalApiBase("sandbox")}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) {
      return fail("payouts", `HTTP ${response.status}: ${text.slice(0, 300)}`);
    }
    return ok(
      "payouts",
      `Payouts API accepted a $1 sandbox payout (batch ${redact(JSON.stringify(body.sender_batch_header))}). This does not attach to an invoice and will not fire INVOICING.INVOICE.PAID.`,
    );
  } catch (error) {
    return fail("payouts", error instanceof Error ? error.message : String(error));
  }
}

async function tryKernel(): Promise<PathResult> {
  const key = process.env.KERNEL_API_KEY?.trim();
  if (!key) {
    return skip(
      "kernel",
      "Skipped: KERNEL_API_KEY is not set. Cannot open a Kernel cloud browser as the sandbox Personal buyer.",
    );
  }

  try {
    const response = await fetch("https://api.onkernel.com/browsers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({}),
    });
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      return fail("kernel", `Kernel rejected the API key (HTTP ${response.status}).`);
    }
    if (!response.ok) {
      return fail("kernel", `Kernel HTTP ${response.status}: ${text.slice(0, 240)}`);
    }
    return fail(
      "kernel",
      "Kernel created a browser session, but this spike does not log in as the sandbox Personal buyer or complete PayPal checkout (no buyer password in git; no Playwright pay flow wired). Session was not used to pay.",
    );
  } catch (error) {
    return fail("kernel", error instanceof Error ? error.message : String(error));
  }
}

function markdown(results: PathResult[]): string {
  const record = results.find((row) => row.path === "record-payment");
  const working = results.filter((row) => row.success);
  const recommendation =
    record?.success === true
      ? "Use **record-payment** only as a merchant-side mark-paid. It is not a client paying. Do **not** ship a client-agent that records OTHER payments — that bypasses the buyer. For a real client-agent, a human (or Kernel with buyer credentials) must open the share link. **Drop the client-agent product** unless Kernel + buyer login is funded."
      : working.length > 0
        ? `Working path: ${working.map((row) => row.path).join(", ")}.`
        : "None of the three payment paths completed a real buyer PAID. **Drop the client-agent** and keep HITL share-link + webhook/poll.";

  return [
    "# Spike: PayPal Agent Toolkit + a client agent",
    "",
    "PayPilot's HITL rule is unchanged: **the model never creates or sends a PayPal invoice**. Confirm in the UI is the only write path.",
    "",
    "This spike asked whether a *client* agent can **pay** a sandbox invoice (not whether we can list toolkit tools).",
    "",
    "## Paths tried",
    "",
    "| Path | Attempted | Success | Detail |",
    "| --- | --- | --- | --- |",
    ...results.map(
      (row) =>
        `| ${row.path} | ${row.attempted ? "yes" : "no"} | ${row.success ? "yes" : "no"} | ${row.detail.replace(/\|/g, "/").slice(0, 400)} |`,
    ),
    "",
    record?.runs ? `### record-payment runs\n\n\`\`\`\n${record.runs}\n\`\`\`\n` : "",
    "## Webhook PAID",
    "",
    "This spike polled `GET /v2/invoicing/invoices/{id}` after each record-payment. Status `MARKED_AS_PAID` is merchant-recorded, not a Personal buyer checkout. It did not wait for `INVOICING.INVOICE.PAID` on Render.",
    "",
    "## Recommendation",
    "",
    recommendation,
    "",
    "## Toolkit vs REST (confirm path)",
    "",
    "See [docs/TOOLKIT_CONFIRM.md](TOOLKIT_CONFIRM.md). Chat still only gets list/search.",
    "",
    "## How to rerun",
    "",
    "```bash",
    "npm run spike:client-agent",
    "```",
    "",
    "Optional env (never commit values): `PAYPAL_PAYOUT_RECEIVER`, `KERNEL_API_KEY`.",
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  resetEnvCache();

  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    const report = markdown([
      skip("record-payment", "PAYPAL_CLIENT_ID / SECRET missing"),
      skip("payouts", "PAYPAL_CLIENT_ID / SECRET missing"),
      skip("kernel", "Not reached"),
    ]);
    writeFileSync(resolve(process.cwd(), "docs/SPIKE_CLIENT_AGENT.md"), report);
    console.log(report);
    return;
  }

  const results: PathResult[] = [];
  results.push(await tryRecordPayment());
  results.push(await tryPayouts());
  results.push(await tryKernel());

  const report = markdown(results);
  writeFileSync(resolve(process.cwd(), "docs/SPIKE_CLIENT_AGENT.md"), report);
  process.stdout.write(report);
  process.stdout.write("\n");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
