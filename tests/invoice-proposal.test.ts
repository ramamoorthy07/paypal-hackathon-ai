import { describe, expect, it } from "vitest";
import { evaluateProposal } from "@/lib/agent/propose";
import { invoiceProposalSchema } from "@/lib/agent/schema";
import { chatStreamErrorMessage } from "@/lib/agent/stream-error";
import { agentTools } from "@/lib/agent/tools";

const limits = { maxInvoiceUsd: 5000 };

const usdLanding = {
  clientName: "Acme Studio",
  clientEmail: "acme@example.com",
  lineItems: [{ name: "Landing page", quantity: 1, unitAmountCents: 48000 }],
};

describe("invoiceProposalSchema", () => {
  it("accepts a USD proposal", () => {
    const parsed = invoiceProposalSchema.parse(usdLanding);
    expect(parsed.clientEmail).toBe("acme@example.com");
  });

  it("rejects a non-email", () => {
    const parsed = invoiceProposalSchema.safeParse({
      ...usdLanding,
      clientEmail: "acme",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("evaluateProposal", () => {
  it("computes cents from line items and sanitizes text", () => {
    const result = evaluateProposal(
      invoiceProposalSchema.parse({
        ...usdLanding,
        clientName: "<b>Acme Studio</b>",
        notes: "  thanks  ",
      }),
      limits,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.amountCents).toBe(48000);
    expect(result.clientName).toBe("Acme Studio");
    expect(result.note).toBe("thanks");
    expect(result.currency).toBe("USD");
  });

  it("rejects totals above MAX_INVOICE_USD", () => {
    const result = evaluateProposal(
      invoiceProposalSchema.parse({
        ...usdLanding,
        lineItems: [{ name: "Huge job", quantity: 1, unitAmountCents: 500_001 }],
      }),
      limits,
    );
    expect(result).toMatchObject({ ok: false, code: "over_limit" });
  });

  it("rejects INR until the user confirms the labeled rate", () => {
    const pending = evaluateProposal(
      invoiceProposalSchema.parse({
        ...usdLanding,
        originalInrAmountCents: 4_000_000,
        fxRateUsed: 0.012,
        fxConfirmedByUser: false,
      }),
      limits,
    );
    expect(pending).toMatchObject({ ok: false, code: "fx_unconfirmed" });

    const confirmed = evaluateProposal(
      invoiceProposalSchema.parse({
        ...usdLanding,
        originalInrAmountCents: 4_000_000,
        fxRateUsed: 0.012,
        fxConfirmedByUser: true,
      }),
      limits,
    );
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) {
      expect(confirmed.originalCurrency).toBe("INR");
      expect(confirmed.fxRate).toBe("0.012");
    }
  });

  it("rejects INR conversion that does not match USD line items", () => {
    const result = evaluateProposal(
      invoiceProposalSchema.parse({
        ...usdLanding,
        originalInrAmountCents: 4_000_000,
        fxRateUsed: 0.012,
        fxConfirmedByUser: true,
        lineItems: [{ name: "Landing page", quantity: 1, unitAmountCents: 10000 }],
      }),
      limits,
    );
    expect(result).toMatchObject({ ok: false, code: "fx_mismatch" });
  });
});

describe("agent tools", () => {
  it("exposes only proposeInvoice to the model", () => {
    expect(Object.keys(agentTools)).toEqual(["proposeInvoice"]);
  });
});

describe("chatStreamErrorMessage", () => {
  it("does not forward API key material to the client", () => {
    expect(
      chatStreamErrorMessage(new Error("Incorrect API key provided: sk-secret")),
    ).toBe("OpenAI rejected the API key. Check OPENAI_API_KEY in .env.local.");
    expect(chatStreamErrorMessage(new Error("model overloaded"))).toBe("Chat failed. Try again.");
  });
});
