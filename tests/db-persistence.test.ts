import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initDb, pingDb, resetDbForTests } from "@/lib/db";
import { seedDemoInvoices } from "@/scripts/seed";

describe("libsql persistence", () => {
  let previousUrl: string | undefined;
  let dir: string | undefined;

  afterEach(async () => {
    await resetDbForTests();
    if (previousUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousUrl;
    }
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("migrates a file database, seeds demo rows once, and flags them is_demo", async () => {
    previousUrl = process.env.DATABASE_URL;
    dir = await mkdtemp(join(tmpdir(), "paypilot-db-"));
    process.env.DATABASE_URL = `file:${join(dir, "paypilot.db")}`;
    await resetDbForTests();

    await initDb();
    const empty = await pingDb();
    expect(empty).toMatchObject({
      invoiceCount: 0,
      demoInvoiceCount: 0,
      driver: "libsql",
      storage: "file",
    });

    await seedDemoInvoices();
    const seeded = await pingDb();
    expect(seeded.invoiceCount).toBe(25);
    expect(seeded.demoInvoiceCount).toBe(25);

    await seedDemoInvoices();
    const skipped = await pingDb();
    expect(skipped.invoiceCount).toBe(25);
  });
});
