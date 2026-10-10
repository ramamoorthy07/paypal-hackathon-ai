import { randomUUID } from "node:crypto";
import { generateText } from "ai";
import { insertAuditLog } from "@/lib/db/repositories/audit-log";
import { countRemindersSince, insertReminder } from "@/lib/db/repositories/reminders";
import type { AuditActor, ReminderRow } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { behaviorForClient, reminderToneFromRisk } from "@/lib/insights/behavior";
import {
  fallbackReminderCopy,
  MAX_REMINDERS_PER_UTC_DAY,
  parseReminderCopy,
  reminderCopyPrompt,
  utcDayStart,
  type ReminderCopy,
  type ReminderTone,
} from "@/lib/invoices/reminder-copy";
import { getInvoiceView, listInvoiceViews, type InvoiceView } from "@/lib/invoices/views";
import { languageModel } from "@/lib/llm/provider";
import { plainTextFromGenerateResult } from "@/lib/llm/plain-text";
import { remindInvoice } from "@/lib/paypal/invoicing";

export class RemindError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "RemindError";
    this.status = status;
    this.code = code;
  }
}

export type ReminderSkipReason = "not_overdue" | "no_paypal" | "capped";

export type SentReminder = {
  invoiceId: string;
  reminderId: string;
  subject: string;
  note: string;
  copySource: "model" | "fallback";
};

export type SweepSkip = {
  invoiceId: string;
  reason: ReminderSkipReason | "paypal_error";
  message?: string;
};

export type ReminderSweepResult = {
  considered: number;
  sent: SentReminder[];
  skipped: SweepSkip[];
};

export type SendOverdueReminderResult = {
  reminder: ReminderRow;
  copySource: "model" | "fallback";
  subject: string;
  note: string;
};

export async function composeReminderCopy(
  invoice: InvoiceView,
  options: { now?: number; tone?: ReminderTone } = {},
): Promise<{ copy: ReminderCopy; source: "model" | "fallback"; tone: ReminderTone }> {
  const now = options.now ?? Date.now();
  const tone = options.tone ?? "friendly";
  const fallback = fallbackReminderCopy(invoice, tone);
  try {
    const env = getEnv();
    const result = await generateText({
      model: languageModel(env),
      prompt: reminderCopyPrompt(invoice, now, tone),
      maxOutputTokens: 4000,
    });
    const parsed = parseReminderCopy(plainTextFromGenerateResult(result), tone);
    if (parsed) {
      return { copy: parsed, source: "model", tone };
    }
  } catch (error) {
    console.error("reminder copy failed", error instanceof Error ? error.message : error);
  }
  return { copy: fallback, source: "fallback", tone };
}

export async function reminderToneForInvoice(
  invoice: InvoiceView,
  reminderCountToday: number,
  now = Date.now(),
): Promise<ReminderTone> {
  const invoices = await listInvoiceViews(now);
  const related = invoices.filter((row) => row.clientId === invoice.clientId);
  const behavior = behaviorForClient(invoice.clientId, related, now);
  return reminderToneFromRisk(behavior.riskScore, reminderCountToday);
}

export function reminderEligibility(
  invoice: InvoiceView,
  reminderCountToday: number,
): ReminderSkipReason | null {
  if (invoice.displayStatus !== "OVERDUE") {
    return "not_overdue";
  }
  if (!invoice.paypalInvoiceId) {
    return "no_paypal";
  }
  if (reminderCountToday >= MAX_REMINDERS_PER_UTC_DAY) {
    return "capped";
  }
  return null;
}

function eligibilityMessage(reason: ReminderSkipReason): string {
  switch (reason) {
    case "not_overdue":
      return "Reminders are only sent for overdue invoices.";
    case "no_paypal":
      return "This invoice has not been sent through PayPal.";
    case "capped":
      return `Already sent ${MAX_REMINDERS_PER_UTC_DAY} reminders today (UTC).`;
  }
}

export async function sendOverdueReminder(
  invoiceId: string,
  options: { actor?: AuditActor; now?: number; tone?: ReminderTone } = {},
): Promise<SendOverdueReminderResult> {
  const now = options.now ?? Date.now();
  const actor = options.actor ?? "user";
  const invoice = await getInvoiceView(invoiceId, now);
  if (!invoice) {
    throw new RemindError(404, "not_found", "Invoice was not found.");
  }

  const reminderCountToday = await countRemindersSince(invoice.id, utcDayStart(now));
  const blocked = reminderEligibility(invoice, reminderCountToday);
  const paypalInvoiceId = invoice.paypalInvoiceId;
  if (blocked || !paypalInvoiceId) {
    const reason = blocked ?? "no_paypal";
    throw new RemindError(reason === "capped" ? 429 : 409, reason, eligibilityMessage(reason));
  }

  const tone = options.tone ?? (await reminderToneForInvoice(invoice, reminderCountToday, now));
  const { copy, source } = await composeReminderCopy(invoice, { now, tone });
  const reminderId = randomUUID();

  await remindInvoice({
    paypalInvoiceId,
    localInvoiceId: invoice.id,
    reminderId,
    subject: copy.subject,
    note: copy.note,
  });

  const reminder = await insertReminder({
    id: reminderId,
    invoiceId: invoice.id,
    subject: copy.subject,
    note: copy.note,
    tone: copy.tone,
    sentAt: now,
  });

  await insertAuditLog({
    id: randomUUID(),
    actor,
    action: "remind_invoice",
    invoiceId: invoice.id,
    payload: {
      reminderId,
      paypalInvoiceId,
      copySource: source,
      subject: copy.subject,
      tone: copy.tone,
    },
  });

  return { reminder, copySource: source, subject: copy.subject, note: copy.note };
}

export async function runOverdueReminderSweep(
  options: { actor?: AuditActor; now?: number; tone?: ReminderTone } = {},
): Promise<ReminderSweepResult> {
  const now = options.now ?? Date.now();
  const actor = options.actor ?? "agent";
  const invoices = await listInvoiceViews(now);
  const overdue = invoices.filter((invoice) => invoice.displayStatus === "OVERDUE");
  const sent: SentReminder[] = [];
  const skipped: SweepSkip[] = [];

  for (const invoice of overdue) {
    const reminderCountToday = await countRemindersSince(invoice.id, utcDayStart(now));
    const blocked = reminderEligibility(invoice, reminderCountToday);
    if (blocked) {
      skipped.push({ invoiceId: invoice.id, reason: blocked });
      continue;
    }

    try {
      const result = await sendOverdueReminder(invoice.id, { actor, now });
      sent.push({
        invoiceId: invoice.id,
        reminderId: result.reminder.id,
        subject: result.subject,
        note: result.note,
        copySource: result.copySource,
      });
    } catch (error) {
      if (error instanceof RemindError) {
        skipped.push({
          invoiceId: invoice.id,
          reason: error.code === "capped" || error.code === "no_paypal" || error.code === "not_overdue"
            ? error.code
            : "paypal_error",
          message: error.message,
        });
        continue;
      }
      skipped.push({
        invoiceId: invoice.id,
        reason: "paypal_error",
        message: error instanceof Error ? error.message : "Reminder failed.",
      });
    }
  }

  return { considered: overdue.length, sent, skipped };
}
