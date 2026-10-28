import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initDb, resetDbForTests } from "@/lib/db";
import { seedDemoLedger } from "@/lib/db/seed-demo-ledger";

describe("seedDemoLedger", () => {
  let previousUrl: string | undefined;
  let previousSeed: string | undefined;
  let dir: string | undefined;

  afterEach(async () => {
    await resetDbForTests();
    if (previousUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousUrl;
    }
    if (previousSeed === undefined) {
      delete process.env.SEED_ON_BOOT;
    } else {
      process.env.SEED_ON_BOOT = previousSeed;
    }
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("inserts three demo invoices idempotently", async () => {
    previousUrl = process.env.DATABASE_URL;
    previousSeed = process.env.SEED_ON_BOOT;
    dir = await mkdtemp(join(tmpdir(), "paypilot-seed-"));
    process.env.DATABASE_URL = `file:${join(dir, "paypilot.db")}`;
    process.env.SEED_ON_BOOT = "false";
    await resetDbForTests();
    await initDb();

    const first = await seedDemoLedger();
    expect(first.inserted).toHaveLength(3);
    expect(first.demoInvoiceCount).toBe(3);

    const second = await seedDemoLedger();
    expect(second.inserted).toHaveLength(0);
    expect(second.skipped).toHaveLength(3);
    expect(second.invoiceCount).toBe(3);
  });
});
