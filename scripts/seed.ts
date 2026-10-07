import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { insertAuditLog } from "@/lib/db/repositories/audit-log";
import { upsertClientByEmail } from "@/lib/db/repositories/clients";
import { deleteInvoicesByIds, insertInvoice } from "@/lib/db/repositories/invoices";
import { deleteRemindersForInvoices } from "@/lib/db/repositories/reminders";
import { pingDb } from "@/lib/db";
import type { InvoiceStatus, LineItem } from "@/lib/db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

type SeedSpec = {
  id: string;
  clientId: string;
  amountCents: number;
  status: InvoiceStatus;
  dueShiftDays: number;
  issuedShiftDays: number;
  paidShiftDays?: number;
  work: string;
};

function line(name: string, unitAmountCents: number, description?: string): LineItem[] {
  return [{ name, description, quantity: 1, unitAmountCents }];
}

const seedInvoiceIds: string[] = [];

export async function seedDemoInvoices(): Promise<void> {
  loadEnvConfig(process.cwd());
  const pingBefore = await pingDb();
  if (pingBefore.invoiceCount > 0) {
    console.log(
      `Seed skipped; database already has ${pingBefore.invoiceCount} invoice(s).`,
    );
    return;
  }

  const now = Date.now();

  const abc = await upsertClientByEmail({
    id: "seed-client-abc",
    name: "ABC Corp",
    email: "buyer@personal.example.com",
    isDemo: true,
  });
  const acme = await upsertClientByEmail({
    id: "seed-client-acme",
    name: "Acme Studio",
    email: "acme@example.com",
    isDemo: true,
  });
  const north = await upsertClientByEmail({
    id: "seed-client-north",
    name: "Northwind LLC",
    email: "ap@northwind.example",
    isDemo: true,
  });
  const pixel = await upsertClientByEmail({
    id: "seed-client-pixel",
    name: "Pixel Forge",
    email: "pay@pixelforge.example",
    isDemo: true,
  });
  const harbor = await upsertClientByEmail({
    id: "seed-client-harbor",
    name: "Harbor Legal",
    email: "ap@harborlegal.example",
    isDemo: true,
  });

  const specs: SeedSpec[] = [
    // ABC Corp — on-time (low risk)
    { id: "seed-inv-paid", clientId: abc.id, amountCents: 48000, status: "PAID", dueShiftDays: -3, issuedShiftDays: -10, paidShiftDays: -5, work: "Website redesign" },
    { id: "seed-abc-2", clientId: abc.id, amountCents: 22000, status: "PAID", dueShiftDays: -40, issuedShiftDays: -50, paidShiftDays: -42, work: "Icon set" },
    { id: "seed-abc-3", clientId: abc.id, amountCents: 31000, status: "PAID", dueShiftDays: -70, issuedShiftDays: -80, paidShiftDays: -71, work: "Landing copy" },
    { id: "seed-abc-4", clientId: abc.id, amountCents: 18000, status: "PAID", dueShiftDays: -100, issuedShiftDays: -110, paidShiftDays: -101, work: "QA pass" },
    { id: "seed-inv-draft", clientId: abc.id, amountCents: 40000, status: "DRAFT", dueShiftDays: 14, issuedShiftDays: 0, work: "Retainer hours" },
    // Acme Studio — mixed
    { id: "seed-inv-sent", clientId: acme.id, amountCents: 120000, status: "SENT", dueShiftDays: 7, issuedShiftDays: -1, work: "Brand identity" },
    { id: "seed-inv-cancelled", clientId: acme.id, amountCents: 25000, status: "CANCELLED", dueShiftDays: -2, issuedShiftDays: -9, work: "Discovery workshop" },
    { id: "seed-acme-3", clientId: acme.id, amountCents: 54000, status: "PAID", dueShiftDays: -20, issuedShiftDays: -30, paidShiftDays: -12, work: "Packaging" },
    { id: "seed-acme-4", clientId: acme.id, amountCents: 41000, status: "PAID", dueShiftDays: -55, issuedShiftDays: -65, paidShiftDays: -56, work: "Type specimen" },
    { id: "seed-acme-5", clientId: acme.id, amountCents: 33000, status: "PAID", dueShiftDays: -90, issuedShiftDays: -100, paidShiftDays: -78, work: "Motion bumper" },
    // Northwind — chronic late
    { id: "seed-inv-overdue", clientId: north.id, amountCents: 75000, status: "SENT", dueShiftDays: -14, issuedShiftDays: -21, work: "Landing page" },
    { id: "seed-north-2", clientId: north.id, amountCents: 88000, status: "PAID", dueShiftDays: -25, issuedShiftDays: -40, paidShiftDays: -8, work: "Storefront" },
    { id: "seed-north-3", clientId: north.id, amountCents: 61000, status: "PAID", dueShiftDays: -60, issuedShiftDays: -75, paidShiftDays: -45, work: "Checkout flow" },
    { id: "seed-north-4", clientId: north.id, amountCents: 45000, status: "PAID", dueShiftDays: -95, issuedShiftDays: -110, paidShiftDays: -70, work: "Email templates" },
    { id: "seed-north-5", clientId: north.id, amountCents: 52000, status: "SENT", dueShiftDays: -4, issuedShiftDays: -18, work: "Nav rewrite" },
    // Pixel Forge — thin history
    { id: "seed-pixel-1", clientId: pixel.id, amountCents: 27000, status: "PAID", dueShiftDays: -12, issuedShiftDays: -20, paidShiftDays: -13, work: "Sprite sheet" },
    { id: "seed-pixel-2", clientId: pixel.id, amountCents: 19000, status: "SENT", dueShiftDays: 11, issuedShiftDays: -2, work: "Tileset" },
    { id: "seed-pixel-3", clientId: pixel.id, amountCents: 15000, status: "DRAFT", dueShiftDays: 21, issuedShiftDays: 0, work: "Portrait pack" },
    { id: "seed-pixel-4", clientId: pixel.id, amountCents: 36000, status: "PAID", dueShiftDays: -45, issuedShiftDays: -55, paidShiftDays: -46, work: "UI kit" },
    { id: "seed-pixel-5", clientId: pixel.id, amountCents: 24000, status: "SENT", dueShiftDays: 18, issuedShiftDays: -1, work: "Idle animation" },
    // Harbor Legal — high overdue
    { id: "seed-harbor-1", clientId: harbor.id, amountCents: 95000, status: "SENT", dueShiftDays: -21, issuedShiftDays: -35, work: "Case microsite" },
    { id: "seed-harbor-2", clientId: harbor.id, amountCents: 64000, status: "SENT", dueShiftDays: -8, issuedShiftDays: -22, work: "PDF accessibility" },
    { id: "seed-harbor-3", clientId: harbor.id, amountCents: 42000, status: "PAID", dueShiftDays: -50, issuedShiftDays: -70, paidShiftDays: -30, work: "Clause library" },
    { id: "seed-harbor-4", clientId: harbor.id, amountCents: 38000, status: "PAID", dueShiftDays: -80, issuedShiftDays: -95, paidShiftDays: -58, work: "Onboarding form" },
    { id: "seed-harbor-5", clientId: harbor.id, amountCents: 29000, status: "CANCELLED", dueShiftDays: -15, issuedShiftDays: -28, work: "Unused brief" },
  ];

  for (const spec of specs) {
    seedInvoiceIds.push(spec.id);
  }

  await deleteRemindersForInvoices(seedInvoiceIds);
  await deleteInvoicesByIds(seedInvoiceIds);

  for (const spec of specs) {
    const issuedAt = spec.status === "DRAFT" ? null : now + spec.issuedShiftDays * DAY_MS;
    const paidAt = spec.status === "PAID" && spec.paidShiftDays != null ? now + spec.paidShiftDays * DAY_MS : null;
    await insertInvoice({
      id: spec.id,
      clientId: spec.clientId,
      amountCents: spec.amountCents,
      currency: "USD",
      status: spec.status,
      dueDate: now + spec.dueShiftDays * DAY_MS,
      issuedAt,
      paidAt,
      hostedUrl: null,
      lineItems: line(spec.work, spec.amountCents),
      createdBy: "seed",
      isDemo: true,
      originalAmountCents: spec.id === "seed-inv-draft" ? 3_333_333 : null,
      originalCurrency: spec.id === "seed-inv-draft" ? "INR" : null,
      fxRate: spec.id === "seed-inv-draft" ? "0.012" : null,
      note: "Demo row (is_demo=true); not created in PayPal",
    });
  }

  await insertAuditLog({
    id: randomUUID(),
    actor: "seed",
    action: "seed.demo_invoices",
    payload: {
      invoiceIds: seedInvoiceIds,
      note: "25 demo invoices across 5 clients for payment-behavior intelligence",
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
