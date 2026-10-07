import { z } from "zod";

export const paypalErrorDetailSchema = z.object({
  field: z.string().optional(),
  issue: z.string().optional(),
  description: z.string().optional(),
});

export const paypalErrorBodySchema = z.object({
  name: z.string().optional(),
  message: z.string().optional(),
  debug_id: z.string().optional(),
  details: z.array(paypalErrorDetailSchema).optional(),
});

export type PayPalErrorDetail = z.infer<typeof paypalErrorDetailSchema>;

export class PayPalError extends Error {
  readonly paypalName: string;
  readonly status: number;
  readonly details: PayPalErrorDetail[];
  readonly debugId: string | undefined;

  constructor(params: {
    paypalName: string;
    message: string;
    status: number;
    details?: PayPalErrorDetail[];
    debugId?: string;
  }) {
    super(params.message);
    this.name = "PayPalError";
    this.paypalName = params.paypalName;
    this.status = params.status;
    this.details = params.details ?? [];
    this.debugId = params.debugId;
  }
}

export function userFacingPaypalMessage(paypalName: string, fallback: string): string {
  switch (paypalName) {
    case "AUTHENTICATION_FAILURE":
    case "NOT_AUTHORIZED":
      return "PayPal authentication failed. Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.";
    case "INVALID_REQUEST":
      return "PayPal rejected the request. Check invoice fields and try again.";
    case "UNPROCESSABLE_ENTITY":
      return "PayPal could not process this invoice. One or more fields are invalid.";
    case "INSTRUMENT_DECLINED":
      return "The payment method was declined. Try a different sandbox buyer funding source.";
    default:
      return fallback;
  }
}

export function paypalErrorFromHttp(
  status: number,
  body: unknown,
  rawText = "",
): PayPalError {
  const parsed = paypalErrorBodySchema.safeParse(body);
  const paypalName = parsed.success
    ? (parsed.data.name ?? `HTTP_${status}`)
    : `HTTP_${status}`;
  const rawMessage =
    parsed.success && parsed.data.message
      ? parsed.data.message
      : rawText.slice(0, 200) || `PayPal request failed with status ${status}.`;
  const details = parsed.success ? (parsed.data.details ?? []) : [];
  const detailText = details
    .map((detail) =>
      [detail.field, detail.issue, detail.description].filter(Boolean).join(": "),
    )
    .filter((part) => part.length > 0)
    .join("; ");

  const base = userFacingPaypalMessage(paypalName, rawMessage);
  return new PayPalError({
    paypalName,
    message: detailText ? `${base} ${detailText}` : base,
    status,
    details,
    debugId: parsed.success ? parsed.data.debug_id : undefined,
  });
}

export function idempotencyKey(localInvoiceId: string, action: string): string {
  return `paypilot:${localInvoiceId}:${action}`;
}
