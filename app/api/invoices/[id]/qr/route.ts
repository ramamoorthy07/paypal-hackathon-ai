import { NextResponse } from "next/server";
import { getInvoiceById } from "@/lib/db/repositories/invoices";
import { generateInvoiceQr } from "@/lib/paypal/invoicing";
import { PayPalError } from "@/lib/paypal/errors";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const invoice = await getInvoiceById(id);
  if (!invoice) {
    return NextResponse.json({ ok: false, error: "Invoice was not found." }, { status: 404 });
  }
  if (!invoice.paypalInvoiceId || invoice.status === "DRAFT") {
    return NextResponse.json(
      { ok: false, error: "QR codes are available after the invoice is sent." },
      { status: 409 },
    );
  }

  try {
    const qr = await generateInvoiceQr({
      paypalInvoiceId: invoice.paypalInvoiceId,
      localInvoiceId: invoice.id,
    });
    return NextResponse.json({ ok: true, ...qr });
  } catch (error) {
    if (error instanceof PayPalError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    }
    return NextResponse.json({ ok: false, error: "Could not generate QR code." }, { status: 500 });
  }
}
