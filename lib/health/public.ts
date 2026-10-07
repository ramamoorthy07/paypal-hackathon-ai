export type CheckResult =
  | { ok: true; [key: string]: unknown }
  | { ok: false; message: string; [key: string]: unknown };

export function publicEnv(check: CheckResult): Record<string, unknown> {
  if (!check.ok) {
    return { ok: false };
  }
  return {
    ok: true,
    mode: check.mode,
    maxInvoiceUsd: check.maxInvoiceUsd,
    webhookConfigured: check.webhookConfigured,
    llm: check.llm,
  };
}

export function publicDb(check: CheckResult): Record<string, unknown> {
  if (!check.ok) {
    return { ok: false };
  }
  return {
    ok: true,
    invoiceCount: check.invoiceCount,
    demoInvoiceCount: check.demoInvoiceCount,
    driver: check.driver,
    storage: check.storage,
  };
}

export function publicLlm(check: CheckResult): Record<string, unknown> {
  if (!check.ok) {
    return { ok: false };
  }
  return { ok: true, provider: check.provider };
}

export function publicPaypal(check: CheckResult): Record<string, unknown> {
  return { ok: check.ok };
}
