import { and, count, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { reminders, type ReminderRow } from "@/lib/db/schema";

export type NewReminder = {
  id: string;
  invoiceId: string;
  subject: string;
  note: string;
  sentAt?: number;
};

export async function insertReminder(input: NewReminder): Promise<ReminderRow> {
  const row: ReminderRow = {
    id: input.id,
    invoiceId: input.invoiceId,
    subject: input.subject,
    note: input.note,
    sentAt: input.sentAt ?? Date.now(),
  };
  (await getDb()).insert(reminders).values(row).run();
  return row;
}

export async function listRemindersForInvoice(invoiceId: string): Promise<ReminderRow[]> {
  return (await getDb())
    .select()
    .from(reminders)
    .where(eq(reminders.invoiceId, invoiceId))
    .orderBy(desc(reminders.sentAt))
    .all();
}

export async function countRemindersSince(invoiceId: string, sinceMs: number): Promise<number> {
  const row = (await getDb())
    .select({ value: count() })
    .from(reminders)
    .where(and(eq(reminders.invoiceId, invoiceId), gte(reminders.sentAt, sinceMs)))
    .get();
  return row?.value ?? 0;
}

export async function deleteRemindersForInvoices(invoiceIds: string[]): Promise<void> {
  const database = await getDb();
  for (const invoiceId of invoiceIds) {
    database.delete(reminders).where(eq(reminders.invoiceId, invoiceId)).run();
  }
}
