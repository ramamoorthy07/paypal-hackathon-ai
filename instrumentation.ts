export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { warnIfEnvInvalid } = await import("./lib/env");
  warnIfEnvInvalid({ fatal: process.env.NODE_ENV === "production" });

  const { initDb, pingDb } = await import("./lib/db");
  await initDb();

  if (process.env.SEED_ON_BOOT === "true") {
    const { invoiceCount } = await pingDb();
    if (invoiceCount === 0) {
      const { seedDemoInvoices } = await import("./scripts/seed");
      await seedDemoInvoices();
    }
  }
}
