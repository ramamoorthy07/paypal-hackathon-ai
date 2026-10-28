export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { warnIfEnvInvalid } = await import("./lib/core/env");
  warnIfEnvInvalid({ fatal: process.env.NODE_ENV === "production" });

  const { initDb } = await import("./lib/db");
  await initDb();

  if (
    process.env.NODE_ENV === "test" ||
    process.env.VITEST ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }

  try {
    const { getEnv } = await import("./lib/core/env");
    getEnv();
    const { reconcileInvoicesFromPaypal } = await import("./lib/invoices/actions/reconcile");
    const summary = await reconcileInvoicesFromPaypal({ actor: "webhook" });
    console.log(
      `PayPal reconcile: scanned=${summary.scanned} updated=${summary.updated} inserted=${summary.inserted} skipped=${summary.skipped} errors=${summary.errors}`,
    );
  } catch (error) {
    console.error(
      "PayPal reconcile on boot skipped",
      error instanceof Error ? error.message : error,
    );
  }
}
