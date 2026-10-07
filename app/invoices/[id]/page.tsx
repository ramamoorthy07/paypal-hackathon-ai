import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { InvoiceQr } from "@/components/invoice-qr";
import { InvoiceStatusSync } from "@/components/invoice-status-sync";
import { StatusBadge } from "@/components/status-badge";
import { getInvoiceView } from "@/lib/invoices/views";
import { centsToAmountString, isoDateFromMs } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoiceView(id);
  if (!invoice) {
    notFound();
  }

  const inr =
    invoice.originalCurrency === "INR" && invoice.originalAmountCents != null
      ? {
          amount: centsToAmountString(invoice.originalAmountCents),
          rate: invoice.fxRate,
        }
      : null;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader title="Invoice" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6">
        <p className="text-sm text-zinc-500">
          <a className="underline" href="/invoices">
            All invoices
          </a>
        </p>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                {invoice.clientName}
              </h2>
              <p className="text-sm text-zinc-500">{invoice.clientEmail}</p>
            </div>
            <StatusBadge status={invoice.displayStatus} />
          </div>

          <p className="mt-4 text-3xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
            ${centsToAmountString(invoice.amountCents)} {invoice.currency}
          </p>

          {inr ? (
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
              Converted from ₹{inr.amount} at labeled demo rate {inr.rate} USD per 1 INR.
            </p>
          ) : null}

          <dl className="mt-4 grid gap-2 text-sm text-zinc-600 dark:text-zinc-300 sm:grid-cols-2">
            <div>
              <dt className="text-xs tracking-wide text-zinc-500 uppercase">Due</dt>
              <dd>{invoice.dueDate != null ? isoDateFromMs(invoice.dueDate) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-zinc-500 uppercase">Issued</dt>
              <dd>{invoice.issuedAt != null ? isoDateFromMs(invoice.issuedAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-zinc-500 uppercase">Paid</dt>
              <dd>{invoice.paidAt != null ? isoDateFromMs(invoice.paidAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-zinc-500 uppercase">PayPal id</dt>
              <dd className="break-all">{invoice.paypalInvoiceId ?? "Not sent"}</dd>
            </div>
          </dl>

          {invoice.note ? <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">{invoice.note}</p> : null}

          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {invoice.lineItems.map((item) => (
              <li key={`${item.name}-${item.unitAmountCents}`} className="flex justify-between py-2 text-sm">
                <span>
                  {item.name}
                  <span className="block text-xs text-zinc-500">
                    {item.quantity} × ${centsToAmountString(item.unitAmountCents)}
                  </span>
                </span>
                <span className="tabular-nums">
                  ${centsToAmountString(item.quantity * item.unitAmountCents)}
                </span>
              </li>
            ))}
          </ul>

          {invoice.hostedUrl ? (
            <a
              className="mt-4 inline-block text-sm text-sky-800 underline dark:text-sky-200"
              href={invoice.hostedUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open PayPal payer link
            </a>
          ) : null}

          <div className="mt-5 flex flex-wrap items-start gap-4">
            {invoice.paypalInvoiceId ? (
              <InvoiceStatusSync invoiceId={invoice.id} displayStatus={invoice.displayStatus} />
            ) : (
              <p className="text-sm text-zinc-500">Local draft only — PayPal is not contacted until confirm.</p>
            )}
            {invoice.paypalInvoiceId && invoice.status !== "DRAFT" ? (
              <InvoiceQr invoiceId={invoice.id} />
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
