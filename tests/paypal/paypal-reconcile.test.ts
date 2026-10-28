import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initDb, resetDbForTests } from "@/lib/db";
import { upsertClientByEmail } from "@/lib/db/repositories/clients";
import { getInvoiceByPaypalId, insertInvoice } from "@/lib/db/repositories/invoices";
import type { PaypalInvoice } from "@/lib/paypal/schemas";

vi.mock("@/lib/paypal/invoicing", () => ({
  listAllPaypalInvoices: vi.fn(),
  getInvoice: vi.fn(),
  hostedUrlFromInvoice: (invoice: PaypalInvoice) =>
    invoice.links?.find((link) => link.rel === "payer-view")?.href,
}));

import { reconcileInvoicesFromPaypal } from "@/lib/invoices/actions/reconcile";
import { getInvoice, listAllPaypalInvoices } from "@/lib/paypal/invoicing";

function paypalInvoice(overrides: Partial<PaypalInvoice> = {}): PaypalInvoice {
  return {
    id: "INV2-NEW",
    status: "SENT",
    detail: { invoice_number: "0009", currency_code: "USD", payment_term: { due_date: "2026-11-01" } },
    amount: { currency_code: "USD", value: "74.21" },
    primary_recipients: [
      {
        billing_info: {
          email_address: "buyer@example.com",
          name: { given_name: "Ada", surname: "Lovelace" },
        },
      },
    ],
    links: [
      {
        href: "https://www.sandbox.paypal.com/invoice/p/#INV2-NEW",
        rel: "payer-view",
      },
    ],
    ...overrides,
  };
}

describe("reconcileInvoicesFromPaypal", () => {
  let previousUrl: string | undefined;
  let dir: string | undefined;

  beforeEach(async () => {
    previousUrl = process.env.DATABASE_URL;
    dir = await mkdtemp(join(tmpdir(), "paypilot-reconcile-"));
    process.env.DATABASE_URL = `file:${join(dir, "paypilot.db")}`;
    await resetDbForTests();
    await initDb();
    vi.mocked(listAllPaypalInvoices).mockReset();
    vi.mocked(getInvoice).mockReset();
  });

  afterEach(async () => {
    await resetDbForTests();
    if (previousUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousUrl;
    }
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("updates an existing row when PayPal reports a legal next status", async () => {
    const client = await upsertClientByEmail({
      id: "client-1",
      name: "Ada",
      email: "ada@example.com",
    });
    await insertInvoice({
      id: "inv-1",
      paypalInvoiceId: "INV2-EXISTING",
      paypalInvoiceNumber: "0001",
      clientId: client.id,
      amountCents: 12000,
      status: "SENT",
      issuedAt: 1,
      hostedUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-EXISTING",
      lineItems: [{ name: "Logo", quantity: 1, unitAmountCents: 12000 }],
      createdBy: "agent",
    });
    vi.mocked(listAllPaypalInvoices).mockResolvedValue([
      paypalInvoice({ id: "INV2-EXISTING", status: "PAID", detail: { invoice_number: "0001" } }),
    ]);

    const summary = await reconcileInvoicesFromPaypal({ actor: "user" });

    expect(summary).toEqual({ scanned: 1, updated: 1, inserted: 0, skipped: 0, errors: 0 });
    expect(await getInvoiceByPaypalId("INV2-EXISTING")).toMatchObject({ status: "PAID" });
    expect(getInvoice).not.toHaveBeenCalled();
  });

  it("ignores a stale SENT snapshot after PAID", async () => {
    const client = await upsertClientByEmail({
      id: "client-1",
      name: "Ada",
      email: "ada@example.com",
    });
    await insertInvoice({
      id: "inv-1",
      paypalInvoiceId: "INV2-EXISTING",
      paypalInvoiceNumber: "0001",
      clientId: client.id,
      amountCents: 12000,
      status: "PAID",
      paidAt: 9,
      hostedUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-EXISTING",
      lineItems: [{ name: "Logo", quantity: 1, unitAmountCents: 12000 }],
      createdBy: "agent",
    });
    vi.mocked(listAllPaypalInvoices).mockResolvedValue([
      paypalInvoice({
        id: "INV2-EXISTING",
        status: "SENT",
        detail: { invoice_number: "0001" },
        links: [
          {
            href: "https://www.sandbox.paypal.com/invoice/p/#INV2-EXISTING",
            rel: "payer-view",
          },
        ],
      }),
    ]);

    const summary = await reconcileInvoicesFromPaypal({ actor: "webhook" });

    expect(summary.updated).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(await getInvoiceByPaypalId("INV2-EXISTING")).toMatchObject({ status: "PAID" });
  });

  it("inserts a missing PayPal invoice after GET details", async () => {
    vi.mocked(listAllPaypalInvoices).mockResolvedValue([
      paypalInvoice({ id: "INV2-NEW", status: "UNPAID" }),
    ]);
    vi.mocked(getInvoice).mockResolvedValue(paypalInvoice({ status: "UNPAID" }));

    const summary = await reconcileInvoicesFromPaypal({ actor: "user" });

    expect(summary).toEqual({ scanned: 1, updated: 0, inserted: 1, skipped: 0, errors: 0 });
    expect(getInvoice).toHaveBeenCalledWith("INV2-NEW");
    expect(await getInvoiceByPaypalId("INV2-NEW")).toMatchObject({
      amountCents: 7421,
      status: "SENT",
      createdBy: "user",
      isDemo: false,
    });
  });

  it("skips insert when the PayPal invoice has no recipient email", async () => {
    vi.mocked(listAllPaypalInvoices).mockResolvedValue([paypalInvoice({ id: "INV2-NOMAIL" })]);
    vi.mocked(getInvoice).mockResolvedValue(
      paypalInvoice({ id: "INV2-NOMAIL", primary_recipients: [{ billing_info: {} }] }),
    );

    const summary = await reconcileInvoicesFromPaypal({ actor: "webhook" });

    expect(summary.inserted).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(await getInvoiceByPaypalId("INV2-NOMAIL")).toBeUndefined();
  });

  it("counts GET failures without aborting the rest of the list", async () => {
    const client = await upsertClientByEmail({
      id: "client-1",
      name: "Ada",
      email: "ada@example.com",
    });
    await insertInvoice({
      id: "inv-1",
      paypalInvoiceId: "INV2-EXISTING",
      paypalInvoiceNumber: "0001",
      clientId: client.id,
      amountCents: 12000,
      status: "SENT",
      issuedAt: 1,
      hostedUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-EXISTING",
      lineItems: [{ name: "Logo", quantity: 1, unitAmountCents: 12000 }],
      createdBy: "agent",
    });
    vi.mocked(listAllPaypalInvoices).mockResolvedValue([
      paypalInvoice({ id: "INV2-BAD" }),
      paypalInvoice({ id: "INV2-EXISTING", status: "PAID", detail: { invoice_number: "0001" } }),
    ]);
    vi.mocked(getInvoice).mockRejectedValue(new Error("PayPal down"));

    const summary = await reconcileInvoicesFromPaypal({ actor: "webhook" });

    expect(summary.errors).toBe(1);
    expect(summary.updated).toBe(1);
    expect(summary.scanned).toBe(2);
  });
});
