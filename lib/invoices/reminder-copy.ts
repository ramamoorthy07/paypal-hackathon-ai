import { centsToAmountString, isoDateFromMs } from "@/lib/money";
import { sanitizeUntrustedText } from "@/lib/sanitize";
import type { InvoiceView } from "@/lib/invoices/views";

export const MAX_REMINDERS_PER_UTC_DAY = 2;
export const REMINDER_SUBJECT_MAX = 80;
export const REMINDER_NOTE_MAX = 500;

export type ReminderCopy = {
  subject: string;
  note: string;
};

export function utcDayStart(now = Date.now()): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function daysOverdue(dueDateMs: number, now = Date.now()): number {
  return Math.max(1, Math.floor((now - dueDateMs) / 86_400_000));
}

export function reminderFacts(invoice: InvoiceView, now = Date.now()): string {
  const due = invoice.dueDate != null ? isoDateFromMs(invoice.dueDate) : "unknown";
  const overdue =
    invoice.dueDate != null ? `${daysOverdue(invoice.dueDate, now)} day(s)` : "unknown";
  const work = invoice.lineItems.map((item) => item.name).join(", ") || "completed work";

  return [
    `Client: ${invoice.clientName}`,
    `Amount: $${centsToAmountString(invoice.amountCents)} ${invoice.currency}`,
    `Due: ${due}`,
    `Days overdue: ${overdue}`,
    `Work: ${work}`,
  ].join("\n");
}

export function reminderCopyPrompt(invoice: InvoiceView, now = Date.now()): string {
  return `You write the subject and note for a PayPal invoice reminder email.

Use only these facts. Do not invent amounts, dates, or work. Do not include email addresses or payment links. Polite and brief. Subject under ${REMINDER_SUBJECT_MAX} characters. Note 2-3 sentences.

${reminderFacts(invoice, now)}

Reply exactly in this form:
SUBJECT: ...
NOTE: ...`;
}

export function fallbackReminderCopy(invoice: InvoiceView): ReminderCopy {
  const amount = centsToAmountString(invoice.amountCents);
  const due = invoice.dueDate != null ? isoDateFromMs(invoice.dueDate) : "the due date";
  return {
    subject: clip(`Reminder: ${invoice.clientName} invoice is overdue`, REMINDER_SUBJECT_MAX),
    note: clip(
      `Hi ${invoice.clientName}, your invoice for $${amount} ${invoice.currency} was due ${due}. Please complete payment when you can.`,
      REMINDER_NOTE_MAX,
    ),
  };
}

export function parseReminderCopy(raw: string): ReminderCopy | null {
  const subjectMatch = raw.match(/SUBJECT:\s*(.+)/i);
  const noteMatch = raw.match(/NOTE:\s*([\s\S]+)/i);
  const subject = subjectMatch?.[1]?.trim();
  const note = noteMatch?.[1]?.trim();
  if (!subject || !note) {
    return null;
  }
  return {
    subject: clip(sanitizeUntrustedText(subject, REMINDER_SUBJECT_MAX), REMINDER_SUBJECT_MAX),
    note: clip(sanitizeUntrustedText(note, REMINDER_NOTE_MAX), REMINDER_NOTE_MAX),
  };
}

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max).trim();
}
