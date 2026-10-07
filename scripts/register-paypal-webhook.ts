import { loadEnvConfig } from "@next/env";
import { getEnv, paypalApiBase } from "@/lib/env";
import { getAccessToken } from "@/lib/paypal/client";

const EVENT_TYPES = [
  { name: "INVOICING.INVOICE.PAID" },
  { name: "INVOICING.INVOICE.CANCELLED" },
] as const;

type PaypalWebhook = {
  id?: string;
  url?: string;
  event_types?: Array<{ name?: string }>;
};

function webhookUrl(appBase: string): string {
  return `${appBase.replace(/\/$/, "")}/api/webhooks/paypal`;
}

async function paypalJson(path: string, init: RequestInit): Promise<{ status: number; body: unknown }> {
  const env = getEnv();
  const token = await getAccessToken();
  const response = await fetch(`${paypalApiBase(env.PAYPAL_MODE)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown = undefined;
  if (text.trim()) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { raw: text.slice(0, 200) };
    }
  }
  return { status: response.status, body };
}

async function listWebhooks(): Promise<PaypalWebhook[]> {
  const { status, body } = await paypalJson("/v1/notifications/webhooks", { method: "GET" });
  if (status >= 400) {
    throw new Error(`List webhooks failed (${status}).`);
  }
  const webhooks = (body as { webhooks?: PaypalWebhook[] } | undefined)?.webhooks;
  return Array.isArray(webhooks) ? webhooks : [];
}

async function createWebhook(url: string): Promise<string> {
  const { status, body } = await paypalJson("/v1/notifications/webhooks", {
    method: "POST",
    body: JSON.stringify({ url, event_types: EVENT_TYPES }),
  });
  const id = (body as PaypalWebhook | undefined)?.id;
  if (status >= 400 || !id) {
    const name = (body as { name?: string } | undefined)?.name;
    const message = (body as { message?: string } | undefined)?.message;
    throw new Error(`Create webhook failed (${status}) ${name ?? ""} ${message ?? ""}`.trim());
  }
  return id;
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const appBase = (process.argv[2] ?? process.env.APP_URL ?? "").trim();
  if (!appBase.startsWith("https://")) {
    throw new Error("Usage: npx tsx scripts/register-paypal-webhook.ts https://<service>.onrender.com");
  }

  getEnv();
  const url = webhookUrl(appBase);
  const existing = await listWebhooks();
  const match = existing.find((hook) => hook.url === url);
  const webhookId = match?.id ?? (await createWebhook(url));
  console.log(`PAYPAL_WEBHOOK_ID=${webhookId}`);
  console.log(`url=${url}`);
  console.log(match?.id ? "Reused existing sandbox webhook." : "Created sandbox webhook.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
