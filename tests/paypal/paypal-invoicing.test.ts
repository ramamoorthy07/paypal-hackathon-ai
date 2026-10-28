import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/core/env";
import { resetPaypalTokenCache } from "@/lib/paypal/client";
import {
  createDraftInvoice,
  invoiceIdFromHref,
  listAllPaypalInvoices,
  remindInvoice,
  sendInvoiceAsShareLink,
} from "@/lib/paypal/invoicing";
import { idempotencyKey } from "@/lib/paypal/errors";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PayPal invoicing REST", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    process.env.PAYPAL_CLIENT_ID = "test-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.PAYPAL_MODE = "sandbox";
    resetEnvCache();
    resetPaypalTokenCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetEnvCache();
    resetPaypalTokenCache();
  });

  it("sends PayPal-Request-Id derived from local invoice id on create", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-1", token_type: "Bearer", expires_in: 32400 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: "INV2-TEST", status: "DRAFT", links: [] }, 201),
      );

    await createDraftInvoice({
      localInvoiceId: "inv_abc",
      recipientEmail: "buyer@example.com",
      recipientName: "ABC Corp",
      items: [{ name: "Website", quantity: 1, unitAmountCents: 48000 }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const createCall = fetchMock.mock.calls[1];
    expect(createCall).toBeDefined();
    const [url, init] = createCall as [string, RequestInit];
    expect(String(url)).toContain("/v2/invoicing/invoices");
    const headers = new Headers(init.headers);
    expect(headers.get("PayPal-Request-Id")).toBe(idempotencyKey("inv_abc", "create"));
    expect(headers.get("Authorization")).toBe("Bearer token-1");
  });

  it("sends a share-link invoice with send_to_recipient false", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-1", token_type: "Bearer", expires_in: 32400 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          href: "https://www.sandbox.paypal.com/invoice/p/#INV2-TEST",
          rel: "payer-view",
          method: "GET",
        }),
      );

    const result = await sendInvoiceAsShareLink({
      paypalInvoiceId: "INV2-TEST",
      localInvoiceId: "inv_abc",
    });

    expect(result.hostedUrl).toContain("invoice/p/");
    const sendCall = fetchMock.mock.calls[1];
    expect(sendCall).toBeDefined();
    const [url, init] = sendCall as [string, RequestInit];
    expect(String(url)).toContain("/v2/invoicing/invoices/INV2-TEST/send");
    const headers = new Headers(init.headers);
    expect(headers.get("PayPal-Request-Id")).toBe(idempotencyKey("inv_abc", "send"));
    expect(JSON.parse(String(init.body))).toEqual({
      send_to_recipient: false,
      send_to_invoicer: false,
    });
  });

  it("refreshes the access token once on 401 and retries the invoice call", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-old", token_type: "Bearer", expires_in: 32400 }),
      )
      .mockResolvedValueOnce(jsonResponse({ name: "AUTHENTICATION_FAILURE" }, 401))
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-new", token_type: "Bearer", expires_in: 32400 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: "INV2-RETRY", status: "DRAFT", links: [] }, 201),
      );

    const invoice = await createDraftInvoice({
      localInvoiceId: "inv_retry",
      recipientEmail: "buyer@example.com",
      items: [{ name: "Logo", quantity: 1, unitAmountCents: 10000 }],
    });

    expect(invoice.id).toBe("INV2-RETRY");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const retried = fetchMock.mock.calls[3];
    expect(retried).toBeDefined();
    const headers = new Headers((retried as [string, RequestInit])[1].headers);
    expect(headers.get("Authorization")).toBe("Bearer token-new");
  });

  it("follows Location when create returns an empty body", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-1", token_type: "Bearer", expires_in: 32400 }),
      )
      .mockResolvedValueOnce(
        new Response("{}", {
          status: 201,
          headers: {
            "Content-Type": "application/json",
            Location: "https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-LOC",
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: "INV2-LOC", status: "DRAFT" }));

    const invoice = await createDraftInvoice({
      localInvoiceId: "inv_loc",
      recipientEmail: "buyer@example.com",
      items: [{ name: "Logo", quantity: 1, unitAmountCents: 10000 }],
    });

    expect(invoice.id).toBe("INV2-LOC");
    expect(invoiceIdFromHref("https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-LOC")).toBe(
      "INV2-LOC",
    );
    const getCall = fetchMock.mock.calls[2];
    expect(getCall).toBeDefined();
    expect(String((getCall as [string, RequestInit])[0])).toContain("/v2/invoicing/invoices/INV2-LOC");
  });

  it("reminds with send_to_recipient true and a unique request id", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-1", token_type: "Bearer", expires_in: 32400 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await remindInvoice({
      paypalInvoiceId: "INV2-TEST",
      localInvoiceId: "inv_abc",
      reminderId: "rem-1",
      subject: "Friendly reminder",
      note: "Please pay when you can.",
    });

    const remindCall = fetchMock.mock.calls[1];
    expect(remindCall).toBeDefined();
    const [url, init] = remindCall as [string, RequestInit];
    expect(String(url)).toContain("/v2/invoicing/invoices/INV2-TEST/remind");
    const headers = new Headers(init.headers);
    expect(headers.get("PayPal-Request-Id")).toBe(idempotencyKey("inv_abc", "remind:rem-1"));
    expect(JSON.parse(String(init.body))).toEqual({
      subject: "Friendly reminder",
      note: "Please pay when you can.",
      send_to_invoicer: false,
      send_to_recipient: true,
    });
  });

  it("pages GET /v2/invoicing/invoices at page_size 100", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-1", token_type: "Bearer", expires_in: 32400 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          total_items: 2,
          total_pages: 2,
          items: [{ id: "INV2-A", status: "SENT" }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          total_items: 2,
          total_pages: 2,
          items: [{ id: "INV2-B", status: "PAID" }],
        }),
      );

    const invoices = await listAllPaypalInvoices();

    expect(invoices.map((row) => row.id)).toEqual(["INV2-A", "INV2-B"]);
    const firstList = fetchMock.mock.calls[1];
    expect(firstList).toBeDefined();
    expect(String((firstList as [string, RequestInit])[0])).toContain("page=1");
    expect(String((firstList as [string, RequestInit])[0])).toContain("page_size=100");
    expect(String((fetchMock.mock.calls[2] as [string, RequestInit])[0])).toContain("page=2");
  });
});
