import type { InvoiceProposal } from "@/lib/agent/schema";
import type { LineItem } from "@/lib/db/schema";
import { usdCentsFromInrPaise } from "@/lib/money";
import { sanitizeEmail, sanitizeUntrustedText } from "@/lib/sanitize";

export type ProposalLimits = {
  maxInvoiceUsd: number;
};

export type EvaluatedProposal = {
  ok: true;
  clientName: string;
  clientEmail: string;
  lineItems: LineItem[];
  amountCents: number;
  currency: "USD";
  dueDateMs: number | null;
  note: string | null;
  originalAmountCents: number | null;
  originalCurrency: string | null;
  fxRate: string | null;
};

export type ProposalRejection = {
  ok: false;
  code:
    | "invalid_client"
    | "invalid_email"
    | "empty_items"
    | "invalid_amount"
    | "over_limit"
    | "fx_unconfirmed"
    | "fx_mismatch"
    | "invalid_due_date";
  message: string;
};

export type EvaluateProposalResult = EvaluatedProposal | ProposalRejection;

function reject(
  code: ProposalRejection["code"],
  message: string,
): ProposalRejection {
  return { ok: false, code, message };
}

export function evaluateProposal(
  raw: InvoiceProposal,
  limits: ProposalLimits,
): EvaluateProposalResult {
  const clientName = sanitizeUntrustedText(raw.clientName, 200);
  const clientEmail = sanitizeEmail(raw.clientEmail);
  if (!clientName) {
    return reject("invalid_client", "Client name is required.");
  }
  if (!clientEmail) {
    return reject("invalid_email", "Client email is missing or invalid.");
  }

  const lineItems: LineItem[] = raw.lineItems
    .map((item) => {
      const name = sanitizeUntrustedText(item.name, 120);
      const description = item.description
        ? sanitizeUntrustedText(item.description, 1000)
        : undefined;
      return {
        name,
        description: description && description.length > 0 ? description : undefined,
        quantity: item.quantity,
        unitAmountCents: item.unitAmountCents,
      };
    })
    .filter((item) => item.name.length > 0);

  if (lineItems.length === 0) {
    return reject("empty_items", "Add at least one line item.");
  }

  const amountCents = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitAmountCents,
    0,
  );
  if (amountCents <= 0) {
    return reject("invalid_amount", "Invoice total must be greater than zero.");
  }

  const maxCents = Math.round(limits.maxInvoiceUsd * 100);
  if (amountCents > maxCents) {
    return reject(
      "over_limit",
      `Invoice total exceeds the ${limits.maxInvoiceUsd} USD sandbox cap.`,
    );
  }

  if (raw.originalInrAmountCents != null) {
    if (raw.fxConfirmedByUser !== true || raw.fxRateUsed == null || raw.fxRateUsed <= 0) {
      return reject(
        "fx_unconfirmed",
        "INR amounts convert to USD only after the user confirms the labeled demo rate.",
      );
    }
    const expectedUsdCents = usdCentsFromInrPaise(raw.originalInrAmountCents, raw.fxRateUsed);
    if (Math.abs(expectedUsdCents - amountCents) > 1) {
      return reject(
        "fx_mismatch",
        "USD line items must match the INR amount converted at the labeled demo rate.",
      );
    }
  }

  let dueDateMs: number | null = null;
  if (raw.dueDate) {
    const parsed = Date.parse(`${raw.dueDate}T00:00:00.000Z`);
    if (Number.isNaN(parsed)) {
      return reject("invalid_due_date", "dueDate must be YYYY-MM-DD.");
    }
    dueDateMs = parsed;
  }

  const note = raw.notes ? sanitizeUntrustedText(raw.notes, 4000) : null;

  return {
    ok: true,
    clientName,
    clientEmail,
    lineItems,
    amountCents,
    currency: "USD",
    dueDateMs,
    note: note && note.length > 0 ? note : null,
    originalAmountCents: raw.originalInrAmountCents ?? null,
    originalCurrency: raw.originalInrAmountCents != null ? "INR" : null,
    fxRate: raw.fxRateUsed != null ? String(raw.fxRateUsed) : null,
  };
}
