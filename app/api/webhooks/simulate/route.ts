import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getInvoiceById } from "@/lib/db/repositories/invoices";
import { handlePaypalWebhookEvent } from "@/lib/invoices/webhooks";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
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
      summary: `Simulated PayPal Webhook Event: ${eventType} for ${paypalInvoiceId}`,
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
