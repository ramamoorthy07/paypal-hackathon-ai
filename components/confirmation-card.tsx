"use client";

import { useEffect, useState } from "react";
import { centsToAmountString, isoDateFromMs } from "@/lib/money";

export type DraftProposal = {
  invoiceId: string;
  clientName: string;
  clientEmail: string;
  amountCents: number;
  currency: string;
  lineItems: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitAmountCents: number;
  }>;
  dueDate: number | null;
  notes: string | null;
  originalAmountCents: number | null;
  originalCurrency: string | null;
  fxRate: string | null;
  fxSource?: "live" | "fallback" | null;
  fxFetchedAt?: number | null;
  fxAsOfDate?: string | null;
};

export type SentInvoice = {
  invoiceId: string;
  hostedUrl: string;
  paypalInvoiceId: string;
  alreadySent?: boolean;
};

type ConfirmResponse =
  | ({ ok: true } & SentInvoice)
  | { ok: false; error: string };

function isDraftProposal(value: unknown): value is DraftProposal {
  if (!value || typeof value !== "object") {
    return false;
  }
  const rec = value as Record<string, unknown>;
  return (
    rec.ok === true &&
    rec.paypalSent === false &&
    typeof rec.invoiceId === "string" &&
    typeof rec.clientName === "string" &&
    typeof rec.clientEmail === "string" &&
    typeof rec.amountCents === "number" &&
    Array.isArray(rec.lineItems)
  );
}

export function proposalFromToolOutput(output: unknown): DraftProposal | null {
  return isDraftProposal(output) ? output : null;
}

function toolErrorMessage(output: unknown): string | null {
  if (!output || typeof output !== "object") {
    return null;
  }
  const rec = output as Record<string, unknown>;
  if (rec.ok === false && typeof rec.message === "string") {
    return rec.message;
  }
  return null;
}

export function ConfirmationCard({
  output,
  state,
}: {
  output: unknown;
  state: string;
}) {
  if (state !== "output-available") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        Drafting a local invoice…
      </div>
    );
  }

  const error = toolErrorMessage(output);
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        {error}
      </div>
    );
  }

  const proposal = proposalFromToolOutput(output);
  if (!proposal) {
    return null;
  }

  return <ConfirmDraftCard proposal={proposal} />;
}

function ConfirmDraftCard({ proposal }: { proposal: DraftProposal }) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<SentInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState(false);
  const [fx, setFx] = useState<{
    usdPerInrLabel: string;
    source: "live" | "fallback";
    fetchedAt: number;
    asOfDate: string | null;
  } | null>(null);

  useEffect(() => {
    if (proposal.originalCurrency !== "INR") {
      return;
    }
    let cancelled = false;
    void fetch("/api/fx")
      .then(async (response) => {
        const body = (await response.json()) as {
          ok?: boolean;
          usdPerInrLabel?: string;
          source?: "live" | "fallback";
          fetchedAt?: number;
          asOfDate?: string | null;
        };
        if (!cancelled && response.ok && body.ok && body.usdPerInrLabel && body.source && body.fetchedAt) {
          setFx({
            usdPerInrLabel: body.usdPerInrLabel,
            source: body.source,
            fetchedAt: body.fetchedAt,
            asOfDate: body.asOfDate ?? null,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [proposal.originalCurrency]);

  if (dismissed && !sent) {
    return (
      <p className="text-sm text-zinc-500">
        Draft kept locally. Confirm later when you are ready to send.
      </p>
    );
  }

  async function onConfirm(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/invoices/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: proposal.invoiceId, emailRecipient }),
      });
      const body = (await response.json()) as ConfirmResponse;
      if (!response.ok || !body.ok) {
        setError(!body.ok ? body.error : `Confirm failed (${response.status}).`);
        return;
      }
      setSent(body);
    } catch {
      setError("Could not reach the confirm endpoint.");
    } finally {
      setPending(false);
    }
  }

  const inr =
    proposal.originalCurrency === "INR" && proposal.originalAmountCents != null
      ? {
          amount: centsToAmountString(proposal.originalAmountCents),
          rate: proposal.fxRate,
        }
      : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            {sent ? "Sent in PayPal sandbox" : "Confirm before PayPal"}
          </p>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Invoice for {proposal.clientName}
          </h2>
        </div>
        <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          {sent ? "SENT" : "DRAFT"}
        </span>
      </header>

      <div className="space-y-3 px-4 py-4 text-sm">
        <p className="text-zinc-600 dark:text-zinc-400">
          {proposal.clientEmail}
          {proposal.dueDate != null ? ` · due ${isoDateFromMs(proposal.dueDate)}` : ""}
        </p>

        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {proposal.lineItems.map((item) => (
            <li key={`${item.name}-${item.unitAmountCents}`} className="flex justify-between gap-3 py-2">
              <span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{item.name}</span>
                <span className="block text-xs text-zinc-500">
                  {item.quantity} × ${centsToAmountString(item.unitAmountCents)}
                </span>
              </span>
              <span className="tabular-nums text-zinc-900 dark:text-zinc-50">
                ${centsToAmountString(item.quantity * item.unitAmountCents)}
              </span>
            </li>
          ))}
        </ul>

        <p className="flex justify-between border-t border-zinc-100 pt-3 text-base font-semibold text-zinc-950 dark:border-zinc-800 dark:text-zinc-50">
          <span>Total USD</span>
          <span className="tabular-nums">${centsToAmountString(proposal.amountCents)}</span>
        </p>

        {inr ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
            Converted from ₹{inr.amount} at {fx?.usdPerInrLabel ?? inr.rate} USD per 1 INR
            {fx?.source === "live"
              ? ` (live Frankfurter${fx.asOfDate ? `, as of ${fx.asOfDate}` : ""}; fetched ${new Date(fx.fetchedAt).toISOString()})`
              : fx?.source === "fallback"
                ? " (env fallback — live FX was unavailable)"
                : " (rate stored on this draft)"}
            . You confirmed this conversion before the draft was saved.
          </p>
        ) : null}

        {proposal.notes ? (
          <p className="text-xs text-zinc-500">Note: {proposal.notes}</p>
        ) : null}

        {sent ? (
          <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
              Share this PayPal sandbox link with your client.
            </p>
            <a
              className="block truncate text-sm text-emerald-800 underline dark:text-emerald-200"
              href={sent.hostedUrl}
              target="_blank"
              rel="noreferrer"
            >
              {sent.hostedUrl}
            </a>
            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
              PayPal invoice {sent.paypalInvoiceId}
              {sent.alreadySent ? " · already sent" : ""}
            </p>
            <a className="text-sm text-emerald-900 underline dark:text-emerald-100" href={`/invoices/${sent.invoiceId}`}>
              Open invoice
            </a>
          </div>
        ) : (
          <>
            <p className="text-xs text-zinc-500">
              Confirm creates a real PayPal sandbox invoice and a payer share link
              (`send_to_recipient: false` unless you also email). Nothing reaches PayPal until you
              confirm.
            </p>
            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={emailRecipient}
                onChange={(event) => setEmailRecipient(event.target.checked)}
              />
              Also email the invoice via PayPal
            </label>
            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => void onConfirm()}
                className="inline-flex h-10 items-center rounded-full bg-[#003087] px-4 text-sm font-medium text-white disabled:opacity-60"
              >
                {pending ? "Sending…" : "Confirm and send share link"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setDismissed(true)}
                className="inline-flex h-10 items-center rounded-full border border-zinc-200 px-4 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
              >
                Not now
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
