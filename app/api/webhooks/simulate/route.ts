import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isDemoAccessGranted } from "@/lib/access/demo-code";
import { insertAuditLog } from "@/lib/db/repositories/audit-log";
import { getInvoiceById } from "@/lib/db/repositories/invoices";
import { handlePaypalWebhookEvent } from "@/lib/invoices/webhooks";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  // Only permitted in sandbox mode
  if (process.env.PAYPAL_MODE !== "sandbox") {
    return NextResponse.json(
      { ok: false, error: "Webhook simulation is only permitted in PayPal Sandbox mode." },
      { status: 403 },
    );
  }

  // Gated in production builds unless ENABLE_SIMULATOR=true
  const isProd = process.env.NODE_ENV === "production";
  const simulatorEnabled = process.env.ENABLE_SIMULATOR === "true";
  if (isProd && !simulatorEnabled) {
    return NextResponse.json(
      { ok: false, error: "Webhook simulator is disabled in production builds. Set ENABLE_SIMULATOR=true." },
      { status: 403 },
    );
  }

  // Must satisfy demo access gate
  if (!isDemoAccessGranted(req)) {
    return NextResponse.json(
      { ok: false, error: "Demo access required to simulate webhooks. Please unlock first." },
      { status: 401 },
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      invoiceId?: string;
      eventType?: string;
    };

    if (!body.invoiceId) {
      return NextResponse.json({ ok: false, error: "invoiceId is required." }, { status: 400 });
    }

    const localInvoice = await getInvoiceById(body.invoiceId);
    if (!localInvoice) {
      return NextResponse.json({ ok: false, error: "Invoice was not found." }, { status: 404 });
    }

    const eventType = body.eventType || "INVOICING.INVOICE.PAID";
    const paypalInvoiceId =
      localInvoice.paypalInvoiceId || `INV2-SIM-${localInvoice.id.slice(0, 8).toUpperCase()}`;
    const webhookId = `WH-SIM-${Date.now()}-${randomUUID().slice(0, 8)}`;

    const simulatedEvent = {
      id: webhookId,
      event_type: eventType,
      create_time: new Date().toISOString(),
      resource_type: "invoices",
      event_version: "2.0",
      summary: `[SIMULATED] PayPal Webhook Event: ${eventType} for ${paypalInvoiceId}`,
      resource: {
        id: paypalInvoiceId,
        invoice_id: paypalInvoiceId,
        status:
          eventType === "INVOICING.INVOICE.PAID"
            ? "PAID"
            : eventType === "INVOICING.INVOICE.CANCELLED"
              ? "CANCELLED"
              : "REFUNDED",
        amount: {
          currency_code: localInvoice.currency,
          value: (localInvoice.amountCents / 100).toFixed(2),
        },
      },
    };

    // If local invoice doesn't have a paypalInvoiceId yet, assign it so it reconciles
    if (!localInvoice.paypalInvoiceId) {
      const { updateInvoice } = await import("@/lib/db/repositories/invoices");
      await updateInvoice(localInvoice.id, { paypalInvoiceId });
    }

    const result = await handlePaypalWebhookEvent(simulatedEvent);

    // Audit log with actor "simulator"
    await insertAuditLog({
      actor: "simulator",
      action: "simulate_webhook",
      invoiceId: localInvoice.id,
      payload: JSON.stringify({
        simulated: true,
        eventType,
        paypalInvoiceId,
        webhookId,
        applied: result.applied,
        reason: result.reason,
      }),
    });

    return NextResponse.json({
      ok: true,
      webhookId,
      eventType,
      paypalInvoiceId,
      result,
      eventPayload: simulatedEvent,
    });
  } catch (error) {
    console.error("simulate webhook failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Simulation failed." },
      { status: 500 },
    );
  }
}
