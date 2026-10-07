import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  invoices,
  type CreatedBy,
  type InvoiceRow,
  type InvoiceStatus,
  type LineItem,
} from "@/lib/db/schema";

export type NewInvoice = {
  id: string;
  paypalInvoiceId?: string | null;
  paypalInvoiceNumber?: string | null;
  clientId: string;
  amountCents: number;
  currency?: string;
  status: InvoiceStatus;
  dueDate?: number | null;
  issuedAt?: number | null;
  paidAt?: number | null;
  hostedUrl?: string | null;
  lineItems: LineItem[];
  createdBy: CreatedBy;
  note?: string | null;
  originalAmountCents?: number | null;
  originalCurrency?: string | null;
  fxRate?: string | null;
  isDemo?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

export type InvoiceUpdate = Partial<
  Omit<NewInvoice, "id" | "clientId" | "createdBy" | "createdAt" | "lineItems">
> & {
  lineItems?: LineItem[];
};

export async function insertInvoice(input: NewInvoice): Promise<InvoiceRow> {
  const now = Date.now();
  const row: InvoiceRow = {
    id: input.id,
    paypalInvoiceId: input.paypalInvoiceId ?? null,
    paypalInvoiceNumber: input.paypalInvoiceNumber ?? null,
    clientId: input.clientId,
    amountCents: input.amountCents,
    currency: input.currency ?? "USD",
    status: input.status,
    dueDate: input.dueDate ?? null,
    issuedAt: input.issuedAt ?? null,
    paidAt: input.paidAt ?? null,
    hostedUrl: input.hostedUrl ?? null,
    lineItems: input.lineItems,
    createdBy: input.createdBy,
    note: input.note ?? null,
    originalAmountCents: input.originalAmountCents ?? null,
    originalCurrency: input.originalCurrency ?? null,
    fxRate: input.fxRate ?? null,
    isDemo: input.isDemo ?? false,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };

  const database = await getDb();
  await database.insert(invoices).values(row).run();
  return row;
}

export async function getInvoiceById(id: string): Promise<InvoiceRow | undefined> {
  const database = await getDb();
  return database.select().from(invoices).where(eq(invoices.id, id)).get();
}

export async function getInvoiceByPaypalId(
  paypalInvoiceId: string,
): Promise<InvoiceRow | undefined> {
  const database = await getDb();
  return database
    .select()
    .from(invoices)
    .where(eq(invoices.paypalInvoiceId, paypalInvoiceId))
    .get();
}

export async function listInvoices(): Promise<InvoiceRow[]> {
  const database = await getDb();
  return database.select().from(invoices).orderBy(desc(invoices.createdAt)).all();
}

export async function listInvoicesByIds(ids: string[]): Promise<InvoiceRow[]> {
  if (ids.length === 0) {
    return [];
  }
  const database = await getDb();
  return database.select().from(invoices).where(inArray(invoices.id, ids)).all();
}

export async function updateInvoice(id: string, patch: InvoiceUpdate): Promise<InvoiceRow> {
  const database = await getDb();
  await database
    .update(invoices)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(invoices.id, id))
    .run();
  const updated = await getInvoiceById(id);
  if (!updated) {
    throw new Error(`Invoice ${id} was not found after update.`);
  }
  return updated;
}

export async function deleteInvoicesByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const database = await getDb();
  await database.delete(invoices).where(inArray(invoices.id, ids)).run();
}
