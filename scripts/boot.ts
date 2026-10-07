import { loadEnvConfig } from "@next/env";
import { getDb, pingDb } from "@/lib/db";
import { seedDemoInvoices } from "@/scripts/seed";

async function boot(): Promise<void> {
  loadEnvConfig(process.cwd());
  await getDb();
  const { invoiceCount } = await pingDb();
  if (process.env.SEED_ON_BOOT === "true" && invoiceCount === 0) {
    await seedDemoInvoices();
    return;
  }
  console.log(`Boot ready. invoiceCount=${invoiceCount}`);
}

boot().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
