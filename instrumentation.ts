export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { warnIfEnvInvalid } = await import("./lib/env");
  warnIfEnvInvalid({ fatal: process.env.NODE_ENV === "production" });

  const { getDb, pingDb } = await import("./lib/db");
  getDb();
  const { invoiceCount } = pingDb();
  if (process.env.SEED_ON_BOOT === "true" && invoiceCount === 0) {
    const { seedDemoInvoices } = await import("./scripts/seed");
    await seedDemoInvoices();
    return;
  }
  console.log(`Boot ready. invoiceCount=${invoiceCount}`);
}
