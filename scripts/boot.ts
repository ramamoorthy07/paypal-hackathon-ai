import { loadEnvConfig } from "@next/env";
import { getDb, pingDb } from "@/lib/db";

async function boot(): Promise<void> {
  loadEnvConfig(process.cwd());
  await getDb();
  const { invoiceCount } = await pingDb();
  console.log(`Boot ready. invoiceCount=${invoiceCount}`);
}

boot().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
