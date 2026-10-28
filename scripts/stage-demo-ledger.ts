/**
 * Stage a warm judge ledger (paid + sent + overdue demo rows).
 *
 *   npx tsx scripts/stage-demo-ledger.ts
 *
 * Prefer Turso in production (DATABASE_URL + DATABASE_AUTH_TOKEN).
 * With SEED_ON_BOOT=true the same seed also runs automatically when the DB is empty.
 */
import { seedDemoLedger } from "@/lib/db/seed-demo-ledger";
import { initDb, pingDb } from "@/lib/db";

async function main(): Promise<void> {
  await initDb();
  const before = await pingDb();
  console.log(`before storage=${before.storage} invoices=${before.invoiceCount}`);
  if (before.storage === "file") {
    console.warn(
      "WARNING: DATABASE_URL is a local file. On Render free Docker this will wipe on restart unless Turso is configured.",
    );
  }
  const result = await seedDemoLedger();
  console.log(
    `done storage=${result.storage} inserted=${result.inserted.join(",") || "(none)"} skipped=${result.skipped.join(",") || "(none)"} invoices=${result.invoiceCount} demo=${result.demoInvoiceCount}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
