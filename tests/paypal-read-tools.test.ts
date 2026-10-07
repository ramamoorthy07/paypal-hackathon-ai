import { describe, expect, it } from "vitest";
import { isPaypalReadToolName } from "@/lib/paypal/read-tools";
import { agentTools } from "@/lib/agent/tools";

describe("isPaypalReadToolName", () => {
  it("allows list/search/get and rejects writes", () => {
    expect(isPaypalReadToolName("list_invoices")).toBe(true);
    expect(isPaypalReadToolName("search_invoicing")).toBe(true);
    expect(isPaypalReadToolName("get_invoice")).toBe(true);
    expect(isPaypalReadToolName("create_invoice")).toBe(false);
    expect(isPaypalReadToolName("send_invoice")).toBe(false);
    expect(isPaypalReadToolName("send_invoice_reminder")).toBe(false);
    expect(isPaypalReadToolName("cancel_sent_invoice")).toBe(false);
    expect(isPaypalReadToolName("delete_invoice")).toBe(false);
    expect(isPaypalReadToolName("generate_invoice_qr_code")).toBe(false);
  });
});

describe("agentTools HITL", () => {
  it("never exposes PayPal write tools", () => {
    const keys = Object.keys(agentTools);
    expect(keys).toContain("proposeInvoice");
    expect(keys).not.toContain("confirmInvoice");
    expect(keys).not.toContain("sendInvoice");
    expect(keys).not.toContain("create_invoice");
    expect(keys).not.toContain("send_invoice");
  });
});
