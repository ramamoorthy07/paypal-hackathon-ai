import { z } from "zod";

export const paypalLinkSchema = z.object({
  href: z.string(),
  rel: z.string(),
  method: z.string().optional(),
});

export const paypalInvoiceSchema = z.object({
  id: z.string(),
  status: z.string(),
  detail: z
    .object({
      invoice_number: z.string().optional(),
      currency_code: z.string().optional(),
    })
    .optional(),
  amount: z
    .object({
      currency_code: z.string().optional(),
      value: z.string().optional(),
    })
    .optional(),
  links: z.array(paypalLinkSchema).optional(),
});

export const paypalInvoiceListSchema = z.object({
  total_items: z.number().optional(),
  total_pages: z.number().optional(),
  items: z.array(paypalInvoiceSchema.partial()).optional(),
});

export const paypalSendLinkSchema = z.object({
  href: z.string(),
  rel: z.string().optional(),
  method: z.string().optional(),
});

export type PaypalInvoice = z.infer<typeof paypalInvoiceSchema>;
export type PaypalInvoiceList = z.infer<typeof paypalInvoiceListSchema>;
