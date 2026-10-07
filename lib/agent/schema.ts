import { z } from "zod";

export const lineItemProposalSchema = z.object({
  name: z.string().min(1).max(120).describe("Short line item name, e.g. Landing page."),
  description: z.string().max(1000).optional().describe("Optional details for the client."),
  quantity: z.number().int().positive().max(999),
  unitAmountCents: z
    .number()
    .int()
    .nonnegative()
    .describe("Unit price in USD integer cents. $480.00 = 48000."),
});

export const invoiceProposalSchema = z.object({
  clientName: z.string().min(1).max(200).describe("Client or company name."),
  clientEmail: z.email().describe("Client email for the invoice."),
  lineItems: z.array(lineItemProposalSchema).min(1).max(20),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD")
    .optional()
    .describe("Due date as YYYY-MM-DD. Omit if unknown."),
  notes: z.string().max(4000).optional().describe("Note shown on the invoice."),
  originalInrAmountCents: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Original INR amount in paise (₹40,000 = 4000000). Omit when the user quoted USD."),
  fxRateUsed: z
    .number()
    .positive()
    .optional()
    .describe("USD-per-INR rate from the system prompt (live Frankfurter or env fallback). Required when originalInrAmountCents is set."),
  fxConfirmedByUser: z
    .boolean()
    .optional()
    .describe(
      "True only after the user explicitly confirmed converting INR to USD at the labeled demo rate.",
    ),
});

export type LineItemProposal = z.infer<typeof lineItemProposalSchema>;
export type InvoiceProposal = z.infer<typeof invoiceProposalSchema>;
