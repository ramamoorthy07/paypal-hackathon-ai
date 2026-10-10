import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const invoiceStatuses = ["DRAFT", "SENT", "PAID", "CANCELLED"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export const auditActors = ["user", "agent", "webhook", "seed", "simulator"] as const;
export type AuditActor = (typeof auditActors)[number];

export const createdByValues = ["user", "agent", "seed"] as const;
export type CreatedBy = (typeof createdByValues)[number];

export type LineItem = {
  name: string;
  description?: string;
  quantity: number;
  unitAmountCents: number;
};

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("clients_email_uidx").on(table.email)],
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    paypalInvoiceId: text("paypal_invoice_id"),
    paypalInvoiceNumber: text("paypal_invoice_number"),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    status: text("status").notNull().$type<InvoiceStatus>(),
    dueDate: integer("due_date"),
    issuedAt: integer("issued_at"),
    paidAt: integer("paid_at"),
    hostedUrl: text("hosted_url"),
    lineItems: text("line_items", { mode: "json" }).notNull().$type<LineItem[]>(),
    createdBy: text("created_by").notNull().$type<CreatedBy>(),
    note: text("note"),
    originalAmountCents: integer("original_amount_cents"),
    originalCurrency: text("original_currency"),
    fxRate: text("fx_rate"),
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("invoices_paypal_invoice_id_uidx").on(table.paypalInvoiceId),
    index("invoices_status_idx").on(table.status),
    index("invoices_client_id_idx").on(table.clientId),
  ],
);

export const webhookEvents = sqliteTable("webhook_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  processedAt: integer("processed_at").notNull(),
});

export const reminders = sqliteTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id),
    sentAt: integer("sent_at").notNull(),
    subject: text("subject").notNull(),
    note: text("note").notNull(),
    tone: text("tone").notNull().default("friendly").$type<"friendly" | "firm" | "final">(),
  },
  (table) => [index("reminders_invoice_id_idx").on(table.invoiceId)],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    timestamp: integer("timestamp").notNull(),
    actor: text("actor").notNull().$type<AuditActor>(),
    action: text("action").notNull(),
    invoiceId: text("invoice_id"),
    payload: text("payload").notNull(),
  },
  (table) => [index("audit_log_invoice_id_idx").on(table.invoiceId)],
);

export type ClientRow = typeof clients.$inferSelect;
export type InvoiceRow = typeof invoices.$inferSelect;
export type WebhookEventRow = typeof webhookEvents.$inferSelect;
export type ReminderRow = typeof reminders.$inferSelect;
export type AuditLogRow = typeof auditLog.$inferSelect;
