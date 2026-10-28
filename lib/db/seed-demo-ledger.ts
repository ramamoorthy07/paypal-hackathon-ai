import { randomUUID } from "node:crypto";
import { getDb, pingDb, type DbStorage } from "@/lib/db";
import { upsertClientByEmail } from "@/lib/db/repositories/clients";
import { getInvoiceById, insertInvoice } from "@/lib/db/repositories/invoices";
import { insertAuditLog } from "@/lib/db/repositories/audit-log";

const DAY = 86_400_000;

const SEED = [
  {
    id: "demo-inv-paid-acme",
    clientName: "Acme Studio",
    clientEmail: "buyer@personal.example.com",
    amountCents: 12_000,
    status: "PAID" as const,
    dueDateOffsetDays: -20,
    paidAtOffsetDays: -5,
    lineName: "Logo refresh",
    note: "Demo paid invoice for AG Grid Paid-this-month filter",
    paypalInvoiceId: "INV2-DEMO-PAID-ACME",
  },
  {
    id: "demo-inv-sent-beta",
    clientName: "Beta Labs",
    clientEmail: "beta@example.com",
    amountCents: 9_000,
    status: "SENT" as const,
    dueDateOffsetDays: 10,
    paidAtOffsetDays: null as number | null,
    lineName: "Code audit",
    note: "Demo outstanding invoice for cash forecast",
    paypalInvoiceId: "INV2-DEMO-SENT-BETA",
  },
  {
    id: "demo-inv-overdue-gamma",
    clientName: "Gamma Collective",
    clientEmail: "gamma@example.com",
    amountCents: 25_000,
    status: "SENT" as const,
    dueDateOffsetDays: -12,
    paidAtOffsetDays: null as number | null,
    lineName: "Brand system delivery",
    note: "Demo overdue invoice for remind + risk beats",
    paypalInvoiceId: "INV2-DEMO-OVERDUE-GAMMA",
  },
] as const;

export type SeedDemoResult = {
  storage: DbStorage;
  inserted: string[];
  skipped: string[];
  invoiceCount: number;
  demoInvoiceCount: number;
};

/**
 * Idempotent warm ledger for judges. Safe to call on boot when the DB is empty.
 * Demo PayPal ids are placeholders for UI; real Remind/Confirm still need sandbox Confirm.
 */
export async function seedDemoLedger(): Promise<SeedDemoResult> {
  await getDb();
  const before = await pingDb();
  const inserted: string[] = [];
  const skipped: string[] = [];
  const now = Date.now();

  for (const item of SEED) {
    const existing = await getInvoiceById(item.id);
    if (existing) {
      skipped.push(item.id);
      continue;
    }

    const client = await upsertClientByEmail({
      id: randomUUID(),
      name: item.clientName,
      email: item.clientEmail,
      isDemo: true,
    });

    const dueDate = now + item.dueDateOffsetDays * DAY;
    const paidAt =
      item.paidAtOffsetDays == null ? null : now + item.paidAtOffsetDays * DAY;

    await insertInvoice({
      id: item.id,
      clientId: client.id,
      amountCents: item.amountCents,
      currency: "USD",
      status: item.status,
      dueDate,
      issuedAt: now - 30 * DAY,
      paidAt,
      hostedUrl: `https://www.sandbox.paypal.com/invoice/p/#${item.paypalInvoiceId}`,
      paypalInvoiceId: item.paypalInvoiceId,
      lineItems: [
        {
          name: item.lineName,
          quantity: 1,
          unitAmountCents: item.amountCents,
        },
      ],
      createdBy: "seed",
      note: item.note,
      isDemo: true,
    });

    await insertAuditLog({
      id: randomUUID(),
      actor: "seed",
      action: "stage_demo_ledger",
      invoiceId: item.id,
      payload: { status: item.status, amountCents: item.amountCents },
    });

    inserted.push(item.id);
  }

  const after = await pingDb();
  return {
    storage: before.storage,
    inserted,
    skipped,
    invoiceCount: after.invoiceCount,
    demoInvoiceCount: after.demoInvoiceCount,
  };
}

export function shouldSeedOnBoot(): boolean {
  return process.env.SEED_ON_BOOT === "true";
}

/** Run once after migrate when SEED_ON_BOOT=true and the ledger is empty. */
export async function maybeSeedDemoLedgerOnBoot(): Promise<SeedDemoResult | null> {
  if (!shouldSeedOnBoot()) {
    return null;
  }
  const ping = await pingDb();
  if (ping.invoiceCount > 0) {
    return null;
  }
  return seedDemoLedger();
}
