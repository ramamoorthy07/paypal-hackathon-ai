import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { agentTools } from "@/lib/agent/tools";
import { isPaypalReadToolName } from "@/lib/paypal/read-tools";
import { TOOLKIT_CONFIRM_GAPS, toolkitCanCreateWithoutDueDate } from "@/lib/paypal/toolkit-write";

describe("toolkit post-Confirm policy", () => {
  it("documents due-date and idempotency gaps", () => {
    expect(TOOLKIT_CONFIRM_GAPS).toContain("payment_term.due_date");
    expect(TOOLKIT_CONFIRM_GAPS).toContain("PayPal-Request-Id idempotency");
  });

  it("refuses toolkit create when a due date is present", () => {
    expect(toolkitCanCreateWithoutDueDate(null)).toBe(true);
    expect(toolkitCanCreateWithoutDueDate(Date.parse("2026-11-01T00:00:00.000Z"))).toBe(false);
  });

  it("does not give the chat model a create/send trigger", () => {
    const keys = Object.keys(agentTools);
    expect(keys).not.toContain("create_invoice");
    expect(keys).not.toContain("send_invoice");
    expect(keys).not.toContain("confirmInvoice");
    expect(isPaypalReadToolName("create_invoice")).toBe(false);
    expect(isPaypalReadToolName("send_invoice")).toBe(false);

    const chat = readFileSync(resolve(process.cwd(), "app/api/chat/route.ts"), "utf8");
    expect(chat).toContain("paypalReadOnlyAgentTools");
    expect(chat).not.toContain("createPaypalWriteToolkit");
    expect(chat).not.toContain("createDraftViaToolkit");
  });
});
