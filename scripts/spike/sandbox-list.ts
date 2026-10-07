import { loadEnvConfig } from "@next/env";
import { resetEnvCache } from "@/lib/env";
import { listPaypalInvoices } from "@/lib/paypal/invoicing";

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  resetEnvCache();

  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    console.log("Spike skipped: PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set.");
    return;
  }

  const listed = await listPaypalInvoices(1, 5);
  const items = listed.items ?? [];
  console.log(`Sandbox invoice page: ${items.length} item(s), total_items=${listed.total_items ?? "n/a"}.`);
  for (const item of items) {
    console.log(`  - ${item.id ?? "no-id"} ${item.status ?? "unknown"}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
