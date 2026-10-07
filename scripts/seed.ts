import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { insertAuditLog } from "@/lib/db/repositories/audit-log";
import { upsertClientByEmail } from "@/lib/db/repositories/clients";
import { deleteInvoicesByIds, insertInvoice } from "@/lib/db/repositories/invoices";
import { deleteRemindersForInvoices } from "@/lib/db/repositories/reminders";
import { pingDb } from "@/lib/db";
import type { LineItem } from "@/lib/db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

const seedInvoiceIds = [
  "seed-inv-paid",
  "seed-inv-sent",
  "seed-inv-overdue",
  "seed-inv-cancelled",
  "seed-inv-draft",
] as const;

function line(name: string, unitAmountCents: number, description?: string): LineItem[] {
  return [{ name, description, quantity: 1, unitAmountCents }];
}

export async function seedDemoInvoices(): Promise<void> {
  loadEnvConfig(process.cwd());
  const now = Date.now();

  await deleteRemindersForInvoices([...seedInvoiceIds]);
  await deleteInvoicesByIds([...seedInvoiceIds]);

  const abc = await upsertClientByEmail({
    id: "seed-client-abc",
    name: "ABC Corp",
    email: "buyer@personal.example.com",
  });
  const acme = await upsertClientByEmail({
    id: "seed-client-acme",
    name: "Acme Studio",
    email: "acme@example.com",
  });
  const north = await upsertClientByEmail({
    id: "seed-client-north",
    name: "Northwind LLC",
    email: "ap@northwind.example",
  });

  await insertInvoice({
    id: "seed-inv-paid",
    clientId: abc.id,
    amountCents: 48000,
    currency: "USD",
    status: "PAID",
    dueDate: now - 3 * DAY_MS,
    issuedAt: now - 10 * DAY_MS,
    paidAt: now - 5 * DAY_MS,
    hostedUrl: null,
    lineItems: line("Website redesign", 48000, "Marketing site rebuild"),
    createdBy: "seed",
    note: "Paid seed invoice",
  });

  await insertInvoice({
    id: "seed-inv-sent",
    clientId: acme.id,
    amountCents: 120000,
    currency: "USD",
    status: "SENT",
    dueDate: now + 7 * DAY_MS,
    issuedAt: now - 1 * DAY_MS,
    hostedUrl: null,
    lineItems: line("Brand identity", 120000, "Logo and type system"),
    createdBy: "seed",
    note: "Outstanding, not yet due",
  });

  await insertInvoice({
    id: "seed-inv-overdue",
    clientId: north.id,
    amountCents: 75000,
    currency: "USD",
    status: "SENT",
    dueDate: now - 14 * DAY_MS,
    issuedAt: now - 21 * DAY_MS,
    hostedUrl: null,
    lineItems: line("Landing page", 75000),
    createdBy: "seed",
    note: "Overdue: SENT with a past due date",
  });

  await insertInvoice({
    id: "seed-inv-cancelled",
    clientId: acme.id,
    amountCents: 25000,
    currency: "USD",
    status: "CANCELLED",
    dueDate: now - 2 * DAY_MS,
    issuedAt: now - 9 * DAY_MS,
    hostedUrl: null,
    lineItems: line("Discovery workshop", 25000),
    createdBy: "seed",
    note: "Cancelled seed invoice",
  });

  await insertInvoice({
    id: "seed-inv-draft",
    clientId: abc.id,
    amountCents: 40000,
    currency: "USD",
    status: "DRAFT",
    dueDate: now + 14 * DAY_MS,
    hostedUrl: null,
    lineItems: line("Retainer hours", 40000, "Unused draft"),
    createdBy: "seed",
    originalAmountCents: 3_333_333,
    originalCurrency: "INR",
    fxRate: "0.012",
    note: "Draft proposal — not sent to PayPal",
  });

  await insertAuditLog({
    id: randomUUID(),
    actor: "seed",
    action: "seed.demo_invoices",
    payload: {
      invoiceIds: seedInvoiceIds,
      note: "Local demo rows only; paypal_invoice_id is null",
    },
  });

  const ping = await pingDb();
  console.log(`Seeded demo invoices. Total invoices in DB: ${ping.invoiceCount}`);
}

const invokedDirectly = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/seed.ts");
if (invokedDirectly) {
  seedDemoInvoices().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
