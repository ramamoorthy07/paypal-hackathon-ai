import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { redactPayload } from "@/lib/db/redact";
import { auditLog, type AuditActor, type AuditLogRow } from "@/lib/db/schema";

export type NewAuditLog = {
  id: string;
  actor: AuditActor;
  action: string;
  invoiceId?: string | null;
  payload: unknown;
  timestamp?: number;
};

export async function insertAuditLog(input: NewAuditLog): Promise<AuditLogRow> {
  const row: AuditLogRow = {
    id: input.id,
    timestamp: input.timestamp ?? Date.now(),
    actor: input.actor,
    action: input.action,
    invoiceId: input.invoiceId ?? null,
    payload: redactPayload(input.payload),
  };
  getDb().insert(auditLog).values(row).run();
  return row;
}

export async function listRecentAuditLogs(limit = 50): Promise<AuditLogRow[]> {
  return getDb().select().from(auditLog).orderBy(desc(auditLog.timestamp)).limit(limit).all();
}
