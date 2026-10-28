"use client";

import { useEffect, useState } from "react";

export function InvoiceQr({ invoiceId }: { invoiceId: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/qr`);
        const body = (await response.json()) as {
          ok: boolean;
          imageBase64?: string;
          contentType?: string;
        };
        if (!cancelled && response.ok && body.ok && body.imageBase64) {
          setSrc(`data:${body.contentType ?? "image/png"};base64,${body.imageBase64}`);
        }
      } catch {
        setSrc(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  if (!src) {
    return null;
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Payer QR</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="PayPal invoice QR code" src={src} className="h-40 w-40" />
    </div>
  );
}
