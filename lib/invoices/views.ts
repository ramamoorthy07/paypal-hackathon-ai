import { getClientById, listClients } from "@/lib/db/repositories/clients";
import { getInvoiceById, listInvoices } from "@/lib/db/repositories/invoices";
import type { InvoiceRow } from "@/lib/db/schema";
import { displayStatus, type DisplayStatus } from "@/lib/invoices/state";

export type InvoiceView = InvoiceRow & {
  clientName: string;
  clientEmail: string;
  displayStatus: DisplayStatus;
};

export function toInvoiceView(
  invoice: InvoiceRow,
  client: { name: string; email: string } | undefined,
  now = Date.now(),
): InvoiceView {
  return {
    ...invoice,
    clientName: client?.name ?? "Unknown client",
    clientEmail: client?.email ?? "",
    displayStatus: displayStatus(invoice, now),
  };
}

export async function listInvoiceViews(now = Date.now()): Promise<InvoiceView[]> {
  const [invoices, clients] = await Promise.all([listInvoices(), listClients()]);
  const byId = new Map(clients.map((client) => [client.id, client]));
  return invoices.map((invoice) => toInvoiceView(invoice, byId.get(invoice.clientId), now));
}

export async function getInvoiceView(
  id: string,
  now = Date.now(),
): Promise<InvoiceView | undefined> {
  const invoice = await getInvoiceById(id);
  if (!invoice) {
    return undefined;
  }
  const client = await getClientById(invoice.clientId);
  return toInvoiceView(invoice, client, now);
}
